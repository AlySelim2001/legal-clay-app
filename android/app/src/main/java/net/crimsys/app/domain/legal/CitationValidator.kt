package net.crimsys.app.domain.legal

import java.net.URI
import java.time.LocalDate
import javax.inject.Inject

/**
 * Citation gate: verifies a parsed citation against the authoritative
 * registry before any statement citing the law leaves this app.
 *
 * The registry is TEMPORALLY VERSIONED — one article may have several
 * verified rows (amendments, replacements), each with its own validity
 * window. Verification therefore resolves WHICH version was in force on the
 * event date, then checks that version's integrity:
 *
 * 1. format (`UNSUPPORTED_CITATION_FORMAT`) — law name and article required;
 * 2. registry match (`NO_SOURCE_MATCH`) — no verified row for the exact
 *    (law, article[, paragraph]) citation at all;
 * 3. temporal filter (`NOT_EFFECTIVE_ON_EVENT_DATE`) — rows exist but none
 *    covers the event date (checked against the EVENT date, never today);
 * 4. ambiguity (`AMBIGUOUS_SOURCE_MATCH`) — MORE THAN ONE version covers the
 *    event date (overlapping windows). Disjoint windows are history, not
 *    ambiguity: they resolve in step 3's filter.
 * 5. integrity of the single resolved version (`SOURCE_HASH_INVALID`,
 *    `SOURCE_URL_INVALID`).
 *
 * A rejected citation reports the earliest blocking problem, never a blend.
 * Integrity is checked only AFTER resolution because the subject of those
 * checks (which artifact digest/URL) is undefined until one version wins.
 *
 * Note on [RejectionReason.SOURCE_NOT_VERIFIED]: the DAO filters
 * `verified = 1`, so unreviewed rows can never surface here — an unverified
 * artifact is simply not part of the citable set and shows up as
 * `NO_SOURCE_MATCH`. The enum value remains for the review workflow, which
 * reports it before a source is admitted to the registry.
 */
interface CitationValidator {
    /**
     * Verifies [parsed] as of [eventDate] — the date of the procedural event
     * the citation is used for, NOT today, so a memo can safely cite the law
     * in force when the events occurred.
     */
    suspend fun verify(parsed: ParsedLegalCitation, eventDate: LocalDate): VerificationResult
}

/**
 * Registry-backed implementation. Pure domain: depends only on the
 * [LegalRegistryRepository] interface; bound in
 * `net.crimsys.app.di.HarisCoreModule`.
 */
class RegistryBackedCitationValidator @Inject constructor(
    private val registry: LegalRegistryRepository,
) : CitationValidator {

    override suspend fun verify(parsed: ParsedLegalCitation, eventDate: LocalDate): VerificationResult {
        val lawName = parsed.lawName.trim()
        val article = parsed.article.trim()
        if (lawName.isEmpty() || article.isEmpty()) {
            return VerificationResult.Rejected(parsed, RejectionReason.UNSUPPORTED_CITATION_FORMAT)
        }

        val versions = registry.findExact(
            lawName = lawName,
            article = article,
            paragraph = parsed.paragraph?.trim(),
            lawNumber = null, // the parser keeps the law number inside the law name
        )
        if (versions.isEmpty()) {
            return VerificationResult.Rejected(parsed, RejectionReason.NO_SOURCE_MATCH)
        }

        // Resolve the version(s) in force on the event date. Disjoint
        // windows collapse to one here; overlapping windows stay > 1 and are
        // reported as ambiguity — the registry itself is inconsistent.
        val effective = versions.filter { registry.isEffective(it, eventDate) }
        if (effective.isEmpty()) {
            return VerificationResult.Rejected(parsed, RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE)
        }
        if (effective.size > 1) {
            return VerificationResult.Rejected(parsed, RejectionReason.AMBIGUOUS_SOURCE_MATCH)
        }

        val citation = effective.first()
        if (!isValidSha256(citation.sourceSha256)) {
            return VerificationResult.Rejected(parsed, RejectionReason.SOURCE_HASH_INVALID)
        }
        if (!isValidHttpUrl(citation.officialSourceUrl)) {
            return VerificationResult.Rejected(parsed, RejectionReason.SOURCE_URL_INVALID)
        }

        return VerificationResult.Verified(citation)
    }

    /** Lowercase or uppercase hex is accepted; anything else is invalid. */
    private fun isValidSha256(hex: String): Boolean =
        hex.length == 64 && hex.all { it in "0123456789abcdef" || it in "ABCDEF" }

    private fun isValidHttpUrl(url: String): Boolean = try {
        val scheme = URI(url.trim()).scheme?.lowercase()
        scheme == "http" || scheme == "https"
    } catch (t: Throwable) {
        if (t is kotlinx.coroutines.CancellationException) throw t
        false
    }
}
