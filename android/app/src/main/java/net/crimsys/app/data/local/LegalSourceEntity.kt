package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "legal_sources",
    indices = [
        Index(value = ["lawName", "article", "paragraph"]),
        Index(value = ["lawNumber", "article", "paragraph"]),
    ],
)
data class LegalSourceEntity(
    @androidx.room.PrimaryKey
    val id: String,

    val lawNumber: String,

    val lawName: String,

    val article: String,

    val paragraph: String?,

    val effectiveFromEpochDay: Long,

    val effectiveToEpochDay: Long?,

    val sourceSha256: String,

    val officialSourceUrl: String,

    val gazetteIssue: String?,

    val verified: Boolean,
)
