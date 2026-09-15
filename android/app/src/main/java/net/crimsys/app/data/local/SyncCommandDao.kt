package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface SyncCommandDao {

    @Insert(
        onConflict = OnConflictStrategy.ABORT,
    )
    suspend fun insert(
        command: SyncCommandEntity,
    )

    @Query(
        """
        SELECT * FROM sync_commands
        WHERE status = 'PENDING'
          AND (
              nextAttemptAtEpochMillis IS NULL
              OR nextAttemptAtEpochMillis <= :now
          )
        ORDER BY createdAtEpochMillis ASC,
                 commandId ASC
        LIMIT 1
        """,
    )
    suspend fun nextReady(
        now: Long,
    ): SyncCommandEntity?

    @Query(
        """
        UPDATE sync_commands
        SET attemptCount = attemptCount + 1,
            lastError = :error,
            nextAttemptAtEpochMillis = :nextAttemptAt,
            status = 'PENDING'
        WHERE commandId = :commandId
          AND status = 'PENDING'
        """,
    )
    suspend fun recordRetry(
        commandId: String,
        error: String,
        nextAttemptAt: Long,
    )

    @Query(
        """
        UPDATE sync_commands
        SET status = 'DEAD',
            lastError = :error
        WHERE commandId = :commandId
          AND status = 'PENDING'
        """,
    )
    suspend fun markDead(
        commandId: String,
        error: String,
    )

    @Query(
        """
        UPDATE sync_commands
        SET status = 'CONFLICT',
            lastError = :error
        WHERE commandId = :commandId
          AND status = 'PENDING'
        """,
    )
    suspend fun markConflict(
        commandId: String,
        error: String,
    )

    @Query(
        """
        DELETE FROM sync_commands
        WHERE commandId = :commandId
        """,
    )
    suspend fun deleteAccepted(
        commandId: String,
    )

    @Query(
        "SELECT COUNT(*) FROM sync_commands WHERE status = 'PENDING'",
    )
    suspend fun pendingCount(): Int

    @Query(
        "SELECT COUNT(*) FROM sync_commands WHERE status = 'DEAD'",
    )
    suspend fun deadCount(): Int
}
