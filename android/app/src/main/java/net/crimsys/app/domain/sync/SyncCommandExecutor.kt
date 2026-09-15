package net.crimsys.app.domain.sync

/**
 * Transport-side contract for delivering [SyncCommand]s to the backend.
 *
 * Kept as an interface (§22 adapter rule): the app must never hardcode one
 * transport. The current implementation is Firestore
 * (`data/remote/FirebaseSyncCommandExecutor`); a future implementation can
 * target the local Zero-Trust stack (Ollama/Qdrant legal backend) without
 * touching domain, local storage, or UI.
 *
 * The result type is the per-command [SyncResult] taxonomy, not a Boolean:
 * implementations report what actually happened at the backend —
 *  - [SyncResult.Accepted] — remote write landed under [SyncResult.Accepted.remoteId];
 *  - [SyncResult.Retryable] — transient condition (offline, no session,
 *    backend 5xx); the queue retries in a later window, honoring
 *    [SyncResult.Retryable.retryAfter] when the backend supplied one;
 *  - [SyncResult.Conflict] — a newer remote version exists
 *    ([SyncResult.Conflict.remoteVersion]); a blind overwrite would destroy
 *    data, so the row must be parked for human inspection;
 *  - [SyncResult.PermanentFailure] — this command can never succeed; the
 *    caller dead-letters it.
 *
 * Implementations MUST:
 *  - reject commands whose [SyncCommand.schemaVersion] is above the highest
 *    version the transport understands (a newer app talking to an older
 *    backend is a permanent, not transient, incompatibility — `PermanentFailure`);
 *  - re-throw `kotlinx.coroutines.CancellationException` untouched;
 *  - never throw for domain failures — every failure is expressed as a
 *    [SyncResult] variant so the caller's drain logic stays exhaustive.
 */
interface SyncCommandExecutor {

    /**
     * Delivers [command] to the backend, reporting a typed [SyncResult].
     */
    suspend fun execute(command: SyncCommand): SyncResult
}
