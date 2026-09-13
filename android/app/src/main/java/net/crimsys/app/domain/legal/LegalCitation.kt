package net.crimsys.app.domain.legal

/**
 * A verifiable pointer to an Egyptian legal authority (statute, regulation,
 * constitution article) as recorded by this app.
 *
 * Citation integrity policy (Evidence-First, no legal guessing):
 *  - [sourceKey] MUST match a source registered in the legal registry
 *    (`data/local/LegalSourceEntity`) — a citation to an unregistered source
 *    is invalid, see [CitationValidator].
 *  - [reference] points into the source ("مادة ٤٠", "الباب الثاني") and is
 *    stored verbatim — never paraphrased into a number by code.
 *  - [retrievedAtEpochMs] records when this app retrieved/verified the text.
 *  - [officialUrl], when present, links to the official publisher page so a
 *    reader can check the authority without trusting this app.
 *
 * Nothing in this class interprets the law; it only proves where a stated
 * rule came from and when it was checked.
 */
data class LegalCitation(
    /** Registry key, e.g. `law-150-2020` (stable, lowercase, hyphenated). */
    val sourceKey: String,
    /** Official title of the source, verbatim. */
    val title: String,
    /** Official publisher (مجلة القانون، الجريدة الرسمية، بوابة النيابة…). */
    val publisher: String,
    /** Intra-source locator, verbatim (article/paragraph/section). */
    val reference: String,
    /** When the authority itself was issued, if known. */
    val issuedAtEpochMs: Long? = null,
    /** When the authority entered into force, if known. */
    val effectiveAtEpochMs: Long? = null,
    /** When this app retrieved/verified the cited text. */
    val retrievedAtEpochMs: Long,
    /** Official publisher URL for independent verification. */
    val officialUrl: String? = null,
) {
    companion object {
        /**
         * Deterministic registry key for one cited article:
         * `<sourceKey>#<reference>` — used by the sync layer to key remote
         * attestation requests without re-parsing Arabic references.
         */
        fun articleKey(sourceKey: String, reference: String): String =
            "${sourceKey.trim()}#${reference.trim()}"
    }
}
