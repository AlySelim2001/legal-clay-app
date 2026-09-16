package net.crimsys.app.data.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min
import kotlin.random.Random
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Drains the Haris sync-command queue: pop-one-at-a-time FIFO with
 * exponential backoff + jitter, durable per-row deferral, and a dead-letter
 * path. Scheduling is owned by [SyncWorkScheduler] (on-write KEEP, called by
 * command-producing repositories) and [scheduleSelf] (post-failure delayed
 * REPLACE); there is no boot-time trigger — a command enqueued while offline
 * is drained by the next on-write enqueue or connectivity window.
 *
 * Coexistence policy (see `android/README.md`): no production code constructs
 * `SyncCommandEntity` yet — this queue's producers arrive with the
 * case/hearing repository migration, and the legacy `OfflineActionQueue`
 * (`SyncManager`) stays the live write path until every producer has moved
 * over and parity tests pass. Do not delete the legacy queue before then.
 *
 * Backoff model ([computeNextAttempt]): a transport [SyncResult.Retryable.retryAfter]
 * hint, when present, is the base delay (floor 0 — bounded by [MAX_ATTEMPTS],
 * which dead-letters a permanently hint-broken row within 8 cycles);
 * otherwise exponential 10s × 2^attempt capped at 15 minutes. Jitter is up
 * to 20% of the base (capped at 30s) so concurrent devices never drain in
 * lockstep.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val commandDao: SyncCommandDao,
    private val executor: SyncCommandExecutor,
) : CoroutineWorker(
    appContext,
    workerParams,
) {

    override suspend fun doWork(): Result {

        while (!isStopped) {

            val entity =
                commandDao.nextReady(
                    System.currentTimeMillis(),
                ) ?: return Result.success()

            if (
                entity.attemptCount >= MAX_ATTEMPTS
            ) {

                commandDao.markDead(
                    commandId = entity.commandId,
                    error = "MAX_ATTEMPTS_EXCEEDED",
                )

                continue
            }

            /*
             * Decode guard: a row written by an older generation (free-form
             * type string preserved by migration) or a corrupted row can
             * never parse. The throw happens BEFORE recordRetry, so without
             * this guard the attempt counter never advances, MAX_ATTEMPTS
             * can never fire, and the row livelocks at the head of the
             * queue — crashing every future drain pass. Dead-letter it
             * instead (zero head-of-line blocking; row kept for inspection).
             */
            val command =
                try {
                    entity.toDomain()
                } catch (t: IllegalArgumentException) {
                    commandDao.markDead(
                        commandId = entity.commandId,
                        error = "UNDECODABLE_COMMAND_ROW",
                    )
                    continue
                }

            when (
                val outcome =
                    executor.execute(command)
            ) {

                is SyncResult.Accepted -> {

                    commandDao.deleteAccepted(
                        commandId =
                            entity.commandId,
                    )
                }

                is SyncResult.Retryable -> {

                    val nextAttempt =
                        computeNextAttempt(
                            entity.attemptCount,
                            outcome.retryAfter,
                        )

                    commandDao.recordRetry(
                        commandId =
                            entity.commandId,
                        error =
                            outcome.reason
                                .take(MAX_ERROR_LENGTH),
                        nextAttemptAt =
                            nextAttempt,
                    )

                    scheduleSelf(
                        nextAttempt -
                            System.currentTimeMillis(),
                    )

                    return Result.success()
                }

                is SyncResult.Conflict -> {

                    commandDao.markConflict(
                        commandId =
                            entity.commandId,
                        error =
                            "REMOTE_VERSION=${outcome.remoteVersion}",
                    )
                }

                is SyncResult.PermanentFailure -> {

                    commandDao.markDead(
                        commandId =
                            entity.commandId,
                        error =
                            outcome.reason
                                .take(MAX_ERROR_LENGTH),
                    )
                }
            }
        }

        return Result.success()
    }

    private fun scheduleSelf(
        delayMillis: Long,
    ) {

        val request =
            OneTimeWorkRequestBuilder<SyncWorker>()
                .setInitialDelay(
                    delayMillis.coerceAtLeast(0L),
                    TimeUnit.MILLISECONDS,
                )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(
                            NetworkType.CONNECTED,
                        )
                        .build(),
                )
                .build()

        WorkManager
            .getInstance(applicationContext)
            .enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
    }

    private fun computeNextAttempt(
        attemptCount: Int,
        retryAfter: kotlin.time.Duration?,
    ): Long {

        val now =
            System.currentTimeMillis()

        val baseMillis =
            retryAfter
                ?.inWholeMilliseconds
                ?.coerceAtLeast(0L)
                ?: min(
                    MAX_BACKOFF_MILLIS,
                    BASE_BACKOFF_MILLIS *
                        (
                            1L shl
                                attemptCount
                                    .coerceAtMost(20)
                        ),
                )

        val jitter =
            Random.nextLong(
                0L,
                min(
                    JITTER_MAX_MILLIS,
                    maxOf(
                        1L,
                        baseMillis / 5L,
                    ),
                ),
            )

        return now +
            baseMillis +
            jitter
    }

    private fun SyncCommandEntity.toDomain(): SyncCommand =
        SyncCommand(
            commandId =
                UUID.fromString(commandId),

            schemaVersion =
                schemaVersion,

            aggregateId =
                UUID.fromString(aggregateId),

            type =
                CommandType.valueOf(type),

            payloadJson =
                payloadJson,

            createdAt =
                Instant.ofEpochMilli(
                    createdAtEpochMillis,
                ),

            attemptCount =
                attemptCount,
        )

    private companion object {
        const val BASE_BACKOFF_MILLIS = 10_000L
        const val MAX_BACKOFF_MILLIS = 15 * 60 * 1000L
        const val JITTER_MAX_MILLIS = 30_000L
        const val MAX_ERROR_LENGTH = 512
        const val MAX_ATTEMPTS = 8
        const val UNIQUE_WORK_NAME =
            "haris_sync_commands"
    }
}

/**
 * Public scheduling entry point for the Haris command queue. KEEP policy:
 * a pending/running drain is never stacked or replaced — a new enqueue
 * simply relies on the running drain's pop loop (or the next scheduleSelf)
 * to pick the command up. On-write callers share one instance.
 */
@Singleton
class SyncWorkScheduler @Inject constructor(
    private val context: Context,
) {

    fun enqueue() {

        val request =
            OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(
                            NetworkType.CONNECTED,
                        )
                        .build(),
                )
                .build()

        WorkManager
            .getInstance(context)
            .enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                request,
            )
    }

    private companion object {
        const val UNIQUE_WORK_NAME =
            "haris_sync_commands"
    }
}
