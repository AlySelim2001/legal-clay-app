package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.util.UUID
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand

/**
 * One queued [SyncCommand] awaiting transport. Same lifecycle philosophy as
 * `offline_actions` (PENDING → retried → DEAD), but rows store the command's
 * own flat fields — self-describing, no envelope codec in the middle.
 *
 * The AUTOINCREMENT `id` is a DEVICE-LOCAL queue ordinal only. The remote
 * document key is [commandId] — a UUID minted at enqueue time — so two
 * devices can never produce the same remote key and overwrite each other.
 *
 * Storage invariants:
 *  - [attemptCount] is persisted, not recomputed, so a process death between
 *    an attempt and its outcome never resets the budget.
 *  - [status] is one of [SyncCommandStatus]; `PENDING` rows are the live
 *    queue, `DEAD` rows are kept for inspection (zero data loss).
 */
@Entity(
    tableName = "sync_commands",
    indices = [Index(value = ["commandId"], unique = true)],
)
data class SyncCommandEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Device-independent identity and remote document key. */
    val commandId: String,
    /** Envelope schema version — gates the transport (see SyncCommandExecutor). */
    val schemaVersion: Int,
    /** Aggregate this mutation belongs to (case / hearing / evidence id). */
    val aggregateId: String,
    /** One of [CommandType] — closed vocabulary, not free-form text. */
    val type: String,
    /** Self-describing payload; interpretation is the backend's job. */
    val payloadJson: String,
    /** Wall-clock enqueue time (display/ordering aid, not a trust anchor). */
    val createdAtEpochMs: Long,
    val attemptCount: Int = 0,
    /** Push budget before dead-lettering (poison-pill protection). */
    val maxRetries: Int = 3,
    /** One of [SyncCommandStatus]. */
    val status: String = SyncCommandStatus.PENDING,
) {
    /** Encode to the command form consumed by the drain and transport. */
    fun toCommand(): SyncCommand =
        SyncCommand(
            commandId = UUID.fromString(commandId),
            schemaVersion = schemaVersion,
            aggregateId = UUID.fromString(aggregateId),
            type = CommandType.valueOf(type),
            payloadJson = payloadJson,
            createdAt = Instant.ofEpochMilli(createdAtEpochMs),
            attemptCount = attemptCount,
        )

    companion object {
        /**
         * Persist a freshly minted command. [attemptCount] starts at 0 on the
         * row; the command's own value is used only when RE-persisting an
         * already-attempted command (kept symmetric for tests/tools).
         */
        fun fromCommand(
            command: SyncCommand,
            maxRetries: Int = 3,
        ): SyncCommandEntity =
            SyncCommandEntity(
                commandId = command.commandId.toString(),
                schemaVersion = command.schemaVersion,
                aggregateId = command.aggregateId.toString(),
                type = command.type.name,
                payloadJson = command.payloadJson,
                createdAtEpochMs = command.createdAt.toEpochMilli(),
                attemptCount = command.attemptCount,
                maxRetries = maxRetries,
            )
    }
}

/** Queue lifecycle — plain constants so migration SQL can reference values. */
object SyncCommandStatus {
    const val PENDING = "PENDING"
    const val DEAD = "DEAD"
}
