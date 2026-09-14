package net.crimsys.app.domain.evidence

import java.io.File
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Resource
import net.crimsys.app.data.local.EvidenceEntity

/**
 * Contract for securing captured evidence.
 *
 * One entry point, one pipeline — every guarantee is enforced HERE, not by
 * the caller:
 *
 *   file ──single pass──► SHA-256 + atomic copy into immutable storage
 *        (fsync → read-only → rename)
 *        ──► genesis CAPTURED chain event (embedded custody chain JSON)
 *        ──► Room insert (single source of truth, persisted FIRST)
 *
 * Cold [Flow]: emits [Resource.Loading] while working, then exactly one of
 * [Resource.Success] (the persisted row) or [Resource.Error] — never a
 * crash; every failure path also cleans up partial temp/final files.
 *
 * Note the deliberate honesty of the storage model: the immutable path is
 * UUID-addressed (`evidence/immutable/<uuid>.<ext>`), NOT content-addressed —
 * the UNIQUE `originalFileHash` index means the same bytes can never be
 * registered twice, so a second capture of identical content fails loudly
 * at the Room layer instead of silently deduplicating.
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
}
