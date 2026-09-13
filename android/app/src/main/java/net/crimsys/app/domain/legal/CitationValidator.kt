package net.crimsys.app.domain.legal

import java.net.URI
import java.time.LocalDate
import javax.inject.Inject

/**
 * Citation gate: verifies a parsed citation against the authoritative
 * registry before any statement citing the law leaves this app.
 *
 * Verification is FIRST-FAIL in the order of [RejectionReason] — a rejected
 * citation reports the earliest blocking problem, never a blend:
 *
 * 1. format (`UNSUPPORTED_CITATION_FORMAT`) — law name and article required;
 * 2. registry match (`NO_SOURCE_MATCH` / `AMBIGUOUS_SOURCE_MATCH`) — the
 *    exact (lawName, article, paragraph) lookup must resolve to exactly one
 *    registered artifact;
 * 3. artifact integrity (`SOURCE_HASH_INVALID`) and provenance
 *    (`SOURCE_URL_INVALID`);
 * 4. temporal validity (`NOT_EFFECTIVE_ON_EVENT_DATE`) — delegated to
 *    [LegalRegistryRepository.isEffective], checked against the EVENT date,
 *    not today.
 *
 * Note on [RejectionReason.SOURCE_NOT_VERIFIED]: the registry contract
 * guarantees that only human-verified artifacts are ever registered (the
 * write gate in the registry implementation), so an unverified source
 * surfaces as `NO_SOURCE_MATCH` here rather than as a distinct rejection.
 * The enum value is kept for the review workflow, which reports it before a
 * source is admitted to the registry.
 */
interface CitationValidator {
    /**
     * Verifies [parsed] as of [eventDate] — the date of the procedural event
     * the citation is used for, NOT today. The temporal window
     * ([LegalCitation.effectiveFrom] / [effectiveTo]) is checked against the
     * event date so a memo can safely cite the law in force when the events
     * occurred.
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

        val matches = registry.findExact(
            lawName = lawName,
            article = article,
            paragraph = parsed.paragraph?.trim(),
            lawNumber = null, // the parser keeps the law number inside the law name
        )
        if (matches.isEmpty()) {
            return VerificationResult.Rejected(parsed, RejectionReason.NO_SOURCE_MATCH)
        }
        if (matches.size > 1) {
            return VerificationResult.Rejected(parsed, RejectionReason.AMBIGUOUS_SOURCE_MATCH)
        }

        val citation = matches.first()
        if (!isValidSha256(citation.sourceSha256)) {
            return VerificationResult.Rejected(parsed, RejectionReason.SOURCE_HASH_INVALID)
        }
        if (!isValidHttpUrl(citation.officialSourceUrl)) {
            return VerificationResult.Rejected(parsed, RejectionReason.SOURCE_URL_INVALID)
        }
        if (!registry.isEffective(citation, eventDate)) {
            return VerificationResult.Rejected(parsed, RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE)
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
