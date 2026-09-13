package net.crimsys.app.domain.legal

import java.time.LocalDate

/**
 * Lookup contract for the authoritative legal registry.
 *
 * `findExact` is an EXACT match, never fuzzy: (lawName, article, paragraph)
 * must coincide with a registered row, with `paragraph = null` matching only
 * article-level rows (null-safe) — so a citation that names no paragraph can
 * never be satisfied by a paragraph-level row and vice versa. Returning more
 * than one citation means the registry itself is ambiguous; the validator
 * rejects with [RejectionReason.AMBIGUOUS_SOURCE_MATCH].
 *
 * `isEffective` is the temporal gate: the validity window
 * ([LegalCitation.effectiveFrom] / [effectiveTo], null = still in force) is
 * checked against the EVENT date — the date of the procedural event the
 * citation supports, never "today".
 */
interface LegalRegistryRepository {

    suspend fun findExact(
        lawName: String,
        article: String,
        paragraph: String?,
        lawNumber: String? = null,
    ): List<LegalCitation>

    suspend fun isEffective(
        citation: LegalCitation,
        eventDate: LocalDate,
    ): Boolean
}
