package net.crimsys.app.domain.sync

import kotlin.time.Duration

sealed interface SyncResult {

    data class Accepted(
        val remoteId: String,
    ) : SyncResult

    data class Retryable(
        val reason: String,
        val retryAfter: Duration? = null,
    ) : SyncResult

    data class Conflict(
        val remoteVersion: Long,
    ) : SyncResult

    data class PermanentFailure(
        val reason: String,
    ) : SyncResult
}
