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
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit
import net.crimsys.app.core.WallClock
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Drains the Haris sync-command queue (evidence chain events, legal
 * attestations, pending queries) to the backend via
 * [SyncCommandExecutor].
 *
 * Scheduling model: repositories enqueue an expedited one-time request with a
 * CONNECTED constraint after every queued write, so no connectivity check of
 * our own is needed — WorkManager holds the request while offline. Requests
 * survive process death (WorkManager persists them), and a boot-time KEEP
 * request in CrimSysApplication covers a restart with a non-empty queue.
 *
 * Drain policy — same philosophy as the legacy OfflineActionQueue:
 *  1. FIFO by row id (insertion order is the authority for ordering).
 *  2. A command whose retry budget is exhausted is dead-lettered and the
 *     drain CONTINUES (no head-of-line blocking); the row is kept, never
 *     deleted.
 *  3. A transient rejection (offline, no auth session, backend error)
 *     increments the retry counter and STOPS the drain — a later command
 *     must never overtake a failed earlier one.
 *  4. A permanently broken command (corrupt envelope, digest mismatch — the
 *     executor throws IllegalArgumentException) is parked immediately: it
 *     can never succeed, so it must never consume another connectivity
 *     window.
 *
 * The worker always returns [Result.success] — the queue state IS the sync
 * state, and WorkManager's own retry machinery would only stack a second
 * retry policy on top of the queue's. Re-drains are triggered by the next
 * enqueued command, the next connectivity change (a fresh CONNECTED request),
 * or the user requeueing dead-lettered rows.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val syncCommandDao: SyncCommandDao,
    private val executor: SyncCommandExecutor,
    private val clock: WallClock,
) : CoroutineWorker(app, params) {

    override suspend fun doWork(): Result {
        return when (val outcome = drainOnce()) {
            is SyncResult.Success -> Result.success()
            is SyncResult.Retry -> Result.success()
            is SyncResult.Failed -> {
                // Dead-letter decisions are already persisted; nothing here
                // should fail the worker itself.
                Log.w(TAG, "Drain finished with failure: ${outcome.error}")
                Result.success()
            }
        }
    }

    /**
     * One FIFO pass over the live queue. Returns a [SyncResult] describing
     * the pass — the domain contract, not the WorkManager contract.
     */
    private suspend fun drainOnce(): SyncResult {
        var processed = 0

        for (entity in syncCommandDao.pendingInOrder()) {
            // Poison-pill handling: exhausted budget → dead letter, keep the
            // row, keep draining the commands behind it.
            if (entity.retryCount >= entity.maxRetries) {
                syncCommandDao.markDeadLetter(entity.id)
                Log.w(TAG, "Command ${entity.uuid} (${entity.type}) dead-lettered after ${entity.retryCount} attempts")
                continue
            }

            val command = entity.toCommand()
            if (command == null) {
                // Corrupt envelope — it will never parse, so it must never
                // ride the queue again.
                syncCommandDao.parkCorrupt(entity.id)
                Log.w(TAG, "Command ${entity.uuid} parked: corrupt envelope")
                continue
            }

            val accepted = try {
                executor.execute(command)
            } catch (expected: IllegalArgumentException) {
                // Integrity gate rejection (digest mismatch) or malformed
                // command — permanent for this row.
                syncCommandDao.parkCorrupt(entity.id)
                Log.w(TAG, "Command ${entity.uuid} parked: rejected as permanent")
                continue
            }

            if (accepted) {
                syncCommandDao.deleteById(entity.id)
                processed++
                continue
            }

            // Transient rejection: keep order, stop the drain, retry next window.
            syncCommandDao.incrementRetry(entity.id)
            Log.w(TAG, "Command ${entity.uuid} rejected transiently (attempt ${entity.retryCount + 1}) — pausing drain")
            return SyncResult.Retry("transport not ready at ${clock.nowMillis()}")
        }

        return SyncResult.Success(processedCommands = processed)
    }

    companion object {
        const val TAG = "SyncWorker"
        const val WORK_NAME = "haris-sync-command-drain"

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
        fun schedule(workManager: androidx.work.WorkManager, policy: ExistingWorkPolicy) {
            workManager.enqueueUniqueWork(WORK_NAME, policy, buildDrainRequest())
        }
    }
}
