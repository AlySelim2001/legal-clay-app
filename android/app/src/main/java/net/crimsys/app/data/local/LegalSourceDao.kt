package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LegalSourceDao {

    @Query("SELECT * FROM legal_sources ORDER BY lawName ASC, article ASC")
    fun observeAll(): Flow<List<LegalSourceEntity>>

    /**
     * Candidate lookup backing citation verification. Normalization is
     * applied on WRITE (trim at the repository), so the query itself is a
     * plain indexed equality on (lawName, article). Paragraph is not part of
     * the lookup: an article-level row answers a paragraph citation.
     */
    @Query(
        "SELECT * FROM legal_sources " +
            "WHERE lawName = :lawName AND article = :article",
    )
    suspend fun findCandidates(lawName: String, article: String): List<LegalSourceEntity>

    /**
     * Upsert keyed on the (lawName, article, paragraph) unique index so
     * re-registering an artifact updates it instead of duplicating it.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(sources: List<LegalSourceEntity>): List<Long>

    /** Row count for the seed-only-when-empty guard. */
    @Query("SELECT COUNT(*) FROM legal_sources")
    suspend fun count(): Int
}
