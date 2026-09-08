package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One deferred mutation created while offline. Actions are executed strictly
 * in insertion order by [net.crimsys.app.data.sync.SyncManager] once
 * connectivity returns, then deleted.
 */
@Entity(tableName = "offline_actions")
data class OfflineActionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** One of [OfflineActionType]. */
    val type: String,
    /** JSON payload understood by the remote data source. */
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
)

/** Canonical action types. */
object OfflineActionType {
    const val CREATE_CASE = "CREATE_CASE"
    const val UPDATE_MEMO = "UPDATE_MEMO"
    const val CREATE_HEARING = "CREATE_HEARING"
}
