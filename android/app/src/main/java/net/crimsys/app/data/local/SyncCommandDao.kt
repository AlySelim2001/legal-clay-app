package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Queue access for [net.crimsys.app.data.sync.SyncWorker].
 *
 * Conventions carried over from the previous queue generations: FIFO by
 * creation time, scoped transitions guarded by status, zero destructive
 * deletes of parked rows. What changed with the new entity shape:
 *
 *  - Rows are keyed by [SyncCommandEntity.commandId] (the device-independent
 *    UUID), not an autoincrement ordinal — enqueue is an INSERT with
 *    ABORT so a genuine duplicate crashes loudly instead of silently
 *    replacing the original row (a REPLACE could drop an in-flight command).
 *  - Retry deferral is PER-ROW and durable: [markAttemptFailed] writes
 *    [SyncCommandEntity.nextAttemptAtEpochMillis] on the same UPDATE that
 *    increments the attempt counter, so a process death between attempt and
 *    outcome can never lose the deferral or the counter.
 *  - Every park records [SyncCommandEntity.lastError] — a short, non-legal
 *    breadcrumb for the inspection screen.
 */
@Dao
interface SyncCommandDao {

    /**
     * Queue a freshly minted command. ABORT (never REPLACE): the commandId is
     * the primary key, so re-enqueueing the same command must fail loudly —
     * idempotent redelivery is the TRANSPORT's job, not the queue's.
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun enqueue(command: SyncCommandEntity)

    /**
     * Commands due right now, FIFO by creation time. A row whose
     * [SyncCommandEntity.nextAttemptAtEpochMillis] is in the future is
     * deliberately NOT returned — it is deferred, not abandoned; it becomes
     * due again automatically once the clock passes its marker (the next
     * drain pass or connectivity window picks it up).
     */
    @Query(
        "SELECT * FROM sync_commands " +
            "WHERE status = 'PENDING' " +
            "AND (nextAttemptAtEpochMillis IS NULL OR nextAttemptAtEpochMillis <= :nowEpochMillis) " +
            "ORDER BY createdAtEpochMillis ASC",
    )
    suspend fun dueCommands(nowEpochMillis: Long): List<SyncCommandEntity>

    /** Reactive queue depth for the sync badge (all live rows, deferred included). */
    @Query("SELECT COUNT(*) FROM sync_commands WHERE status = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    /** Dead-letter size for the warning badge. */
    @Query("SELECT COUNT(*) FROM sync_commands WHERE status = 'DEAD'")
    fun observeDeadLetterCount(): Flow<Int>

    /**
     * Record one failed attempt atomically: increment the counter, stamp the
     * next-due marker, keep the error breadcrumb. The `status = 'PENDING'`
     * guard makes the write idempotent under a concurrent drain — a row
     * parked between the attempt and this call is never resurrected.
     *
     * Must run on the SAME connection that observed the row (the worker is
     * the single drain) so last-writer-wins is safe.
     */
    @Query(
        "UPDATE sync_commands SET " +
            "attemptCount = attemptCount + 1, " +
            "nextAttemptAtEpochMillis = :nextAttemptAtEpochMillis, " +
            "lastError = :error " +
            "WHERE commandId = :commandId AND status = 'PENDING'",
    )
    suspend fun markAttemptFailed(
        commandId: String,
        nextAttemptAtEpochMillis: Long,
        error: String,
    )

    /**
     * Park an exhausted command. The `status = 'PENDING'` guard means a
     * concurrent retry can never dead-letter a healthy row; the row is KEPT
     * for inspection (zero data loss).
     */
    @Query(
        "UPDATE sync_commands SET status = 'DEAD' " +
            "WHERE commandId = :commandId AND status = 'PENDING' AND attemptCount >= :maxAttempts",
    )
    suspend fun markDeadLetter(commandId: String, maxAttempts: Int)

    /** Rows parked for inspection, oldest first. */
    @Query("SELECT * FROM sync_commands WHERE status = 'DEAD' ORDER BY createdAtEpochMillis ASC")
    suspend fun deadLettered(): List<SyncCommandEntity>

    /** User-initiated second chance: fresh budget, cleared deferral and error. */
    @Query(
        "UPDATE sync_commands SET status = 'PENDING', attemptCount = 0, " +
            "nextAttemptAtEpochMillis = NULL, lastError = NULL " +
            "WHERE commandId = :commandId AND status = 'DEAD'",
    )
    suspend fun requeueDeadLettered(commandId: String)

    /**
     * Park a permanently broken command (corrupt row, schema-version gate,
     * remote conflict) immediately, recording why. Scoped by status='PENDING'
     * so it can never double-park or resurrect a dead row.
     */
    @Query(
        "UPDATE sync_commands SET status = 'DEAD', lastError = :reason " +
            "WHERE commandId = :commandId AND status = 'PENDING'",
    )
    suspend fun parkCorrupt(commandId: String, reason: String)

    /** Remove an accepted command — the only delete in the queue's life. */
    @Query("DELETE FROM sync_commands WHERE commandId = :commandId AND status = 'PENDING'")
    suspend fun deleteAccepted(commandId: String)
}
