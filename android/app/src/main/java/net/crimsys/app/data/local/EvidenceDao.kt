package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Evidence store — one content-addressed row per captured item.
 *
 * The chain of custody lives ON the row ([EvidenceEntity.chainOfCustodyJson])
 * rather than in a separate table: appends re-serialize the whole chain into
 * the single `chainOfCustodyJson` column, so the head ALWAYS moves with the
 * event — no cross-table transaction to half-commit, no head/counter columns
 * to drift.
 *
 * Dedup is enforced by the UNIQUE index on `originalFileHash`: [insert]
 * aborts loudly on a duplicate hash instead of silently destroying the
 * existing row (OnConflictStrategy.REPLACE would DELETE the conflicting
 * evidence row first — never acceptable for custody data). Callers use
 * [findByOriginalHash] to turn that collision into idempotent registration.
 */
@Dao
interface EvidenceDao {

    /** Evidence of one case, newest first. */
    @Query("SELECT * FROM evidence WHERE caseId = :caseId ORDER BY captureTimestamp DESC")
    fun observeForCase(caseId: String): Flow<List<EvidenceEntity>>

    /** Whole evidence registry, newest first. */
    @Query("SELECT * FROM evidence ORDER BY captureTimestamp DESC")
    fun observeAll(): Flow<List<EvidenceEntity>>

    @Query("SELECT * FROM evidence WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): EvidenceEntity?

    /** Reactive single row — drives the chain observation screen. */
    @Query("SELECT * FROM evidence WHERE id = :id LIMIT 1")
    fun observeById(id: String): Flow<EvidenceEntity?>

    /**
     * Content dedup probe — the UNIQUE index on `originalFileHash` means at
     * most one row can ever match.
     */
    @Query("SELECT * FROM evidence WHERE originalFileHash = :hash LIMIT 1")
    suspend fun findByOriginalHash(hash: String): EvidenceEntity?

    /**
     * Plain INSERT (no REPLACE): a primary-key collision means the row is
     * already registered (the caller re-checked above), and a hash collision
     * trips the UNIQUE index as a loud constraint failure — mapped upstream
     * to a duplicate-registration outcome, never a silent overwrite.
     */
    @Insert
    suspend fun insert(evidence: EvidenceEntity)

    /** Atomic custody append: the new chain JSON replaces the old in one UPDATE. */
    @Query("UPDATE evidence SET chainOfCustodyJson = :json WHERE id = :id")
    suspend fun updateChainOfCustody(id: String, json: String)

    /** OCR/pipeline hook — null clears a previously recorded processed hash. */
    @Query("UPDATE evidence SET processedFileHash = :processedFileHash WHERE id = :id")
    suspend fun setProcessedFileHash(id: String, processedFileHash: String?)
}
