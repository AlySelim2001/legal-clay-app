package net.crimsys.app.data.sync

import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.local.OfflineActionStatus
import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.data.remote.RemoteDataSource

/** One notable occurrence in the sync pipeline, surfaced to the UI. */
sealed interface SyncEvent {
    /**
     * An action exhausted [net.crimsys.app.data.local.OfflineActionEntity.maxRetries]
     * and was moved to the dead-letter state. The UI must warn the user — this
     * mutation will NOT be retried automatically.
     */
    data class ActionDeadLettered(
        val actionType: String,
        val localId: Long,
        val attempts: Int,
    ) : SyncEvent
}

/**
 * Owns the Offline Action Queue.
 *
 * Strategy:
 * 1. Collect [NetworkMonitor.observe] forever in the application-scoped
 *    [CoroutineScope] passed to [start] (CrimSysApplication owns it).
 * 2. On every `true`, drain the queue FIFO. Drain requests travel through a
 *    [Channel] with a conflated latest-wins flag. The collector is a plain
 *    `collect` (NOT collectLatest): a request arriving while a drain is
 *    running *waits* behind the Mutex instead of being cancelled, so no
 *    signal can ever be consumed by a restarted collector and lost.
 * 3. Single-flight execution (P1): every entry into the drain passes through
 *    [syncMutex]. Two triggers (connectivity flap + repository requestDrain)
 *    can never interleave two drains on the same DAO snapshot.
 * 4. Per action: attempt remote push. Success → delete the action and flip
 *    the local `isSynced` flag for CREATE_CASE payloads. Failure → increment
 *    the retry counter and STOP the drain (preserving strict order; a later
 *    mutation must never overtake a failed earlier one).
 * 5. Dead Letter Queue (P1): an action whose retryCount has reached
 *    [net.crimsys.app.data.local.OfflineActionEntity.maxRetries] is marked
 *    [OfflineActionStatus.DEAD] and a [SyncEvent.ActionDeadLettered] is
 *    emitted. It no longer blocks the FIFO for the actions behind it — the
 *    classic "poison pill" head-of-line blocking is gone. Dead actions stay
 *    in the table (never destroyed, zero data loss) and can be requeued
 *    through [OfflineActionDao.requeueDeadLettered] after user inspection.
 *
 * Cancellation (R3): the drain runs in a child coroutine, so scope teardown
 * propagates naturally; the finally block restores [isSyncing]. Suspension
 * points surface CancellationException untouched — a cancelled sync is a
 * cancelled sync, never a "rejected" push. `Mutex.withLock` releases the
 * lock on cancellation via its own finally.
 *
 * Ordering guarantee: OfflineActionEntity ids are auto-incrementing, so
 * `ORDER BY id ASC` is exactly insertion order.
 */
