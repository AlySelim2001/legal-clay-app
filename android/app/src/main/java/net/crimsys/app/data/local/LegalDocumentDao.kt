package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LegalDocumentDao {
    @Query(
        """
        SELECT * FROM legal_documents
        WHERE verified = 1
          AND (
            :query = '' OR
            lower(title) LIKE '%' || lower(:query) || '%' OR
            lower(COALESCE(lawNumber, '')) LIKE '%' || lower(:query) || '%' OR
            lower(COALESCE(articleNumber, '')) LIKE '%' || lower(:query) || '%' OR
            lower(body) LIKE '%' || lower(:query) || '%'
          )
        ORDER BY title COLLATE NOCASE ASC, articleNumber COLLATE NOCASE ASC
        LIMIT :limit
        """,
    )
    fun observeSearch(query: String, limit: Int): Flow<List<LegalDocumentEntity>>

    @Query("SELECT * FROM legal_documents WHERE id = :id AND verified = 1 LIMIT 1")
    fun observeById(id: String): Flow<LegalDocumentEntity?>

    @Query("SELECT COUNT(*) FROM legal_documents WHERE verified = 1")
    suspend fun countVerified(): Int
}
