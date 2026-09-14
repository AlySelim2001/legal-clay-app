package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Evidence store. Dedup is structural: the UNIQUE index on
 * `originalFileHash` plus [Insert][OnConflictStrategy.ABORT] means a second
 * row for the same content fails loudly — callers turn the probe
 * ([findByOriginalHash]) into idempotent registration, and REPLACE's silent
 * delete-then-insert (unacceptable for custody data) is impossible here.
 */
@Dao
interface EvidenceDao {

    @Insert(
        onConflict = OnConflictStrategy.ABORT,
    )
    suspend fun insert(
        evidence: EvidenceEntity,
    )

    @Query(
        "SELECT * FROM evidence WHERE id = :id LIMIT 1",
    )
    suspend fun findById(
        id: String,
    ): EvidenceEntity?

    @Query(
        """
        SELECT * FROM evidence
        WHERE caseId = :caseId
        ORDER BY captureTimestamp ASC
        """,
    )
    fun observeForCase(
        caseId: String,
    ): Flow<List<EvidenceEntity>>

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
    // The three members below exist only because the EvidenceRepository
    // contract requires them; each is annotated with its contract method.

    /** Backs [net.crimsys.app.domain.evidence.EvidenceRepository.observeChain]. */
    @Query(
        "SELECT * FROM evidence WHERE id = :id LIMIT 1",
    )
    fun observeById(
        id: String,
    ): Flow<EvidenceEntity?>

    /**
     * Backs [net.crimsys.app.domain.evidence.EvidenceRepository.appendEvent] —
     * the whole embedded chain re-serializes in one UPDATE, so the head always
     * moves with the event (no cross-table transaction to half-commit).
     */
    @Query(
        "UPDATE evidence SET chainOfCustodyJson = :chainOfCustodyJson WHERE id = :id",
    )
    suspend fun updateChainOfCustody(
        id: String,
        chainOfCustodyJson: String,
    )

    /** Backs [net.crimsys.app.domain.evidence.EvidenceRepository.setProcessedHash]. */
    @Query(
        "UPDATE evidence SET processedFileHash = :processedFileHash WHERE id = :id",
    )
    suspend fun setProcessedFileHash(
        id: String,
        processedFileHash: String?,
    )
}
