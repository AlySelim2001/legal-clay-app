package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Offline legal-text catalog. The column names are intentionally stable and
 * SQLite-friendly so the same database can be inspected by AnyQuery.
 */
@Entity(
    tableName = "legal_documents",
    indices = [
        Index(value = ["documentType"]),
        Index(value = ["lawNumber", "articleNumber"]),
        Index(value = ["title"]),
    ],
)
data class LegalDocumentEntity(
    @PrimaryKey val id: String,
    val documentType: String,
    val title: String,
    val lawNumber: String?,
    val articleNumber: String?,
    val body: String,
    val sourceUrl: String?,
    val publishedAtEpochDay: Long?,
    val updatedAtEpochMillis: Long,
    val verified: Boolean,
)
