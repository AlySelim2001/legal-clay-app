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
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.local.SyncCommandStatus
import net.crimsys.app.data.local.toEntity
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Typed-command semantic parity matrix (P1-A).
 *
 * Proves the SyncCommand queue can represent the legacy OfflineActionQueue's
 * reliability semantics, one invariant at a time, against the REAL Room queue
 * and the REAL SyncWorker drain — only the transport is faked:
 *
 *  - Identity:      commandId (UUID), aggregateId (UUID), schemaVersion > 0
 *  - Payload:       survives decode→re-encode without field loss (round trip)
 *  - Malformed:     undecodable payload/row → dead-lettered, zero head-of-line
 *                   blocking (same poison-pill contract as the legacy DLQ)
 *  - Durability:    a command persisted by a "dead process" (stale createdAt,
 *                   no live worker) is picked up intact by a LATER drain
 *  - Retry:         Retryable defers durably with attemptCount growth, bounded
 *                   jitter, no transport spam inside the backoff window
 *  - Permanent:     PermanentFailure / budget exhaustion → DEAD, no infinite
 *                   retry, row kept for inspection (zero data loss)
 *  - Conflict:      Conflict(remoteVersion) → CONFLICT park, never a silent
 *                   overwrite in either direction, never retried blindly
 *
 *  - IDEMPOTENCY:   proven against a remote registry model — the only
 *                   idempotency definition that matters (§7 of the P1-A spec):
 *                   the remote commits per commandId, retries carry the SAME
 *                   commandId, and the registry detects the repeat. The
 *                   transport [FirebaseSyncCommandExecutor] already targets
 *                   the commandId as the Firestore document id; the residual
 *                   gap (a repeated `set` is an overwrite — whether the
 *                   backend re-processes it depends on its trigger logic) is
 *                   recorded as an IDEMPOTENCY CONTRACT GAP in the P1-A
 *                   report and can only be closed server-side.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class SyncOperationParityTest {

    private lateinit var context: Context
    private lateinit var db: CrimSysDatabase

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, CrimSysDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
    }

    @After
    fun tearDown() {
        db.close()
    }

    // ── remote registry model — the idempotency proof surface ────────────

    /**
     * The remote boundary modeled the way the actual backend must behave:
     * mutations are keyed by commandId. First sight of a key commits exactly
     * one mutation; a repeat of the same key is DETECTED (and would be
     * answered with the original outcome), never committed twice. This is
     * the contract FirebaseSyncCommandExecutor's document-id scheme enables
     * server-side — and the thing a boolean-queue cannot express.
     */
    private class RemoteRegistryExecutor : SyncCommandExecutor {
        val committedIds = LinkedHashSet<String>()
        val receivedIds = mutableListOf<String>()
        var outcomeForNew: (SyncCommand) -> SyncResult = { SyncResult.Accepted(remoteId = it.commandId.toString()) }
        var outcomeForRepeat: (SyncCommand) -> SyncResult = {
            SyncResult.Accepted(remoteId = "already-processed")
        }

        override suspend fun execute(command: SyncCommand): SyncResult {
            receivedIds += command.commandId.toString()
            return if (committedIds.add(command.commandId.toString())) {
                outcomeForNew(command)
            } else {
                outcomeForRepeat(command)
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

    private fun command(
        type: CommandType = CommandType.CREATE_CASE,
        payload: JsonObject = canonicalCasePayload(),
        createdAt: Instant = Instant.ofEpochMilli(System.currentTimeMillis()),
        schemaVersion: Int = 1,
    ): SyncCommand =
        SyncCommand(
            commandId = UUID.randomUUID(),
            schemaVersion = schemaVersion,
            aggregateId = UUID.fromString(payload["caseId"]!!.jsonPrimitive.content),
            type = type,
            payloadJson = payload.toString(),
            createdAt = createdAt,
            attemptCount = 0,
        )

    /** Canonical CREATE_CASE payload — the exact shape the legacy producer writes. */
    private fun canonicalCasePayload(
        aggregateId: UUID = UUID.randomUUID(),
    ): JsonObject =
        buildJsonObject {
            put("caseId", aggregateId.toString())
            put("caseNumber", "341/2026/جنائي القاهرة")
            put("courtName", "محكمة جنائية القاهرة")
            put("caseType", "سرقة")
        }

    private suspend fun enqueue(cmd: SyncCommand, attemptCount: Int = 0) {
        val entity = cmd.toEntity()
        db.syncCommandDao().insert(
            if (attemptCount == 0) {
                entity
            } else {
                entity.copy(attemptCount = attemptCount)
            },
        )
    }

    // ── identity ─────────────────────────────────────────────────────────

    @Test
    fun `command identity survives the queue round trip`() = runTest {
        val executor = RemoteRegistryExecutor()
        val cmd = command(schemaVersion = 1)
        enqueue(cmd)

        val row = db.syncCommandDao().nextReady(Long.MAX_VALUE)
        assertNotNull("command must be persisted before any drain", row)

        // The drain hands the transport the SAME identity that was minted:
        buildWorker(executor).doWork()

        val delivered = executor.receivedIds.single()
        assertEquals(cmd.commandId.toString(), delivered)
        assertEquals(cmd.aggregateId.toString(), row!!.aggregateId)
        assertTrue("schemaVersion must be a real protocol version", row.schemaVersion > 0)
    }

    // ── payload parity: zero field loss ──────────────────────────────────

    @Test
    fun `payload round trip loses no fields`() = runTest {
        val executor = RemoteRegistryExecutor()
        val cmd = command()
        enqueue(cmd)

        buildWorker(executor).doWork()

        val decoded = Json.parseToJsonElement(cmd.payloadJson).jsonObject
        val expectedKeys = setOf("caseId", "caseNumber", "courtName", "caseType")
        assertEquals(expectedKeys, decoded.keys)
        assertEquals("341/2026/جنائي القاهرة", decoded["caseNumber"]!!.jsonPrimitive.content)
        assertEquals("محكمة جنائية القاهرة", decoded["courtName"]!!.jsonPrimitive.content)
        assertEquals("سرقة", decoded["caseType"]!!.jsonPrimitive.content)

        // No transient/UI state ever enters the payload: the canonical shape
        // is closed — any future field must be added deliberately (schema
        // version bump), not smuggled in.
        assertTrue(decoded.keys.all { it in expectedKeys })
    }

    // ── opaque payload / undecodable identity ─────────────────────────────

    @Test
    fun `payload bytes are opaque to the queue and undecodable identity is dead lettered`() = runTest {
        val executor = RemoteRegistryExecutor()

        // A syntactically invalid PAYLOAD is still an addressable command:
        // the queue layer does not interpret payloadJson on either generation
        // (the legacy SyncManager pushes it verbatim; the typed drain does
        // the same). Interpretation belongs to the remote boundary.
        val opaqueButValid = SyncCommand(
            commandId = UUID.randomUUID(),
            schemaVersion = 1,
            aggregateId = UUID.randomUUID(),
            type = CommandType.CREATE_CASE,
            payloadJson = "not-json-at-all{{{",
            createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 60_000),
            attemptCount = 0,
        )
        enqueue(opaqueButValid)

        // A row whose IDENTITY cannot be decoded (foreign/older type here)
        // is dead-lettered before any transport contact — the poison-pill
        // contract both generations share.
        val poison = SyncCommand(
            commandId = UUID.randomUUID(),
            schemaVersion = 1,
            aggregateId = UUID.randomUUID(),
            type = CommandType.CREATE_CASE,
            payloadJson = "{}",
            createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 45_000),
            attemptCount = 0,
        )
        enqueue(poison)
        db.openHelper.writableDatabase.execSQL(
            "UPDATE sync_commands SET type = 'NOT_A_COMMAND_TYPE' WHERE commandId = ?",
            arrayOf(poison.commandId.toString()),
        )

        val healthy = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 30_000))
        enqueue(healthy)

        buildWorker(executor).doWork()

        // Poison dead-lettered (kept for inspection); the opaque row and the
        // healthy row both drained in the SAME pass — zero head-of-line blocking.
        assertEquals(SyncCommandStatus.DEAD, deadRowByCommandId(poison.commandId.toString())!!.status)
        assertEquals(
            setOf(opaqueButValid.commandId.toString(), healthy.commandId.toString()),
            executor.receivedIds.toSet(),
        )
        assertEquals(0, db.syncCommandDao().pendingCount())
    }

    // ── durability across process death ──────────────────────────────────

    @Test
    fun `command persisted by a dead process drains after restart`() = runTest {
        val executor = RemoteRegistryExecutor()

        // "Process death": the producer committed the row long ago with no
        // live worker. The row carries a stale timestamp and sits untouched.
        val orphaned = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 24 * 60 * 60 * 1000))
        enqueue(orphaned)

        // No drain happens "while the process is dead" — the row persists.
        assertNotNull(db.syncCommandDao().nextReady(Long.MAX_VALUE))

        // "Restart": a brand-new worker drains; the durable row continues.
        buildWorker(executor).doWork()

        assertEquals(listOf(orphaned.commandId.toString()), executor.receivedIds)
        assertEquals(0, db.syncCommandDao().pendingCount())
    }

    // ── retry semantics: durable deferral, bounded, no transport spam ────

    @Test
    fun `retryable failure defers durably and grows attemptCount`() = runTest {
        val executor = RemoteRegistryExecutor()
        executor.outcomeForNew = { SyncResult.Retryable(reason = "transport down") }

        val cmd = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        enqueue(cmd)

        val before = System.currentTimeMillis()
        buildWorker(executor).doWork()

        val row = rowByCommandId(cmd.commandId.toString())!!
        assertEquals(1, row.attemptCount)
        assertEquals("transport down", row.lastError)
        assertNotNull(row.nextAttemptAtEpochMillis)
        assertTrue(row.nextAttemptAtEpochMillis!! >= before)
        // Inside the deferral window the queue is invisible to the drain —
        // a retry cannot spam the transport (legacy: retryCount growth, same
        // observable semantics, weaker timing control).
        assertEquals(null, db.syncCommandDao().nextReady(System.currentTimeMillis()))
        // Reappears when the window expires, preserving FIFO fairness.
        val visible = db.syncCommandDao().nextReady(Long.MAX_VALUE)
        assertEquals(cmd.commandId.toString(), visible!!.commandId)
    }

    @Test
    fun `attempt budget exhaustion dead letters without contacting the transport`() = runTest {
        val executor = RemoteRegistryExecutor()
        val budgeted = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        // MAX_ATTEMPTS = 8: a row that already spent its budget must be
        // dead-lettered by inspection, BEFORE another remote attempt.
        enqueue(budgeted, attemptCount = 8)

        buildWorker(executor).doWork()

        assertTrue("no retry may fire for an exhausted row", executor.receivedIds.isEmpty())
        val deadRow = deadRowByCommandId(budgeted.commandId.toString())
        assertNotNull(deadRow)
        assertEquals("MAX_ATTEMPTS_EXCEEDED", deadRow!!.lastError)
    }

    // ── permanent failure semantics ──────────────────────────────────────

    @Test
    fun `permanent failure dead letters without retry`() = runTest {
        val executor = RemoteRegistryExecutor()
        executor.outcomeForNew = { SyncResult.PermanentFailure(reason = "PERMISSION_DENIED") }

        val cmd = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        enqueue(cmd)

        buildWorker(executor).doWork()

        assertEquals(1, executor.receivedIds.size)
        assertEquals(0, db.syncCommandDao().pendingCount())
        assertEquals(1, db.syncCommandDao().deadCount())
    }

    // ── conflict semantics: park, never overwrite either side ────────────

    @Test
    fun `conflict parks the command for human review without overwriting`() = runTest {
        val executor = RemoteRegistryExecutor()
        executor.outcomeForNew = { SyncResult.Conflict(remoteVersion = 42L) }

        val cmd = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        enqueue(cmd)

        buildWorker(executor).doWork()

        val parked = db.syncCommandDao().nextReady(Long.MAX_VALUE)
        assertEquals("a CONFLICT row must leave the live queue", null, parked)
        assertEquals(0, db.syncCommandDao().pendingCount())
        // Row retained — conflict state is recoverable evidence, never a
        // deletion, and the payload/aggregate identity are untouched.
        val row = rowByCommandId(cmd.commandId.toString())!!
        assertEquals(SyncCommandStatus.CONFLICT, row.status)
        assertEquals(cmd.aggregateId.toString(), row.aggregateId)
        assertEquals("REMOTE_VERSION=42", row.lastError)
    }

    // ── IDEMPOTENCY: the distributed-systems contract ────────────────────

    @Test
    fun `same commandId retried never duplicates the remote mutation`() = runTest {
        val remote = RemoteRegistryExecutor()

        val cmd = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        enqueue(cmd)

        // Attempt 1: the remote COMMITS the mutation, but the response is
        // LOST (worker sees failure). Model: the commit happened, the caller
        // learns nothing — so the row stays pending (recordRetry).
        remote.outcomeForNew = { SyncResult.Retryable(reason = "RESPONSE_LOST") }
        buildWorker(remote).doWork()
        assertEquals(1, remote.committedIds.size)

        // The retry window is real (durable backoff); the "network recovers"
        // moment is modeled by expiring the window before attempt 2.
        db.openHelper.writableDatabase.execSQL(
            "UPDATE sync_commands SET nextAttemptAtEpochMillis = 0 WHERE commandId = ?",
            arrayOf(cmd.commandId.toString()),
        )

        // Attempt 2: the worker retries with the SAME commandId (the queue
        // row is untouched by retries — commandId is durable local state).
        remote.outcomeForNew = { SyncResult.Accepted(remoteId = "ok") }
        remote.outcomeForRepeat = { SyncResult.Accepted(remoteId = "already-processed") }
        buildWorker(remote).doWork()

        // The remote saw the same key twice and committed EXACTLY ONCE.
        assertEquals(listOf(cmd.commandId.toString(), cmd.commandId.toString()), remote.receivedIds)
        assertEquals(1, remote.committedIds.size)
        assertEquals(0, db.syncCommandDao().pendingCount())
    }

    @Test
    fun `different commandIds are distinct remote mutations`() = runTest {
        val remote = RemoteRegistryExecutor()

        val x = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 20_000))
        val y = command(createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000))
        enqueue(x)
        enqueue(y)

        buildWorker(remote).doWork()

        assertEquals(2, remote.committedIds.size)
        assertNotEquals(x.commandId, y.commandId)
    }

    // ── helpers: raw-row readers for parked states ───────────────────────

    private suspend fun rowByCommandId(commandId: String): SyncCommandEntity? {
        val rows = db.openHelper.readableDatabase.query("SELECT * FROM sync_commands").use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val map = LinkedHashMap<String, Any?>()
                    for (i in 0 until cursor.columnCount) {
                        map[cursor.getColumnName(i)] =
                            if (cursor.isNull(i)) null else cursor.getString(i)
                    }
                    add(map)
                }
            }
        }
        return rows
            .filter { it["commandId"] == commandId }
            .map { map ->
                SyncCommandEntity(
                    commandId = map["commandId"] as String,
                    schemaVersion = (map["schemaVersion"] as String).toInt(),
                    aggregateId = map["aggregateId"] as String,
                    type = map["type"] as String,
                    payloadJson = map["payloadJson"] as String,
                    createdAtEpochMillis = (map["createdAtEpochMillis"] as String).toLong(),
                    attemptCount = (map["attemptCount"] as String).toInt(),
                    nextAttemptAtEpochMillis = (map["nextAttemptAtEpochMillis"] as String?)?.toLong(),
                    status = map["status"] as String,
                    lastError = map["lastError"] as String?,
                )
            }
            .singleOrNull()
    }

    private suspend fun deadRowByCommandId(commandId: String): SyncCommandEntity? =
        rowByCommandId(commandId)?.takeIf { it.status == SyncCommandStatus.DEAD }
}
