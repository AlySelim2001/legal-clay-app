package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "evidence",
    indices = [
        Index(value = ["caseId"]),
        Index(
            value = ["originalFileHash"],
            unique = true,
        ),
    ],
)
data class EvidenceEntity(

    @androidx.room.PrimaryKey
    val id: String,

    val caseId: String,

    val originalFileHash: String,

    val processedFileHash: String?,

    val mimeType: String,

    val captureTimestamp: Long,

    val chainOfCustodyJson: String,

    val immutableRelativePath: String,
)
