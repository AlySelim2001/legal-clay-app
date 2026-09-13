package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One registered legal artifact: an (law, article) row carrying the evidence
 * fields [net.crimsys.app.domain.legal.LegalCitation] needs.
 *
 * Registry rule: a row only carries `verified = true` after a person
 * completed publisher/version verification — the citation validator rejects
 * unverified rows. The natural key is (lawName, article, paragraph): the same
 * article must exist exactly once per law, or verification would be
 * ambiguous by construction.
 */
@Entity(
    tableName = "legal_sources",
    indices = [Index(value = ["lawName", "article", "paragraph"], unique = true)],
)
data class LegalSourceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Official law number, verbatim (e.g. "150 لسنة 2020"). */
    val lawNumber: String,
    /** Official law name, verbatim — the match key for citations. */
    val lawName: String,
    /** Article locator as written in the law, verbatim. */
    val article: String,
    /** Paragraph locator, when the row pins one (null = article-level row). */
    val paragraph: String? = null,
    /** Entry into force (ISO local date, e.g. "2021-04-01"). */
    val effectiveFromIso: String,
    /** Repeal/replacement date, when applicable (null = still in force). */
    val effectiveToIso: String? = null,
    /** SHA-256 of the registered source artifact (PDF/text). */
    val sourceSha256: String,
    /** Official publisher URL for independent verification. */
    val officialSourceUrl: String,
    /** Official Gazette issue, verbatim (e.g. "الجريدة الرسمية - عدد 27 مكرر"). */
    val gazetteIssue: String? = null,
    /** True when a human completed publisher/version verification. */
    val verified: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
