package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LegalSourceDao {

    @Query("SELECT * FROM legal_sources ORDER BY sourceKey ASC")
    fun observeAll(): Flow<List<LegalSourceEntity>>

    /** Registry lookup backing citation validation. */
    @Query("SELECT * FROM legal_sources WHERE sourceKey = :sourceKey LIMIT 1")
    suspend fun findByKey(sourceKey: String): LegalSourceEntity?

    /**
     * Upsert keyed on `sourceKey` (the unique index) so re-registering a
     * source updates it instead of duplicating it.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(sources: List<LegalSourceEntity>)

    /** Row count for the seed-only-when-empty guard. */
    @Query("SELECT COUNT(*) FROM legal_sources")
    suspend fun count(): Int
}
