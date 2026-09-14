package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface EvidenceDao {

    @Insert(
        onConflict = OnConflictStrategy.ABORT,
    )
    suspend fun insert(
        evidence: EvidenceEntity,
    )

    @Query(
        """
        SELECT * FROM evidence
        WHERE originalFileHash = :sha256
        LIMIT 1
        """,
    )
    suspend fun findByOriginalHash(
        sha256: String,
    ): EvidenceEntity?
}
