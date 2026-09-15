package net.crimsys.app.data.local

import java.time.Instant
import java.util.UUID
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand

/**
 * Command ↔ row mapping for [SyncCommandEntity].
 *
 * Kept out of the entity class deliberately — the adopted entity is a pure
 * data shape with no behavior, so the mapping lives beside it as extensions.
 *
 * The closed `CommandType` vocabulary is enforced here: decoding a row whose
 * `type` was written by an older/foreign build throws
 * [IllegalArgumentException] (from `CommandType.valueOf`), which the drain
 * treats as a permanently broken row — park, never route.
 */
fun SyncCommandEntity.toCommand(): SyncCommand =
    SyncCommand(
        commandId = UUID.fromString(commandId),
        schemaVersion = schemaVersion,
        aggregateId = UUID.fromString(aggregateId),
        type = CommandType.valueOf(type),
        payloadJson = payloadJson,
        createdAt = Instant.ofEpochMilli(createdAtEpochMillis),
        attemptCount = attemptCount,
    )

/**
 * Encode a freshly minted command. Row-lifecycle fields ([status],
 * [SyncCommandEntity.lastError], [SyncCommandEntity.nextAttemptAtEpochMillis])
 * take their defaults — the queue owns them, not the command.
 */
fun SyncCommand.toEntity(): SyncCommandEntity =
    SyncCommandEntity(
        commandId = commandId.toString(),
        schemaVersion = schemaVersion,
        aggregateId = aggregateId.toString(),
        type = type.name,
        payloadJson = payloadJson,
        createdAtEpochMillis = createdAt.toEpochMilli(),
        attemptCount = attemptCount,
        nextAttemptAtEpochMillis = null,
        status = SyncCommandStatus.PENDING,
        lastError = null,
    )

/**
 * Queue lifecycle — plain constants so migration SQL can reference values.
 *
 * PENDING → the live queue (drained FIFO by [SyncCommandDao.nextReady]);
 * CONFLICT → parked by a remote split-brain refusal, distinct from DEAD so
 * human inspection can prioritize "the backend disagrees with us" over
 * "this row is broken";
 * DEAD → permanently broken or budget-exhausted, kept for inspection.
 */
object SyncCommandStatus {
    const val PENDING = "PENDING"
    const val CONFLICT = "CONFLICT"
    const val DEAD = "DEAD"
}
