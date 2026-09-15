package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "sync_commands",
    indices = [
        Index(
            value = [
                "status",
                "createdAtEpochMillis",
            ],
        ),
        Index(value = ["aggregateId"]),
    ],
)
data class SyncCommandEntity(

    @androidx.room.PrimaryKey
    val commandId: String,

    val schemaVersion: Int,

    val aggregateId: String,

    val type: String,

    val payloadJson: String,

    val createdAtEpochMillis: Long,

    val attemptCount: Int,

    val nextAttemptAtEpochMillis: Long?,

    val status: String,

    val lastError: String?,
)
