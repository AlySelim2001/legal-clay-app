package net.crimsys.app.domain.sync

/**
 * Transport-side contract for delivering [SyncCommand]s to the backend.
 *
 * Kept as an interface (§22 adapter rule): the app must never hardcode one
 * transport. The current implementation is Firestore
 * (`data/remote/FirebaseSyncCommandExecutor`); a future implementation can
 * target the local Zero-Trust stack (Ollama/Qdrant legal backend) without
 * touching domain, local storage, or UI.
 */
interface SyncCommandExecutor {
    /**
     * Delivers [command] to the backend.
     *
     * Implementations MUST:
     *  - verify the command payload against [SyncCommand.payloadSha256]
     *    before any remote write (a corrupted row must fail fast, not ship);
     *  - re-throw `kotlinx.coroutines.CancellationException` untouched;
     *  - report transport/availability problems as null — retrying is the
     *    queue's decision, not the executor's.
     *
     * @return true when the backend accepted the command; false when the
     * delivery should be retried later (offline, auth unavailable, transport
     * error). Permanent per-command rejection is signalled by throwing
     * [IllegalArgumentException] so the caller dead-letters the row.
     */
    suspend fun execute(command: SyncCommand): Boolean
}
