package net.crimsys.app.domain.legal

import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Citation gate — the verification pipeline (AI/user text in, safe text out):
 *
 * ```
 * AI/User text
 *      ↓
 * Citation parser                     parse()
 *      ↓
 * LegalSourceRegistry                 registry.findExact()
 *      ↓
 * Exact source?                       empty → NO_SOURCE_MATCH
 *      ↓
 * Effective date?                     none → NOT_EFFECTIVE_ON_EVENT_DATE
 *                                     >1   → AMBIGUOUS_SOURCE_MATCH
 *      ↓
 * Verified SHA-256?                   → SOURCE_HASH_INVALID
 *      ↓
 * HTTPS official source?              → SOURCE_URL_INVALID
 *      ↓
 *       YES ──────────→ citation survives  (VerificationResult.Verified)
 *       NO ───────────→ citation replaced  (SAFETY_REFUSAL, validateAndSanitize)
 * ```
 *
 * [verify] returns the verdict for one citation; [validateAndSanitize] runs
 * the same pipeline over every citation in a document and rewrites each
 * rejected span with [SAFETY_REFUSAL]. The refusal is deliberate: unverified
 * law text never ships — it is not the app's place to guess.
 */
@Singleton
class CitationValidator @Inject constructor(
    private val registry: LegalRegistryRepository,
    private val clock: Clock,
) {

    companion object {

        const val SAFETY_REFUSAL =
            "لم يتم التحقق من النص المحدث للمادة من المصدر التشريعي المعتمد."

        private val ARTICLE_PATTERN = Regex(
            """المادة\s+([0-9٠-٩]+)(?:\s+من\s+(قانون\s+[^\n،؛.]+|قانون\s+العقوبات|قانون\s+الإثبات|قانون\s+الإجراءات\s+الجنائية))?""",
            RegexOption.IGNORE_CASE,
        )

        private val PARAGRAPH_FIRST_PATTERN = Regex(
            """الفقرة\s+([0-9٠-٩]+)\s+من\s+المادة\s+([0-9٠-٩]+)(?:\s+من\s+(قانون\s+[^\n،؛.]+|قانون\s+العقوبات|قانون\s+الإثبات|قانون\s+الإجراءات\s+الجنائية))?""",
            RegexOption.IGNORE_CASE,
        )

        private val LAW_NUMBER_PATTERN = Regex(
            """(?:القانون|قانون)\s*(?:رقم\s*)?([0-9٠-٩]+)\s*(?:لسنة|سنة)\s*([0-9٠-٩]{4})""",
            RegexOption.IGNORE_CASE,
        )

        private val SHA256_PATTERN =
            Regex("^[A-Fa-f0-9]{64}$")
    }

    suspend fun verify(
        rawCitation: String,
        eventDate: LocalDate = LocalDate.now(clock),
    ): VerificationResult {

        val parsed = parse(rawCitation).firstOrNull()
            ?: return VerificationResult.Rejected(
                citation = ParsedLegalCitation(
                    rawText = rawCitation,
                    lawName = "",
                    article = "",
                    paragraph = null,
                    startIndex = 0,
                    endIndex = rawCitation.length,
                ),
                reason = RejectionReason.UNSUPPORTED_CITATION_FORMAT,
            )

        return verifyParsed(
            parsed = parsed,
            eventDate = eventDate,
        )
    }

    suspend fun validateAndSanitize(
        rawText: String,
        eventDate: LocalDate = LocalDate.now(clock),
    ): String {

        if (rawText.isBlank()) return rawText

        val citations = parse(rawText)

        if (citations.isEmpty()) return rawText

        val replacements =
            mutableListOf<Pair<IntRange, String>>()

        for (citation in citations) {

            when (
                verifyParsed(
                    parsed = citation,
                    eventDate = eventDate,
                )
            ) {
                is VerificationResult.Verified -> Unit

                is VerificationResult.Rejected -> {
                    replacements +=
                        (citation.startIndex until citation.endIndex) to
                            SAFETY_REFUSAL
                }
            }
        }

        var sanitized = rawText

        replacements
            .sortedByDescending { it.first.first }
            .forEach { (range, replacement) ->
                sanitized = sanitized.replaceRange(
                    range,
                    replacement,
                )
            }

        return sanitized
    }

    fun parse(
        rawText: String,
    ): List<ParsedLegalCitation> {

        val paragraphMatches =
            PARAGRAPH_FIRST_PATTERN
                .findAll(rawText)
                .map { match ->

                    ParsedLegalCitation(
                        rawText = match.value,
                        lawName = normalizeLawName(
                            match.groupValues
                                .getOrNull(3)
                                .orEmpty(),
                        ),
                        article = normalizeDigits(
                            match.groupValues[2],
                        ),
                        paragraph = normalizeDigits(
                            match.groupValues[1],
                        ),
                        startIndex = match.range.first,
                        endIndex = match.range.last + 1,
                    )
                }
                .toList()

        val occupied =
            paragraphMatches.map {
                it.startIndex until it.endIndex
            }

        val articleMatches =
            ARTICLE_PATTERN
                .findAll(rawText)
                .filter { match ->
                    occupied.none {
                        it.contains(match.range.first)
                    }
                }
                .map { match ->

                    ParsedLegalCitation(
                        rawText = match.value,
                        lawName = normalizeLawName(
                            match.groupValues
                                .getOrNull(2)
                                .orEmpty(),
                        ),
                        article = normalizeDigits(
                            match.groupValues[1],
                        ),
                        paragraph = null,
                        startIndex = match.range.first,
                        endIndex = match.range.last + 1,
                    )
                }
                .toList()

        return (
            paragraphMatches + articleMatches
            ).sortedBy { it.startIndex }
    }

    private suspend fun verifyParsed(
        parsed: ParsedLegalCitation,
        eventDate: LocalDate,
    ): VerificationResult {

        if (
            parsed.lawName.isBlank() ||
            parsed.article.isBlank()
        ) {
            return VerificationResult.Rejected(
                parsed,
                RejectionReason.UNSUPPORTED_CITATION_FORMAT,
            )
        }

        val sources =
            registry.findExact(
                lawName = parsed.lawName,
                article = parsed.article,
                paragraph = parsed.paragraph,
                lawNumber = extractLawNumber(
                    parsed.rawText,
                ),
            )

        if (sources.isEmpty()) {
            return VerificationResult.Rejected(
                parsed,
                RejectionReason.NO_SOURCE_MATCH,
            )
        }

        val effective =
            sources.filter {
                registry.isEffective(
                    citation = it,
                    eventDate = eventDate,
                )
            }

        if (effective.size != 1) {
            return VerificationResult.Rejected(
                parsed,
                if (effective.isEmpty()) {
                    RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE
                } else {
                    RejectionReason.AMBIGUOUS_SOURCE_MATCH
                },
            )
        }

        return validateSource(
            parsed = parsed,
            source = effective.single(),
        )
    }

    private fun validateSource(
        parsed: ParsedLegalCitation,
        source: LegalCitation,
    ): VerificationResult {

        if (
            !source.sourceSha256.matches(
                SHA256_PATTERN,
            )
        ) {
            return VerificationResult.Rejected(
                parsed,
                RejectionReason.SOURCE_HASH_INVALID,
            )
        }

        if (
            !source.officialSourceUrl.startsWith(
                "https://",
                ignoreCase = true,
            )
        ) {
            return VerificationResult.Rejected(
                parsed,
                RejectionReason.SOURCE_URL_INVALID,
            )
        }

        return VerificationResult.Verified(source)
    }

    private fun extractLawNumber(
        raw: String,
    ): String? =
        LAW_NUMBER_PATTERN
            .find(raw)
            ?.groupValues
            ?.getOrNull(1)
            ?.let(::normalizeDigits)

    private fun normalizeLawName(
        raw: String,
    ): String =
        raw.trim()
            .replace(Regex("""\s+"""), " ")
            .trim()

    private fun normalizeDigits(
        value: String,
    ): String =
        value.map { ch ->
            when (ch) {
                '٠' -> '0'
                '١' -> '1'
                '٢' -> '2'
                '٣' -> '3'
                '٤' -> '4'
                '٥' -> '5'
                '٦' -> '6'
                '٧' -> '7'
                '٨' -> '8'
                '٩' -> '9'
                else -> ch
            }
        }.joinToString("")
}
