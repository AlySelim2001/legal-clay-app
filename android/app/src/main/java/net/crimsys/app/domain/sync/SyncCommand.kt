package net.crimsys.app.domain.sync

import java.time.Instant
import java.util.UUID

enum class CommandType {
    CREATE_CASE,
    UPDATE_MEMO,
    CREATE_HEARING,
    CREATE_EVIDENCE,
}

data class SyncCommand(
    val commandId: UUID,
    val schemaVersion: Int,
    val aggregateId: UUID,
    val type: CommandType,
    val payloadJson: String,
    val createdAt: Instant,
    val attemptCount: Int,
)
