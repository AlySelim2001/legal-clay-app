package net.crimsys.app.domain.evidence

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result

/**
 * Contract for the evidence chain-of-custody store.
 *
 * Room is the single source of truth (project rule): every mutation is
 * persisted locally FIRST and pushed to Firestore behind the Sync Command
 * Queue when connectivity allows. Reads never touch the network.
 *
 * Storage model: one `evidence` row per captured item ([RegisterEvidenceInput])
 * with the full custody chain embedded as JSON ([ChainOfCustody]) — appends
 * re-serialize the chain in place, so the head always moves with the event.
 * Content addressing: [EvidenceSummary.originalFileHash] is also the file's
 * storage identity ([EvidenceRepository] computes it via streaming
 * [net.crimsys.app.core.evidence.Sha256] and stores the bytes at a
 * content-addressed path), which makes registration idempotent on bytes.
 */
interface EvidenceRepository {

    /** Reactive evidence list for one case, in capture order (oldest first). */
    fun observeForCase(caseId: String): Flow<List<EvidenceSummary>>

    /** Reactive, append-ordered custody chain of one evidence item. */
    fun observeChain(evidenceId: String): Flow<List<ChainEvent>>

    /**
     * Registers a captured item: computes the content digest HERE (callers
     * hand over raw bytes, never hashes), stores the bytes at their
     * content-addressed path, and appends the genesis CAPTURED event.
     *
     * Idempotent on content: registering bytes that already exist returns the
     * existing record ([Registration.alreadyRegistered]) instead of a second
     * row — the UNIQUE index on `originalFileHash` makes duplicates
     * structurally impossible.
     */
    suspend fun registerEvidence(input: RegisterEvidenceInput): Result<Registration>

    /** Records (or clears) the OCR/pipeline output digest for one item. */
    suspend fun setProcessedHash(evidenceId: String, processedHash: String?): Result<Unit>

    /**
     * Appends [action] as the new chain head: links are computed HERE from
     * the live head via [net.crimsys.app.core.evidence.ChainEventHasher.create]
     * — the caller supplies the semantic action, never the links.
     *
     * Implementations MUST reject appends whose timestamp is older than the
     * current head's [ChainEvent.timestampEpochMillis] with a [Result.Error]
     * ([net.crimsys.app.core.AppError.Validation]): the chain records human
     * time, and silently accepting out-of-order timestamps would produce a
     * chain whose narrative contradicts its order.
     */
    suspend fun appendEvent(
        evidenceId: String,
        action: ChainAction,
    ): Result<ChainEvent>

    /**
     * Head-to-genesis walk of the embedded chain: re-derives every link from
     * its (action, timestamp, previousHash) bound to the row's
     * `originalFileHash` and compares against the stored event. This is a
     * READ-SIDE check — nothing is appended as a result. A custody column
     * that fails to decode is itself a verification failure
     * ([ChainVerification.brokenAtIndex] = 0), never a crash.
     */
    suspend fun verifyChain(evidenceId: String): Result<ChainVerification>

    /** Input for [registerEvidence] — raw evidence bytes, never a hash. */
    data class RegisterEvidenceInput(
        val caseId: String,
        val mimeType: String,
        val content: ByteArray,
        val capturedAtEpochMillis: Long,
    )

    /** Outcome of [registerEvidence]. */
    data class Registration(
        val evidenceId: String,
        /** True when the bytes were already registered (dedup hit). */
        val alreadyRegistered: Boolean,
    )

    /** Lightweight row for lists; full detail is the chain itself. */
    data class EvidenceSummary(
        val id: String,
        val caseId: String,
        val originalFileHash: String,
        val processedFileHash: String?,
        val mimeType: String,
        val captureTimestamp: Long,
        val eventCount: Int,
        /** Current chain head hash — null only for an undecodable custody column. */
        val chainHeadHash: String?,
    )

    /** Outcome of [verifyChain]. */
    data class ChainVerification(
        val evidenceId: String,
        val valid: Boolean,
        /** Head-to-genesis walk: number of events inspected. */
        val inspectedEvents: Int,
        /** Append-order position of the first broken link, when invalid. */
        val brokenAtIndex: Int?,
    )
}
