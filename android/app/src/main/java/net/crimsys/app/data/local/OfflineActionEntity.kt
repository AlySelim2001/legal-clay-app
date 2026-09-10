package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Lifecycle of one queued mutation. Kept as plain string constants (not an
 * enum stored by Room) so schema evolution stays explicit and migration
 * SQL can reference the values directly.
 */
object OfflineActionStatus {
    /** Waiting for its push attempt (normal FIFO queue). */
    const val PENDING = "PENDING"

    /**
     * Exhausted [OfflineActionEntity.maxRetries] attempts. Never deleted
     * automatically — surfaced via [net.crimsys.app.data.sync.SyncEvent.ActionDeadLettered]
     * and requeueable by the user through
     * [OfflineActionDao.requeueDeadLettered] after inspection. This is the
     * Dead Letter Queue.
     */
    const val DEAD = "DEAD"
}

/**
 * One deferred mutation created while offline. Actions are executed strictly
 * in insertion order by [net.crimsys.app.data.sync.SyncManager] once
 * connectivity returns, then deleted.
 */
@Entity(tableName = "offline_actions")
data class OfflineActionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /**
     * R2 remediation: globally unique remote document key, generated once at
     * enqueue time. The per-device autoincrement [id] must NEVER be used as a
     * remote key — two devices would both produce `id = 1`, write the same
     * Firestore document, and silently overwrite each other's case data.
     */
    val actionUuid: String = UUID.randomUUID().toString(),
    /** One of [OfflineActionType]. */
    val type: String,
    /** JSON payload understood by the remote data source. */
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
    /**
     * P1: push attempts allowed before the action is dead-lettered instead of
     * blocking the FIFO forever (poison-pill protection).
     */
    val maxRetries: Int = 3,
    /** One of [OfflineActionStatus]; defaults to the live queue. */
    val status: String = OfflineActionStatus.PENDING,
)

/** Canonical action types. */
object OfflineActionType {
    const val CREATE_CASE = "CREATE_CASE"
    const val UPDATE_MEMO = "UPDATE_MEMO"
    const val CREATE_HEARING = "CREATE_HEARING"
}
