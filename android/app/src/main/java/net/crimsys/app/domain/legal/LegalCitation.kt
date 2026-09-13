package net.crimsys.app.domain.legal

import java.time.LocalDate

data class LegalCitation(
    val lawNumber: String,
    val lawName: String,
    val article: String,
    val paragraph: String?,
    val effectiveFrom: LocalDate,
    val effectiveTo: LocalDate?,
    val sourceSha256: String,
    val officialSourceUrl: String,
    val gazetteIssue: String?,
)

data class ParsedLegalCitation(
    val rawText: String,
    val lawName: String,
    val article: String,
    val paragraph: String?,
    val startIndex: Int,
    val endIndex: Int,
)

sealed interface VerificationResult {

    data class Verified(
        val citation: LegalCitation,
    ) : VerificationResult

    data class Rejected(
        val citation: ParsedLegalCitation,
        val reason: RejectionReason,
    ) : VerificationResult
}

enum class RejectionReason {
    NO_SOURCE_MATCH,
    AMBIGUOUS_SOURCE_MATCH,
    SOURCE_NOT_VERIFIED,
    SOURCE_HASH_INVALID,
    SOURCE_URL_INVALID,
    NOT_EFFECTIVE_ON_EVENT_DATE,
    UNSUPPORTED_CITATION_FORMAT,
}
