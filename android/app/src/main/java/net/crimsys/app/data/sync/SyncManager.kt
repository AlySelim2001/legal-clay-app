package net.crimsys.app.data.sync

import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.data.remote.RemoteDataSource

/**
 * Owns the Offline Action Queue.
 *
 * Strategy:
 * 1. Collect [NetworkMonitor.observe] forever in the application-scoped
 *    [CoroutineScope] passed to [start] (CrimSysApplication owns it).
 * 2. On every `true`, drain the queue FIFO. Events are funnelled through a
 *    [Channel] with a conflated latest-wins flag, so a connectivity flap
 *    during a drain schedules exactly one follow-up instead of coalescing
 *    into a silent no-op — the classic collectLatest restart race, closed.
 * 3. Per action: attempt remote push. Success → delete the action and flip
 *    the local `isSynced` flag for CREATE_CASE payloads. Failure → increment
 *    the retry counter and STOP the drain (preserving strict order; a later
 *    mutation must never overtake a failed earlier one).
 *
 * Cancellation (R3): the drain runs in a child coroutine, so scope teardown
 * propagates naturally; the finally block restores [isSyncing]. Suspension
 * points surface CancellationException untouched — a cancelled sync is a
 * cancelled sync, never a "rejected" push.
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

    private var listenJob: Job? = null

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
                    networkMonitor.observe().collectLatest { online ->
                        if (online) drainRequests.send(Unit)
                    }
                }
                launch {
                    drainRequests.receiveAsFlow().collectLatest {
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
     * Executes every queued action in FIFO order. Retained for callers that
     * must observe completion; repositories should prefer [requestDrain].
     */
    suspend fun drainQueue() {
        if (_isSyncing.value) return
        _isSyncing.value = true
        try {
            drainLoop()
        } finally {
            _isSyncing.value = false
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
