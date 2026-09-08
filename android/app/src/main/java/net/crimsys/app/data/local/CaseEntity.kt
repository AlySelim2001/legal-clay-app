package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A criminal case. Room is the single source of truth: the UI never writes to
 * Firebase directly — [net.crimsys.app.data.sync.SyncManager] drains the
 * offline queue and flips [isSynced] once the server accepts the payload.
 */
@Entity(tableName = "cases")
data class CaseEntity(
    @PrimaryKey val id: String,
    val caseNumber: String,
    val courtName: String,
    val caseType: String,
    /** Rich-text memo (HTML) edited by com.mohamedrejeb.richeditor. */
    val memoHtml: String = "",
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
