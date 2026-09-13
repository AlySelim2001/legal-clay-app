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
     * Exact-match lookup backing [net.crimsys.app.domain.legal.LegalRegistryRepository.findExact].
     *
     * `paragraph IS :paragraph` is SQLite's null-safe equality: passing null
     * matches only article-level rows, passing "3" matches only rows pinned
     * to paragraph 3. The optional lawNumber filter is applied only when
     * non-null. Normalization happens on WRITE (trim at the repository), so
     * the query stays plain indexed equality.
     */
    @Query(
        "SELECT * FROM legal_sources " +
            "WHERE lawName = :lawName " +
            "AND article = :article " +
            "AND paragraph IS :paragraph " +
            "AND (:lawNumber IS NULL OR lawNumber = :lawNumber)",
    )
    suspend fun findExact(
        lawName: String,
        article: String,
        paragraph: String?,
        lawNumber: String?,
    ): List<LegalSourceEntity>

    /** Row count for the seed-only-when-empty guard. */
    @Query("SELECT COUNT(*) FROM legal_sources")
    suspend fun count(): Int

    /**
     * Upsert keyed on the (lawName, article, paragraph) unique index so
     * re-registering an artifact replaces its row instead of duplicating it
     * (duplication would make every citation ambiguous by construction).
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(sources: List<LegalSourceEntity>): List<Long>
}
