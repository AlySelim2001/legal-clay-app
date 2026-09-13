package net.crimsys.app.domain.sync

import net.crimsys.app.core.AppError

/**
 * Outcome of executing one [SyncCommand] (or draining the command queue).
 *
 * Mirrors the richer contract the legacy `RemoteDataSource.push(): Boolean`
 * could not express:
 *  - [Success] — every attempted command was accepted; local rows can be
 *    marked processed.
 *  - [Retry] — transient condition (offline, no session, backend rejected
 *    temporarily). The queue survives untouched and a later window retries.
 *    Carries a coarse [reason] safe for logs (never payload content).
 *  - [Failed] — permanent condition for THIS command (e.g. malformed input).
 *    Callers dead-letter it so it can never poison the FIFO; the row is
 *    kept, not deleted (zero data loss).
 */
sealed interface SyncResult {
    /** All attempted commands accepted; [processedCommands] commands succeeded. */
    data class Success(val processedCommands: Int) : SyncResult

    /** Transient failure — retry in a later connectivity window. */
    data class Retry(val reason: String) : SyncResult

    /** Permanent failure — dead-letter the offending command. */
    data class Failed(val error: AppError) : SyncResult
}
