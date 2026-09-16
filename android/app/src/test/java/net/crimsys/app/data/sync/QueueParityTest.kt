package net.crimsys.app.data.sync

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.testing.WorkManagerTestInitHelper
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.OfflineActionEntity
import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.local.SyncCommandStatus
import net.crimsys.app.data.local.toEntity
import net.crimsys.app.data.remote.RemoteDataSource
import net.crimsys.app.data.repository.CaseRepositoryImpl
import net.crimsys.app.domain.model.CaseDraft
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Queue-generation PARITY suite — the hard gate from the coexistence policy
 * (`android/README.md`): the legacy OfflineActionQueue may not be deprecated
 * until every producer is migrated AND parity tests prove identical outcomes
 * for the same operations through both queues. This suite IS that proof.
 *
 * ── What is compared ─────────────────────────────────────────────────────
 * The OBSERVABLE outcome of one operation ("create a case") through each
 * queue generation, given the same transport verdict:
 *
 *   [ParityOutcome]
 *    - transportAttempts   — how many times the remote was contacted
 *    - acceptedMutations   — ordered (type, decoded payload minus caseId)
 *    - pendingRows / deadRows — queue state after the pass
 *
 * Covered invariants (each scenario runs BOTH queues and asserts equality):
 *
 *   1. accepted mutation → exactly one remote delivery, empty queue;
 *   2. rejected mutation  → exactly one attempt, mutation RETAINED (never
 *      lost, never duplicated), drain stops;
 *   3. poison row         → dead-lettered WITHOUT blocking the mutation
 *      behind it (both generations share the anti-livelock contract);
 *   4. multiple mutations → FIFO delivery order = enqueue order.
 *
 * ── Asymmetries that are deliberately NOT forced ─────────────────────────
 *  - The legacy side runs the REAL producer (`CaseRepositoryImpl.createCase`)
 *    and therefore flips `cases.isSynced` after acceptance; the command side
 *    has no producer yet — producers migrate to the command queue in the
 *    NEXT phase, only after this suite passes. The suite asserts the legacy
 *    isSynced flip on its own side and asserts payload/aggregate binding
 *    (payload caseId == aggregateId) on the command side.
 *  - caseId is a device-local identifier minted per side; payloads are
 *    compared minus that field, with each side's internal binding asserted.
 *  - Transport APIs differ by design (legacy: Boolean push; command: typed
 *    SyncResult). The fakes map both to the same semantic verdict
 *    ("accept this mutation once" / "reject it"), which is precisely the
 *    parity surface.
 *
 * Environment: Robolectric (SDK 35 — see SyncWorkerTest for the JDK 17/SDK 36
 * tradeoff), real in-memory Room executing the production SQL on both sides,
 * only the remote transport faked. `NetworkMonitor` resolves offline under
 * Robolectric (no active network), so drains are triggered explicitly —
 * deterministic, no connectivity races.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class QueueParityTest {

    private lateinit var context: Context
    private lateinit var db: CrimSysDatabase

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()

        db = Room.inMemoryDatabaseBuilder(context, CrimSysDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        // SyncWorker.scheduleSelf() calls WorkManager.getInstance(...) — the
        // test initializer makes that legal (requests tracked, never driven).
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
    }

    @After
    fun tearDown() {
        db.close()
    }

    // ── observation model ────────────────────────────────────────────────

    /** One decoded mutation the transport saw (payload minus device-local caseId). */
    private data class ObservedMutation(
        val type: String,
        val payloadFields: Map<String, String>,
    )

    /** The full observable outcome of one operation through one queue generation. */
    private data class ParityOutcome(
        val transportAttempts: Int,
        val acceptedMutations: List<ObservedMutation>,
        val pendingRows: Int,
        val deadRows: Int,
    )

    /** Transport fake for the LEGACY queue (boolean push API). */
    private class RecordingRemote : RemoteDataSource {
        val pushedPayloads = mutableListOf<Pair<String, String>>()
        var accept: Boolean = true

        override suspend fun push(action: net.crimsys.app.data.local.OfflineActionEntity): Boolean {
            pushedPayloads += action.type to action.payloadJson
            return accept
        }
    }

    /** Transport fake for the COMMAND queue (typed SyncResult API). */
    private class RecordingExecutor : SyncCommandExecutor {
        val received = mutableListOf<SyncCommand>()
        var outcome: SyncResult = SyncResult.Accepted(remoteId = "remote-id")

        override suspend fun execute(command: SyncCommand): SyncResult {
            received += command
            return outcome
        }
    }

    private fun decoded(type: String, payloadJson: String): ObservedMutation {
        val fields =
            Json.parseToJsonElement(payloadJson)
                .jsonObject
                .mapValues { (_, v) -> (v as JsonPrimitive).content }
        return ObservedMutation(type, fields - "caseId")
    }

    // ── scenario data ────────────────────────────────────────────────────

    private data class CaseSpec(
        val caseNumber: String,
        val courtName: String,
        val caseType: String,
    )

    private val oneCase = listOf(CaseSpec("341/2026/جنائي القاهرة", "محكمة جنائية القاهرة", "سرقة"))

    private val twoCases = listOf(
        CaseSpec("12/2026/جنائي الجيزة", "محكمة جنائية الجيزة", "نصب"),
        CaseSpec("77/2026/جنائي الإسكندرية", "محكمة جنائية الإسكندرية", "اختلاس"),
    )

    // ── legacy side: the REAL producer + REAL SyncManager drain ───────────

    private suspend fun runLegacy(
        cases: List<CaseSpec>,
        transportAccepts: Boolean,
        poisonFirst: Boolean = false,
    ): ParityOutcome {
        val remote =
            RecordingRemote().apply {
                accept = transportAccepts
            }

        // Robolectric resolves no active network → isOnline = false, so
        // createCase skips requestDrain and the drain is triggered exactly
        // once, explicitly — deterministic and race-free.
        val networkMonitor = NetworkMonitor(context)
        val syncManager =
            SyncManager(
                networkMonitor = networkMonitor,
                offlineActionDao = db.offlineActionDao(),
                caseDao = db.caseDao(),
                remote = remote,
            )
        val repository =
            CaseRepositoryImpl(
                caseDao = db.caseDao(),
                hearingDao = db.hearingDao(),
                offlineActionDao = db.offlineActionDao(),
                networkMonitor = networkMonitor,
                syncManager = syncManager,
            )

        if (poisonFirst) {
            // Exhausted-retries poison pill at the HEAD of the legacy FIFO.
            db.offlineActionDao().enqueue(
                OfflineActionEntity(
                    type = OfflineActionType.CREATE_CASE,
                    payloadJson = "{}",
                    retryCount = 3,
                    maxRetries = 3,
                ),
            )
        }

        val createdCaseIds = mutableListOf<String>()

        cases.forEach { spec ->
            val outcome =
                repository.createCase(
                    CaseDraft(
                        caseNumber = spec.caseNumber,
                        courtName = spec.courtName,
                        caseType = spec.caseType,
                    ),
                )
            assertTrue("legacy createCase must succeed", outcome is Result.Success)
            // The producer writes the case row BEFORE enqueueing; capture the
            // locally-minted id for the payload-binding assertion.
            db.caseDao().observeCases()
                .first()
                .firstOrNull { row -> row.caseNumber == spec.caseNumber }
                ?.let { createdCaseIds += it.id }
        }

        syncManager.drainQueue()

        val pending = db.offlineActionDao().pendingInOrder().size
        val dead = db.offlineActionDao().deadLettered().size

        return ParityOutcome(
            transportAttempts = remote.pushedPayloads.size,
            acceptedMutations =
                if (transportAccepts) {
                    remote.pushedPayloads.map { (t, p) -> decoded(t, p) }
                } else {
                    emptyList()
                },
            pendingRows = pending,
            deadRows = dead,
        ).also { outcome ->
            // Producer-side contract (legacy-only today): an accepted
            // CREATE_CASE flips the case row's isSynced flag — the poison row
            // is dead-lettered before any push, so it never affects this.
            if (transportAccepts) {
                createdCaseIds.forEach { id ->
                    assertTrue(
                        "accepted CREATE_CASE must flip isSynced (case $id)",
                        db.caseDao().getById(id)?.isSynced == true,
                    )
                }
            }
            // Payload binding: every pushed CREATE_CASE carries the caseId of
            // the row the producer actually wrote.
            if (transportAccepts) {
                val pushedCaseIds =
                    remote.pushedPayloads
                        .filter { it.first == OfflineActionType.CREATE_CASE }
                        .map { (_, p) ->
                            (Json.parseToJsonElement(p).jsonObject["caseId"] as JsonPrimitive).content
                        }
                assertEquals(createdCaseIds, pushedCaseIds)
            }
        }
    }

    // ── command side: the mapping the future producer will use + REAL drain ──

    private suspend fun runCommand(
        cases: List<CaseSpec>,
        outcome: SyncResult,
        poisonFirst: Boolean = false,
    ): ParityOutcome {
        val executor =
            RecordingExecutor().apply {
                this.outcome = outcome
            }

        if (poisonFirst) {
            // Undecodable poison row at the HEAD of the command FIFO (older
            // createdAt than every healthy command below).
            db.syncCommandDao().insert(
                SyncCommandEntity(
                    commandId = UUID.randomUUID().toString(),
                    schemaVersion = 1,
                    aggregateId = UUID.randomUUID().toString(),
                    type = "NOT_A_COMMAND_TYPE",
                    payloadJson = "{}",
                    createdAtEpochMillis = System.currentTimeMillis() - 60_000,
                    attemptCount = 0,
                    nextAttemptAtEpochMillis = null,
                    status = SyncCommandStatus.PENDING,
                    lastError = null,
                ),
            )
        }

        val base = System.currentTimeMillis() - 30_000

        cases.forEachIndexed { index, spec ->
            val aggregateId = UUID.randomUUID()

            // The canonical producer payload for CREATE_CASE — exactly the
            // shape CaseRepositoryImpl writes today (the future command-side
            // producer must keep it byte-for-byte identical in structure).
            val payload =
                buildJsonObject {
                    put("caseId", aggregateId.toString())
                    put("caseNumber", spec.caseNumber)
                    put("courtName", spec.courtName)
                    put("caseType", spec.caseType)
                }

            db.syncCommandDao().insert(
                SyncCommand(
                    commandId = UUID.randomUUID(),
                    schemaVersion = 1,
                    aggregateId = aggregateId,
                    type = CommandType.CREATE_CASE,
                    payloadJson = payload.toString(),
                    createdAt = java.time.Instant.ofEpochMilli(base + index),
                    attemptCount = 0,
                ).toEntity(),
            )
        }

        buildWorker(executor).doWork()

        return ParityOutcome(
            transportAttempts = executor.received.size,
            acceptedMutations =
                if (outcome is SyncResult.Accepted) {
                    executor.received.map { cmd -> decoded(cmd.type.name, cmd.payloadJson) }
                } else {
                    emptyList()
                },
            pendingRows = db.syncCommandDao().pendingCount(),
            deadRows = db.syncCommandDao().deadCount(),
        ).also {
            // Producer binding (command side): payload caseId == aggregateId —
            // the future producer MUST bind them (legacy parity requirement).
            executor.received.forEach { cmd ->
                val payloadCaseId =
                    (Json.parseToJsonElement(cmd.payloadJson).jsonObject["caseId"] as JsonPrimitive).content
                assertEquals(cmd.aggregateId.toString(), payloadCaseId)
            }
        }
    }

    private fun buildWorker(executor: SyncCommandExecutor): SyncWorker =
        TestListenableWorkerBuilder<SyncWorker>(context)
            .setWorkerFactory(
                object : WorkerFactory() {
                    override fun createWorker(
                        appContext: Context,
                        workerClassName: String,
                        workerParameters: WorkerParameters,
                    ): ListenableWorker =
                        SyncWorker(appContext, workerParameters, db.syncCommandDao(), executor)
                },
            )
            .build()

    // ── the parity contract ──────────────────────────────────────────────

    @Test
    fun `accepted createCase converges identically on both queues`() =
        runTest {
            val legacy = runLegacy(oneCase, transportAccepts = true)
            val command = runCommand(oneCase, outcome = SyncResult.Accepted(remoteId = "remote-1"))

            assertEquals(
                ParityOutcome(
                    transportAttempts = 1,
                    acceptedMutations = listOf(
                        ObservedMutation(
                            "CREATE_CASE",
                            mapOf(
                                "caseNumber" to "341/2026/جنائي القاهرة",
                                "courtName" to "محكمة جنائية القاهرة",
                                "caseType" to "سرقة",
                            ),
                        ),
                    ),
                    pendingRows = 0,
                    deadRows = 0,
                ),
                legacy,
            )
            // THE parity assertion: both generations reach the same state.
            assertEquals(legacy, command)
        }

    @Test
    fun `rejected createCase is retained identically on both queues`() =
        runTest {
            val legacy = runLegacy(oneCase, transportAccepts = false)
            val command =
                runCommand(oneCase, outcome = SyncResult.Retryable(reason = "transport down"))

            // One attempt, zero acceptances, the mutation stays queued on
            // both — a rejected push is a retained mutation, never a lost or
            // duplicated one, on either generation.
            assertEquals(
                ParityOutcome(
                    transportAttempts = 1,
                    acceptedMutations = emptyList(),
                    pendingRows = 1,
                    deadRows = 0,
                ),
                legacy,
            )
            assertEquals(legacy, command)
        }

    @Test
    fun `poison head row does not block the healthy mutation on either queue`() =
        runTest {
            val legacy = runLegacy(oneCase, transportAccepts = true, poisonFirst = true)
            val command =
                runCommand(oneCase, outcome = SyncResult.Accepted(remoteId = "remote-2"), poisonFirst = true)

            // The anti-livelock contract must hold on BOTH generations: the
            // poison row is dead-lettered (kept, zero data loss) and the
            // healthy mutation behind it still delivers in the same pass.
            assertEquals(
                ParityOutcome(
                    transportAttempts = 1,
                    acceptedMutations = listOf(
                        ObservedMutation(
                            "CREATE_CASE",
                            mapOf(
                                "caseNumber" to "341/2026/جنائي القاهرة",
                                "courtName" to "محكمة جنائية القاهرة",
                                "caseType" to "سرقة",
                            ),
                        ),
                    ),
                    pendingRows = 0,
                    deadRows = 1,
                ),
                legacy,
            )
            assertEquals(legacy, command)
        }

    @Test
    fun `multiple mutations deliver in fifo order on both queues`() =
        runTest {
            val legacy = runLegacy(twoCases, transportAccepts = true)
            val command = runCommand(twoCases, outcome = SyncResult.Accepted(remoteId = "remote-3"))

            // FIFO = enqueue order on both generations (legacy: id ASC;
            // command: createdAtEpochMillis ASC with staggered timestamps).
            assertEquals(
                listOf(
                    ObservedMutation(
                        "CREATE_CASE",
                        mapOf(
                            "caseNumber" to "12/2026/جنائي الجيزة",
                            "courtName" to "محكمة جنائية الجيزة",
                            "caseType" to "نصب",
                        ),
                    ),
                    ObservedMutation(
                        "CREATE_CASE",
                        mapOf(
                            "caseNumber" to "77/2026/جنائي الإسكندرية",
                            "courtName" to "محكمة جنائية الإسكندرية",
                            "caseType" to "اختلاس",
                        ),
                    ),
                ),
                legacy.acceptedMutations,
            )
            assertEquals(legacy, command)
        }

    @Test
    fun `legacy isSynced flip is producer behavior not queue behavior`() =
        runTest {
            // Documents the asymmetry honestly: a REJECTED createCase leaves
            // the case row unsynced on the legacy side (asserted here); the
            // command queue has no case-row coupling until its producer
            // migrates — that producer migration is gated on THIS suite.
            runLegacy(oneCase, transportAccepts = false)

            val row = db.caseDao().observeCases().first()
            assertFalse(row.single().isSynced)
        }
}
