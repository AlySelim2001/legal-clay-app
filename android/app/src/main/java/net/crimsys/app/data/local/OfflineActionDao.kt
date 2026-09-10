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
