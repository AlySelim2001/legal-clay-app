package net.crimsys.app.domain.legal

import javax.inject.Inject

/**
 * Extracts a [ParsedLegalCitation] from free Arabic legal text.
 *
 * Kept deliberately narrow (Evidence-First, no legal guessing): the parser
 * recognizes the article/law/paragraph phrases that appear in litigation
 * memos and reports. Anything it cannot recognize yields `null` — the caller
 * surfaces [RejectionReason.UNSUPPORTED_CITATION_FORMAT] rather than guessing.
 *
 * Recognized forms (Arabic-Indic digits ٠-٩ normalized to 0-9):
 *  - article:  "المادة 40" / "مادة ٤٠"
 *  - law:      "قانون الإجراءات الجنائية رقم 150 لسنة 2020" (whole phrase kept verbatim)
 *  - paragraph: "فقرة 3" / "الفقرة رقم 2" (digits only — ordinal words like
 *    "الأولى" are NOT mapped; a paragraph that cannot be numbered stays null
 *    and the citation still verifies on the article alone)
 */
interface LegalCitationParser {
    /**
     * @return the parsed citation, or null when no article phrase exists —
     * a law name alone is not a citation.
     */
    fun parse(rawText: String): ParsedLegalCitation?
}

class ArabicLegalCitationParser @Inject constructor() : LegalCitationParser {

    override fun parse(rawText: String): ParsedLegalCitation? {
        val articleMatch = ARTICLE_REGEX.find(rawText) ?: return null
        val article = normalizeDigits(articleMatch.groupValues[1])

        val lawMatch = LAW_REGEX.find(rawText)
        val paragraphMatch = PARAGRAPH_REGEX.find(rawText)

        // The citation span covers everything the parser consumed: the law
        // phrase (when present), the article, and the paragraph (when after
        // the article). endIndex is EXCLUSIVE, so
        // rawText.substring(startIndex, endIndex) renders the matched span.
        val ranges = listOfNotNull(lawMatch?.range, articleMatch.range, paragraphMatch?.range)
        val startIndex = ranges.minOf { it.first }
        val endIndex = ranges.maxOf { it.last } + 1

        return ParsedLegalCitation(
            rawText = rawText,
            lawName = lawMatch?.value?.trim().orEmpty(),
            article = article,
            paragraph = paragraphMatch?.groupValues?.get(1)?.let(::normalizeDigits),
            startIndex = startIndex,
            endIndex = endIndex,
        )
    }

    private fun normalizeDigits(digits: String): String = buildString(digits.length) {
        for (ch in digits) {
            append(if (ch in '٠'..'٩') ('0' + (ch - '٠')) else ch)
        }
    }

    private companion object {
        const val DIGITS = "0-9\\u0660-\\u0669"

        /** "المادة 40" / "مادة ٤٠" — captures the article number. */
        val ARTICLE_REGEX = Regex("(?:ال)?مادة\\s+([$DIGITS]+)")

        /**
         * "قانون …" / "لائحة …" — the FULL match is the law name, kept
         * verbatim (variant titles must reach the registry unchanged; the
         * validator matches on what was written, never on an interpretation).
         * Terminates at clause punctuation.
         */
        val LAW_REGEX = Regex("(?:قانون|لائحة)\\s+([^،؛,.\\n]+)")

        /** "فقرة 3" / "الفقرة رقم 2" — digits only (see class doc). */
        val PARAGRAPH_REGEX = Regex("(?:ال)?فقرة\\s+(?:رقم\\s+)?([$DIGITS]+)")
    }
}
