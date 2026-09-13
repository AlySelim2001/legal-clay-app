package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import net.crimsys.app.domain.sync.SyncCommand

/**
 * One queued [SyncCommand] awaiting transport. Same lifecycle philosophy as
 * `offline_actions` (PENDING → retried → DEAD), but rows store the
 * command's own JSON envelope — self-describing, versioned by the codec.
 */
@Entity(
    tableName = "sync_commands",
    indices = [Index(value = ["uuid"], unique = true)],
)
data class SyncCommandEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Remote document key — device-independent UUID minted at enqueue. */
    val uuid: String,
    /** One of [SyncCommand.Type] or a free-form future type. */
    val type: String,
    /** Full command envelope JSON ([SyncCommand.Codec] form). */
    val payloadJson: String,
    val retryCount: Int = 0,
    /** Push budget before dead-lettering (poison-pill protection). */
    val maxRetries: Int = 3,
    /** One of [SyncCommandStatus]. */
    val status: String = SyncCommandStatus.PENDING,
    val createdAtEpochMs: Long = System.currentTimeMillis(),
) {
    /** Decode the command envelope. Returns null for corrupt rows. */
    fun toCommand(): SyncCommand? = SyncCommand.Codec.fromJson(payloadJson)

    companion object {
        fun fromCommand(command: SyncCommand, maxRetries: Int = 3): SyncCommandEntity =
            SyncCommandEntity(
                uuid = command.uuid,
                type = command.type,
                payloadJson = SyncCommand.Codec.toJson(command),
                maxRetries = maxRetries,
            )
    }
}

/** Queue lifecycle — plain constants so migration SQL can reference values. */
object SyncCommandStatus {
    const val PENDING = "PENDING"
    const val DEAD = "DEAD"
}
