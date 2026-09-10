package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface OfflineActionDao {

    @Insert
    suspend fun enqueue(action: OfflineActionEntity): Long

    /**
     * Queue snapshot for the sync badge — reactive so the UI updates live.
     * Counts only live queue entries; dead-lettered rows are surfaced through
     * [observeDeadLetterCount] so the user sees a distinct, serious warning.
     */
    @Query("SELECT COUNT(*) FROM offline_actions WHERE status = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    /** Live FIFO queue, drained in insertion order by SyncManager. */
    @Query("SELECT * FROM offline_actions WHERE status = 'PENDING' ORDER BY id ASC")
    suspend fun pendingInOrder(): List<OfflineActionEntity>

    @Query("UPDATE offline_actions SET retryCount = retryCount + 1 WHERE id = :id")
    suspend fun incrementRetry(id: Long)

    /**
     * P1 — Dead Letter Queue move. Scoped by `retryCount >= maxRetries` so the
     * write can only ever flip an exhausted row: a concurrent retry
     * increment can never accidentally park a healthy action. The row is
     * KEPT (status = 'DEAD', zero data loss), not deleted.
     */
    @Query(
        "UPDATE offline_actions SET status = 'DEAD' " +
            "WHERE id = :id AND status = 'PENDING' AND retryCount >= maxRetries",
    )
    suspend fun markDeadLetter(id: Long)

    /** Size of the dead letter queue — drives the user warning badge. */
    @Query("SELECT COUNT(*) FROM offline_actions WHERE status = 'DEAD'")
    fun observeDeadLetterCount(): Flow<Int>

    /** Rows parked in the DLQ, oldest first, for the inspection screen. */
    @Query("SELECT * FROM offline_actions WHERE status = 'DEAD' ORDER BY id ASC")
    suspend fun deadLettered(): List<OfflineActionEntity>

    /**
     * User-initiated second chance: resets an inspected action back to the
     * live queue with a fresh retry budget. Scoped by status='DEAD' so it can
     * never resurrect anything else.
     */
    @Query(
        "UPDATE offline_actions SET status = 'PENDING', retryCount = 0 " +
            "WHERE id = :id AND status = 'DEAD'",
    )
    suspend fun requeueDeadLettered(id: Long)

    @Query("DELETE FROM offline_actions WHERE id = :id")
    suspend fun deleteById(id: Long)

    /**
     * R2 repair: fetch legacy rows (pre-UUID build) that still carry the
     * `''` sentinel after [CrimSysDatabase.MIGRATION_1_2]. Each row gets a
     * DISTINCT UUID before any push — otherwise two legacy rows would share
     * one Firestore document id and silently overwrite each other.
     */
    @Query("SELECT * FROM offline_actions WHERE actionUuid = '' ORDER BY id ASC")
    suspend fun legacyKeyed(): List<OfflineActionEntity>

    /**
     * Assigns a fresh unique key to exactly one legacy row, scoped by [id]
     * so a batch repair can never stamp the same UUID onto multiple rows
     * (the original migration backfill bug).
     */
    @Query("UPDATE offline_actions SET actionUuid = :uuid WHERE id = :id AND actionUuid = ''")
    suspend fun assignUuid(id: Long, uuid: String)
}
