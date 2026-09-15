package net.crimsys.app.data.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit
import kotlin.time.Duration
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Drains the Haris sync-command queue (case creation, memo updates, hearing
 * records, evidence registration) to the backend via
 * [SyncCommandExecutor].
 *
 * Scheduling model: repositories enqueue an expedited one-time request with a
 * CONNECTED constraint after every queued write, so no connectivity check of
 * our own is needed — WorkManager holds the request while offline. Requests
 * survive process death (WorkManager persists them), and a boot-time KEEP
 * request in CrimSysApplication covers a restart with a non-empty queue.
 *
 * Drain policy — one FIFO pass, per-command [SyncResult] outcomes:
 *  1. FIFO by row id (insertion order is the authority for ordering).
 *  2. [SyncResult.Accepted] — the remote write landed; the row is deleted
 *     and the drain continues.
 *  3. [SyncResult.Retryable] — a transient rejection (offline, no session,
 *     backend error) increments the attempt counter and STOPS the drain — a
 *     later command must never overtake a failed earlier one. A server
 *     [SyncResult.Retryable.retryAfter] hint schedules a delayed re-drain
 *     (capped; the next enqueued command or connectivity window re-triggers
 *     regardless).
 *  4. [SyncResult.Conflict] — a newer remote row exists; a blind overwrite
 *     would destroy data, so the row is parked immediately for human
 *     inspection and the drain continues.
 *  5. [SyncResult.PermanentFailure] — the command can never succeed
 *     (corrupt row, unsupported schema version), so it must never consume
 *     another connectivity window: parked immediately, drain continues.
 *  6. A command whose attempt budget is exhausted is dead-lettered and the
 *     drain continues (no head-of-line blocking); the row is kept, never
 *     deleted.
 *
 * The worker always returns [Result.success] — the queue state IS the sync
 * state, and WorkManager's own retry machinery would only stack a second
 * retry policy on top of the queue's. Re-drains are triggered by the next
 * enqueued command, the next connectivity change (a fresh CONNECTED request),
 * a [SyncResult.Retryable.retryAfter] hint, or the user requeueing
 * dead-lettered rows.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val syncCommandDao: SyncCommandDao,
    private val executor: SyncCommandExecutor,
) : CoroutineWorker(app, params) {

    override suspend fun doWork(): Result {
        return when (val outcome = drainOnce()) {
            is DrainOutcome.Drained -> Result.success()
            is DrainOutcome.Paused -> {
                // Transient pause decisions are already persisted; nothing
                // here should fail the worker itself.
                Log.w(TAG, "Drain paused: ${outcome.reason}")
                Result.success()
            }
        }
    }

    /**
     * One FIFO pass over the live queue. Returns a [DrainOutcome] describing
     * the pass — the worker's own summary; per-command outcomes are the
     * [SyncResult] taxonomy reported by [executor].
     */
    private suspend fun drainOnce(): DrainOutcome {
        var processed = 0

        for (entity in syncCommandDao.pendingInOrder()) {
            // Poison-pill handling: exhausted budget → dead letter, keep the
            // row, keep draining the commands behind it.
            if (entity.attemptCount >= entity.maxRetries) {
                syncCommandDao.markDeadLetter(entity.id)
                Log.w(TAG, "Command ${entity.commandId} (${entity.type}) dead-lettered after ${entity.attemptCount} attempts")
                continue
            }

            val command = try {
                entity.toCommand()
            } catch (t: IllegalArgumentException) {
                null // unknown CommandType name — permanently broken row
            } catch (t: java.time.format.DateTimeParseException) {
                null // unparsable createdAt — permanently broken row
            }
            if (command == null) {
                // Corrupt row — it will never decode, so it must never ride
                // the queue again.
                syncCommandDao.parkCorrupt(entity.id)
                Log.w(TAG, "Command ${entity.commandId} parked: corrupt row")
                continue
            }

            when (val outcome = executor.execute(command)) {
                is SyncResult.Accepted -> {
                    syncCommandDao.deleteById(entity.id)
                    processed++
                }

                is SyncResult.Retryable -> {
                    // Transient rejection: keep order, stop the drain, retry
                    // next window — honoring a server retry hint when one was
                    // supplied.
                    syncCommandDao.incrementAttempt(entity.id)
                    Log.w(TAG, "Command ${entity.commandId} rejected transiently (attempt ${entity.attemptCount + 1}) — pausing drain")
                    outcome.retryAfter?.let { retryAfter ->
                        schedule(
                            workManager = WorkManager.getInstance(applicationContext),
                            policy = ExistingWorkPolicy.APPEND_OR_REPLACE,
                            retryAfter = retryAfter,
                        )
                    }
                    return DrainOutcome.Paused(
                        reason = outcome.reason,
                        retryAfter = outcome.retryAfter,
                    )
                }

                is SyncResult.Conflict -> {
                    // A newer remote row exists — refuse the overwrite and
                    // park the row for human inspection; the drain continues.
                    syncCommandDao.parkCorrupt(entity.id)
                    Log.w(
                        TAG,
                        "Command ${entity.commandId} parked: remote conflict (remote version ${outcome.remoteVersion})",
                    )
                }

                is SyncResult.PermanentFailure -> {
                    // It can never succeed, so it must never consume another
                    // connectivity window.
                    syncCommandDao.parkCorrupt(entity.id)
                    Log.w(TAG, "Command ${entity.commandId} parked: permanent failure")
                }
            }
        }

        return DrainOutcome.Drained(processedCommands = processed)
    }

    companion object {
        const val TAG = "SyncWorker"
        const val WORK_NAME = "haris-sync-command-drain"

        /** Floor for a server retry hint — never re-drain in a hot loop. */
        private const val MIN_RETRY_DELAY_MS = 1_000L

        /**
         * Ceiling for a server retry hint — a hint of hours must not silence
         * the queue all day; the next enqueued command or connectivity window
         * re-triggers the drain regardless.
         */
        private const val MAX_RETRY_DELAY_MS = 15 * 60 * 1000L

        /**
         * The standard drain request: runs only with connectivity, exponential
         * backoff (mostly irrelevant since we always return success, but it
         * guards framework-level restarts).
         */
        fun buildDrainRequest(): OneTimeWorkRequest =
            OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

        /**
         * Boot-time / on-write scheduling helper.
         *
         * @param policy KEEP for boot (never stack duplicates), APPEND_OR_REPLACE
         * after a fresh queue write (runs promptly even if a chain exists).
         */
        fun schedule(workManager: WorkManager, policy: ExistingWorkPolicy) {
            workManager.enqueueUniqueWork(WORK_NAME, policy, buildDrainRequest())
        }

        /**
         * Delayed re-drain honoring a [SyncResult.Retryable.retryAfter] hint.
         * The delay is clamped to [MIN_RETRY_DELAY_MS]..[MAX_RETRY_DELAY_MS]:
         * a zero/negative hint must not hot-loop the drain, and an
         * over-long hint must not bury the queue badge for hours.
         *
         * APPEND_OR_REPLACE chains the delayed request behind any live drain
         * instead of preempting it — FIFO ordering survives the pause.
         */
        fun schedule(workManager: WorkManager, policy: ExistingWorkPolicy, retryAfter: Duration) {
            val delayMs = retryAfter.inWholeMilliseconds
                .coerceIn(MIN_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS)
            workManager.enqueueUniqueWork(
                WORK_NAME,
                policy,
                OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build(),
                    )
                    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build(),
            )
        }
    }
}

/**
 * Worker-local summary of one drain pass — deliberately NOT part of the
 * domain [SyncResult] taxonomy, which is per-command. The pass either ran to
 * completion ([Drained]) or paused on the first transient rejection
 * ([Paused], optionally carrying the server's retry hint).
 */
private sealed interface DrainOutcome {

    /** The pass finished; [processedCommands] commands were accepted+deleted. */
    data class Drained(val processedCommands: Int) : DrainOutcome

    /** The pass stopped on a transient rejection at the failed command. */
    data class Paused(
        val reason: String,
        val retryAfter: Duration? = null,
    ) : DrainOutcome
}
