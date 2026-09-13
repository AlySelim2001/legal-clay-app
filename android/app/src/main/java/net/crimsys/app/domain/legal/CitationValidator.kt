package net.crimsys.app.domain.legal

import javax.inject.Inject

/**
 * Why a citation failed validation. Ordered for display: structural problems
 * first, then registry problems, then temporal problems.
 */
enum class CitationIssue {
    EMPTY_SOURCE_KEY,
    EMPTY_TITLE,
    EMPTY_PUBLISHER,
    EMPTY_REFERENCE,
    /** No source with this key exists in the legal registry. */
    UNKNOWN_SOURCE,
    /** retrievedAtEpochMs is not a plausible epoch-milliseconds value. */
    INVALID_RETRIEVAL_TIME,
    /** Citation publisher differs from the registered source's publisher. */
    PUBLISHER_MISMATCH,
    /** The citation claims retrieval before the authority entered force. */
    EFFECTIVE_AFTER_RETRIEVAL,
}

/** Outcome of validating one [LegalCitation]. */
data class CitationVerdict(
    val citation: LegalCitation,
    val issues: List<CitationIssue>,
) {
    /** A citation is valid ONLY with zero issues — no warnings tier exists. */
    val isValid: Boolean get() = issues.isEmpty()
}

/**
 * Citation gate: nothing citing the law leaves this app without proving
 * where the authority came from.
 */
interface CitationValidator {
    suspend fun validate(citation: LegalCitation): CitationVerdict
}

/**
 * Registry-backed implementation. Pure domain: depends only on the
 * [LegalRegistryRepository] interface; bound in
 * `net.crimsys.app.di.HarisCoreModule`.
 */
class RegistryBackedCitationValidator @Inject constructor(
    private val registry: LegalRegistryRepository,
) : CitationValidator {

    override suspend fun validate(citation: LegalCitation): CitationVerdict {
        val issues = buildList {
            if (citation.sourceKey.isBlank()) add(CitationIssue.EMPTY_SOURCE_KEY)
            if (citation.title.isBlank()) add(CitationIssue.EMPTY_TITLE)
            if (citation.publisher.isBlank()) add(CitationIssue.EMPTY_PUBLISHER)
            if (citation.reference.isBlank()) add(CitationIssue.EMPTY_REFERENCE)
            if (citation.retrievedAtEpochMs <= 0) add(CitationIssue.INVALID_RETRIEVAL_TIME)
        }
        // Registry lookup is meaningless without a key, and temporal checks
        // without a plausible retrieval time would be noise.
        if (CitationIssue.EMPTY_SOURCE_KEY in issues ||
            CitationIssue.INVALID_RETRIEVAL_TIME in issues
        ) {
            return CitationVerdict(citation, issues)
        }

        val source = registry.findSourceByKey(citation.sourceKey.trim())
            ?: return CitationVerdict(citation, issues + CitationIssue.UNKNOWN_SOURCE)

        return CitationVerdict(citation, issues + crossChecks(citation, source))
    }

    private fun crossChecks(
        citation: LegalCitation,
        source: net.crimsys.app.data.local.LegalSourceEntity,
    ): List<CitationIssue> = buildList {
        if (!citation.publisher.trim().equals(source.publisher.trim(), ignoreCase = true)) {
            add(CitationIssue.PUBLISHER_MISMATCH)
        }
        val effective = source.effectiveAtEpochMs
        if (effective != null && citation.retrievedAtEpochMs < effective) {
            add(CitationIssue.EFFECTIVE_AFTER_RETRIEVAL)
        }
    }
}
