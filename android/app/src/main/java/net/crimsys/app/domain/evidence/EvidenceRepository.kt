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
 *   file ──streamed──► SHA-256 (computed HERE — callers never supply hashes)
 *        ──► content-addressed immutable copy (`evidence/<sha256>.<ext>`)
 *        ──► genesis CAPTURED chain event (embedded custody chain)
 *        ──► Room insert (single source of truth, persisted FIRST)
 *        ──► sync-command snapshot (offline-first drain)
 *
 * Cold [Flow]: emits [Resource.Loading] while working, then exactly one of
 * [Resource.Success] (the persisted row) or [Resource.Error]. Capture is
 * idempotent on bytes — content already registered resolves to the existing
 * row, and the UNIQUE index on `originalFileHash` makes duplicates
 * structurally impossible.
 */
interface EvidenceRepository {

    fun captureAndSecureEvidence(
        file: File,
        caseId: UUID,
    ): Flow<Resource<EvidenceEntity>>
}
