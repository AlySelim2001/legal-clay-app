package net.crimsys.app.domain.legal

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.LegalSourceEntity

/**
 * Contract for the authoritative-source registry: the local catalogue of
 * Egyptian legal sources the practice treats as citable.
 *
 * Registry rule (Evidence-First): only sources that passed publisher +
 * version verification may be upserted here. A GitHub repo or scraped page is
 * NOT automatically authoritative — the caller (review workflow) owns that
 * decision; this repository only persists and serves the approved set.
 *
 * Note: contracts expose Room entities directly, matching the existing
 * project precedent (`CaseRepository` exposes `CaseEntity`) — Room is the
 * single source of truth and the UI maps for display if needed.
 */
interface LegalRegistryRepository {
    /** Reactive registry contents ordered by source key. */
    fun observeSources(): Flow<List<LegalSourceEntity>>

    /** One registered source by stable key, or null when unknown. */
    suspend fun findSourceByKey(sourceKey: String): LegalSourceEntity?

    /**
     * Idempotent registry write (upsert by [LegalSourceEntity.sourceKey]).
     * Updates `updatedAt` to the wall clock; existing rows with the same key
     * are replaced — registry keys are immutable identities by convention.
     */
    suspend fun upsertSources(sources: List<LegalSourceEntity>): Result<Unit>

    /**
     * First-run seed: writes [defaults] ONLY when the registry is empty, so
     * re-seeding can never silently resurrect a source the practice removed.
     *
     * @return number of rows actually seeded (0 when the registry was
     * already populated).
     */
    suspend fun seedDefaultsIfEmpty(defaults: List<LegalSourceEntity>): Result<Int>
}
