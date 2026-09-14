package net.crimsys.app.domain.evidence

import java.io.File
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Resource
import net.crimsys.app.data.local.EvidenceEntity

/**
 * Contract for securing captured evidence and its derivatives.
 *
 * Two stages, one custody discipline — every guarantee is enforced HERE,
 * not by the caller:
 *
 *   1. CAPTURE
 *      file ──single pass──► SHA-256 + atomic copy into immutable storage
 *           (fsync → read-only → rename)
 *           ──► genesis CAPTURED chain event (embedded custody chain JSON)
 *           ──► Room insert (single source of truth, persisted FIRST)
 *
 *   2. OCR PROCESSING
 *      original ──► processed artifact ──► new hash
 *           ──► OCR_PROCESSED event appended from the live chain head,
 *           bound to the new hash, + processedFileHash stamped —
 *           in ONE atomic UPDATE
 *
 * Cold [Flow]s: emit [Resource.Loading] while working, then exactly one of
 * [Resource.Success] (the persisted row) or [Resource.Error] — never a
 * crash; every failure path also cleans up partial temp/final files.
 *
 * Storage model: immutable paths are UUID-addressed
 * (`evidence/immutable/<id>.<ext>`, processed output `<id>.ocr.<ext>`),
 * NOT content-addressed — the UNIQUE `originalFileHash` index means the
 * same bytes can never be registered twice, so a second capture of
 * identical content fails loudly at the Room layer instead of silently
 * deduplicating.
 */
interface EvidenceRepository {

    /**
     * Secures [file] into immutable evidence storage for [caseId] and
     * persists the custody row. The returned flow is cold: nothing happens
     * until collection begins, and the work runs off the main thread.
     */
    fun captureAndSecureEvidence(
        file: File,
        caseId: UUID,
    ): Flow<Resource<EvidenceEntity>>

    /**
     * Records the OCR stage for an already-captured item: secures the
     * processed artifact under the same immutable discipline, stamps
     * [EvidenceEntity.processedFileHash] with the NEW hash, and appends a
     * [ChainAction.OCR_PROCESSED] event bound to that hash from the live
     * chain head.
     *
     * One processed derivative per evidence item — a second call fails with
     * [Resource.Error] rather than muddying the custody lineage.
     */
    fun recordOcrProcessing(
        evidenceId: String,
        processedFile: File,
    ): Flow<Resource<EvidenceEntity>>
}
