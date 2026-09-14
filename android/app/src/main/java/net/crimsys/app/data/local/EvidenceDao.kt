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

    // -------------------------------------------------- repository-backed
    // Members below exist because the EvidenceRepository pipeline requires
    // them; each is annotated with its contract method.

    /** Backs [net.crimsys.app.domain.evidence.EvidenceRepository.recordOcrProcessing]. */
    @Query(
        "SELECT * FROM evidence WHERE id = :id LIMIT 1",
    )
    suspend fun findById(
        id: String,
    ): EvidenceEntity?

    /**
     * Backs [net.crimsys.app.domain.evidence.EvidenceRepository.recordOcrProcessing] —
     * the processed hash and the extended chain land in ONE UPDATE, so the
     * chain head always moves with the stamp (never half-committed).
     */
    @Query(
        """
        UPDATE evidence
        SET processedFileHash = :processedFileHash,
            chainOfCustodyJson = :chainOfCustodyJson
        WHERE id = :id
        """,
    )
    suspend fun updateProcessed(
        id: String,
        processedFileHash: String,
        chainOfCustodyJson: String,
    )
}
