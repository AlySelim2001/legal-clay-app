package net.crimsys.app.domain.legal

/** Public, UI-safe representation of one locally indexed Egyptian legal text. */
data class LegalDocument(
    val id: String,
    val type: String,
    val title: String,
    val lawNumber: String?,
    val articleNumber: String?,
    val body: String,
    val sourceUrl: String?,
    val publishedAtEpochDay: Long?,
    val updatedAtEpochMillis: Long,
    val verified: Boolean,
)
