package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface LegalSourceDao {

    @Query(
        """
        SELECT * FROM legal_sources
        WHERE lawName = :lawName
          AND article = :article
          AND paragraph IS NULL
          AND verified = 1
        ORDER BY effectiveFromEpochDay DESC
        """,
    )
    suspend fun findArticleSources(
        lawName: String,
        article: String,
    ): List<LegalSourceEntity>

    @Query(
        """
        SELECT * FROM legal_sources
        WHERE lawName = :lawName
          AND article = :article
          AND paragraph = :paragraph
          AND verified = 1
        ORDER BY effectiveFromEpochDay DESC
        """,
    )
    suspend fun findParagraphSources(
        lawName: String,
        article: String,
        paragraph: String,
    ): List<LegalSourceEntity>

    @Query(
        """
        SELECT * FROM legal_sources
        WHERE lawNumber = :lawNumber
          AND lawName = :lawName
          AND article = :article
          AND paragraph IS NULL
          AND verified = 1
        ORDER BY effectiveFromEpochDay DESC
        """,
    )
    suspend fun findByLawNumberAndArticle(
        lawNumber: String,
        lawName: String,
        article: String,
    ): List<LegalSourceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(
        sources: List<LegalSourceEntity>,
    )

    @Query("DELETE FROM legal_sources")
    suspend fun deleteAll()

    @Query(
        "SELECT COUNT(*) FROM legal_sources WHERE verified = 1",
    )
    suspend fun countVerified(): Int
}