@Singleton
class SyncManager @Inject constructor(
    private val networkMonitor: NetworkMonitor,
    private val offlineActionDao: OfflineActionDao,
    private val caseDao: CaseDao,
    private val remote: RemoteDataSource,
) {
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    /** Latest-wins drain requests; UNCONFIRMED guarantees no signal is lost. */
    private val drainRequests = Channel<Unit>(Channel.CONFLATED)

    /**
     * Single-flight gate for the drain loop (P1). Locked for the entire
     * queue pass; waiting callers queue up on it instead of racing.
     */
    private val syncMutex = Mutex()

    private var listenJob: Job? = null

    /**
     * Buffered event stream. DROP_OLDEST + tryEmit means emitting is never
     * suspending and never lost due to a missing subscriber (e.g. the UI is
     * in the background when an action dies).
     */
    private val _syncEvents = MutableSharedFlow<SyncEvent>(
        extraBufferCapacity = 16,
        onBufferOverflow = kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST,
    )
    val syncEvents: SharedFlow<SyncEvent> = _syncEvents.asSharedFlow()

    /**
     * Starts listening for connectivity changes. Call once from
     * CrimSysApplication with an application-scoped [CoroutineScope].
     * Re-invocation while running is a no-op (idempotent).
     */
    fun start(scope: CoroutineScope) {
        if (listenJob?.isActive == true) return
        listenJob =
            scope.launch {
                launch {
                    networkMonitor.observe().collect { online ->
                        if (online) drainRequests.send(Unit)
                    }
                }
                launch {
                    // Plain collect: never cancels a waiting drain attempt.
                    // The Mutex below serializes execution instead.
                    drainRequests.receiveAsFlow().collect {
                        runDrainCatching()
                    }
                }
            }
    }

    /**
     * Requests a drain: invoked by [start] on connectivity, and by
     * repositories that just enqueued while online. Re-entrant-safe — the
     * caller never blocks on the running drain and never spawns a second one.
     */
    fun requestDrain() {
        drainRequests.trySend(Unit)
    }

    /**
     * Executes every queued action in FIFO order. Single-flight via
     * [syncMutex]; concurrent callers wait and then observe an empty queue.
     * Retained for callers that must observe completion; repositories should
     * prefer [requestDrain].
     */
    suspend fun drainQueue() {
        syncMutex.withLock {
            _isSyncing.value = true
            try {
                drainLoop()
            } finally {
                _isSyncing.value = false
            }
        }
    }

    /**
     * Isolates the drain from the listener loop: a genuine non-cancellation
     * failure (DB closed, disk error) must not kill the sync machinery for
     * the life of the process — the queue simply retries on the next window.
     */
    private suspend fun runDrainCatching() {
        try {
            drainQueue()
        } catch (ce: CancellationException) {
            throw ce
        } catch (t: Throwable) {
            Log.w(TAG, "Drain aborted — queue will retry on next trigger", t)
        }
    }

    private suspend fun drainLoop() {
        // R2 backstop: legacy rows (pre-UUID build) carry the `''` sentinel
        // after MIGRATION_1_2. Assign a DISTINCT uuid to each — a shared one
        // would recreate the cross-device document collision R2 eliminates.
        offlineActionDao.legacyKeyed().forEach { legacy ->
            offlineActionDao.assignUuid(legacy.id, UUID.randomUUID().toString())
        }

        while (true) {
            val next = offlineActionDao.pendingInOrder().firstOrNull() ?: break

            // P1 — poison-pill handling: exhausted retries go to the dead
            // letter state and the loop CONTINUES, so the rest of the queue
            // keeps flowing. No data is destroyed (zero data loss).
            if (next.retryCount >= next.maxRetries) {
                offlineActionDao.markDeadLetter(next.id)
                Log.w(TAG, "Action id=${next.id} type=${next.type} dead-lettered after ${next.retryCount} attempts")
                _syncEvents.tryEmit(
                    SyncEvent.ActionDeadLettered(
                        actionType = next.type,
                        localId = next.id,
                        attempts = next.retryCount,
                    ),
                )
                continue
            }

            val accepted = remote.push(next)
            if (!accepted) {
                // Keep the action queued for the next window; ordering intact.
                offlineActionDao.incrementRetry(next.id)
                Log.w(TAG, "Push rejected (id=${next.id}, type=${next.type}) — will retry")
                break
            }

            offlineActionDao.deleteById(next.id)
            markRelatedCaseSynced(next)
        }
    }

    /**
     * For CREATE_CASE payloads, flips `isSynced` on the local row. Payload
     * format is a single JSON object: `{"caseId": "..."}`.
     */
    private suspend fun markRelatedCaseSynced(action: net.crimsys.app.data.local.OfflineActionEntity) {
        if (action.type != OfflineActionType.CREATE_CASE) return
        try {
            val caseId = caseIdRegex.find(action.payloadJson)?.groupValues?.getOrNull(1)
            caseId?.let { caseDao.setSynced(it, synced = true) }
        } catch (ce: CancellationException) {
            throw ce
        } catch (t: Throwable) {
            Log.w(TAG, "Could not mark case synced (action id=${action.id})", t)
        }
    }

    private companion object {
        const val TAG = "SyncManager"
        val caseIdRegex = Regex("\"caseId\"\\s*:\\s*\"([^\"]+)\"")
    }
}
