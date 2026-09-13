package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Queue access for [net.crimsys.app.data.sync.SyncWorker]. Mirrors the
 * OfflineActionDao conventions: FIFO by id, scoped dead-letter transitions,
 * zero destructive deletes.
 */
@Dao
interface SyncCommandDao {

    @Insert
    suspend fun enqueue(command: SyncCommandEntity): Long

    /** Live queue, FIFO. */
    @Query("SELECT * FROM sync_commands WHERE status = 'PENDING' ORDER BY id ASC")
    suspend fun pendingInOrder(): List<SyncCommandEntity>

    /** Reactive queue depth for the sync badge. */
    @Query("SELECT COUNT(*) FROM sync_commands WHERE status = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    @Query("UPDATE sync_commands SET retryCount = retryCount + 1 WHERE id = :id")
    suspend fun incrementRetry(id: Long)

    /**
     * Park an exhausted command. The `status = 'PENDING'` guard means a
     * concurrent retry can never dead-letter a healthy row; the row is KEPT
     * for inspection (zero data loss).
     */
    @Query(
        "UPDATE sync_commands SET status = 'DEAD' " +
            "WHERE id = :id AND status = 'PENDING' AND retryCount >= maxRetries",
    )
    suspend fun markDeadLetter(id: Long)

    /** Dead-letter size for the warning badge. */
    @Query("SELECT COUNT(*) FROM sync_commands WHERE status = 'DEAD'")
    fun observeDeadLetterCount(): Flow<Int>

    /** Rows parked for inspection, oldest first. */
    @Query("SELECT * FROM sync_commands WHERE status = 'DEAD' ORDER BY id ASC")
    suspend fun deadLettered(): List<SyncCommandEntity>

    /** User-initiated second chance with a fresh retry budget. */
    @Query(
        "UPDATE sync_commands SET status = 'PENDING', retryCount = 0 " +
            "WHERE id = :id AND status = 'DEAD'",
    )
    suspend fun requeueDeadLettered(id: Long)

    /**
     * Park a permanently broken command (corrupt envelope, digest mismatch)
     * immediately instead of burning retry windows on a row that can never
     * succeed. Scoped by status='PENDING' so it can never double-park.
     */
    @Query("UPDATE sync_commands SET status = 'DEAD' WHERE id = :id AND status = 'PENDING'")
    suspend fun parkCorrupt(id: Long)

    @Query("DELETE FROM sync_commands WHERE id = :id AND status = 'PENDING'")
    suspend fun deleteById(id: Long)
}
