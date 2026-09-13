package net.crimsys.app.domain.legal

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.LegalSourceEntity

/**
 * One registered legal source as the domain sees it: the citable
 * [LegalCitation] plus the human-review flag that gates verification
 * ([net.crimsys.app.domain.legal.RejectionReason.SOURCE_NOT_VERIFIED]).
 *
 * `id` is the persistence row id — meaningless to the domain, kept for the
 * review workflow to address a specific entry.
 */
data class RegistryEntry(
    val citation: LegalCitation,
    val verified: Boolean,
    val id: Long,
)

/**
 * Contract for the authoritative-source registry: the local catalogue of
 * Egyptian legal artifacts the practice treats as citable.
 *
 * Registry rule (Evidence-First): only sources that passed publisher +
 * version verification may be stored here with `verified = true`. A GitHub
 * repo or a scraped page is NOT automatically authoritative — the review
 * workflow owns that decision; this repository only persists and serves the
 * approved set.
 *
 * Note: storage entities cross the boundary (existing project precedent —
 * `CaseRepository` exposes `CaseEntity`); domain-facing reads are expressed
 * as [RegistryEntry].
 */
interface LegalRegistryRepository {
    /** Reactive registry contents ordered by law name, then article. */
    fun observeEntries(): Flow<List<RegistryEntry>>

    /**
     * Candidates for verifying one parsed citation: rows whose normalized
     * law name and article match. Verification then requires EXACTLY one
     * candidate — zero is [RejectionReason.NO_SOURCE_MATCH], more than one is
     * [RejectionReason.AMBIGUOUS_SOURCE_MATCH].
     */
    suspend fun findCandidates(lawName: String, article: String): List<RegistryEntry>

    /**
     * Idempotent registry write (upsert on the entity's unique natural key).
     * Returns the persisted row ids in input order.
     */
    suspend fun upsertEntries(entries: List<RegistryEntry>): Result<List<Long>>

    /**
     * First-run seed: writes [defaults] ONLY when the registry is empty, so
     * re-seeding can never silently resurrect a source the practice removed.
     *
     * @return number of rows actually seeded (0 when the registry was
     * already populated).
     */
    suspend fun seedDefaultsIfEmpty(entries: List<RegistryEntry>): Result<Int>
}
