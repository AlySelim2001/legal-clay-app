package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface OfflineActionDao {

    @Insert
    suspend fun enqueue(action: OfflineActionEntity): Long

    /** Queue snapshot for the sync badge — reactive so the UI updates live. */
    @Query("SELECT COUNT(*) FROM offline_actions")
    fun observePendingCount(): Flow<Int>

    /** Drained in insertion order (FIFO) by SyncManager. */
    @Query("SELECT * FROM offline_actions ORDER BY id ASC")
    suspend fun pendingInOrder(): List<OfflineActionEntity>

    @Query("UPDATE offline_actions SET retryCount = retryCount + 1 WHERE id = :id")
    suspend fun incrementRetry(id: Long)

    @Query("DELETE FROM offline_actions WHERE id = :id")
    suspend fun deleteById(id: Long)

    /**
     * One-time repair for rows enqueued by the pre-R2 build, whose
     * `actionUuid` column is NULL after [net.crimsys.app.data.local.MIGRATION_1_2]
     * runs. Called defensively by SyncManager before every drain.
     */
    @Query("UPDATE offline_actions SET actionUuid = :uuid WHERE actionUuid IS NULL")
    suspend fun repairMissingUuids(uuid: String)
}
