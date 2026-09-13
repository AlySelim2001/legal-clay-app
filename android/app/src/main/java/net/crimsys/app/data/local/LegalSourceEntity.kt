package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One authoritative Egyptian legal source in the citable registry.
 *
 * Registry rule: rows are written only after publisher + version
 * verification (review workflow) — never scraped ad hoc. `sourceKey` is the
 * stable identity cited by [net.crimsys.app.domain.legal.LegalCitation].
 */
@Entity(
    tableName = "legal_sources",
    indices = [Index(value = ["sourceKey"], unique = true)],
)
data class LegalSourceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Stable citation key, e.g. `law-150-2020`. Immutable identity. */
    val sourceKey: String,
    /** Official title of the source, verbatim. */
    val title: String,
    /** Official publisher (الجريدة الرسمية، بوابة النيابة العامة…). */
    val publisher: String,
    /** Optional official URL for independent verification. */
    val officialUrl: String? = null,
    /** Authority's issue date, if known (display + temporal checks). */
    val issuedAtEpochMs: Long? = null,
    /** Entry-into-force date, if known (temporal citation checks). */
    val effectiveAtEpochMs: Long? = null,
    /** Official or latest known version label, verbatim. */
    val version: String? = null,
    /** True when a human completed publisher/version verification. */
    val verified: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
