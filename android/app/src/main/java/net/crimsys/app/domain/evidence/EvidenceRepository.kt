package net.crimsys.app.domain.evidence

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result

/**
 * Contract for the evidence chain-of-custody store.
 *
 * Room is the single source of truth (project rule): every mutation is
 * appended locally FIRST and pushed to Firestore behind the Offline Action
 * Queue when connectivity allows. Reads never touch the network.
 */
interface EvidenceRepository {
    /** Reactive list of known evidence items, newest first. */
    fun observeEvidence(): Flow<List<EvidenceSummary>>

    /** Reactive, append-ordered chain for one evidence item. */
    fun observeChain(evidenceId: String): Flow<List<ChainEvent>>

    /**
     * Registers a new evidence item and appends its first event
     * ([ChainEvent.Kind.CAPTURED]) with a freshly computed [sha256Hex].
     *
     * Legal invariant: the item and its first chain event are persisted
     * ATOMICALLY. An evidence record without its capture event, or a capture
     * event without its item, is an integrity defect.
     */
    suspend fun captureEvidence(input: CaptureEvidenceInput): Result<String>

    /**
     * Appends [event] to the chain of [evidenceId] as the new head: the
     * repository computes `previousEventHash` from the current head and the
     * `eventHash` via [net.crimsys.app.core.evidence.ChainEventHasher] — the
     * caller supplies the semantic content, never the links.
     *
     * Implementations MUST reject appends whose timestamp is older than the
     * current head's [ChainEvent.occurredAtEpochMs] with a [Result.Error]
     * ([net.crimsys.app.core.AppError.Validation]): the chain records human
     * time, and silently accepting out-of-order timestamps would produce a
     * chain whose narrative contradicts its order.
     */
    suspend fun appendEvent(
        evidenceId: String,
        kind: String,
        payload: ByteArray? = null,
        offline: Boolean = false,
    ): Result<ChainEvent>

    /**
     * Recomputes the full chain from head to genesis. Any mismatch breaks
     * verification. The result is itself appended as a
     * [ChainEvent.Kind.HASH_VERIFIED] event on success, so verification is
     * part of the auditable record.
     */
    suspend fun verifyChain(evidenceId: String): Result<ChainVerification>

    /** Evidence content known to the domain layer (created via [captureEvidence]). */
    data class CaptureEvidenceInput(
        val label: String,
        val sha256Hex: String,
        val capturedAtEpochMs: Long,
        val offline: Boolean,
    )

    /** Lightweight row for lists; full detail is the chain itself. */
    data class EvidenceSummary(
        val id: String,
        val label: String,
        val sha256Hex: String,
        val capturedAtEpochMs: Long,
        val isSynced: Boolean,
        val eventCount: Int,
    )

    /** Outcome of [verifyChain]. */
    data class ChainVerification(
        val evidenceId: String,
        val valid: Boolean,
        /** Head-to-genesis walk of event ids, for the audit report. */
        val inspectedEvents: Int,
        /** Hash of the broken link when [valid] is false, else null. */
        val brokenAtEventId: String?,
    )
}
