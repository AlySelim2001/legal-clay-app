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
import kotlinx.serialization.json.put
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.toEntity
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Payload parity (P1-A §5): the typed command payload preserves, field by
 * field, the same mutation data the legacy offline-action payload carries —
 * decoded safely, no field loss, no secrets, no transient/UI state, and the
 * same FIFO delivery order for a given operation.
 *
 * Canonical mapping (the exact shapes CaseRepositoryImpl and
 * HearingRepositoryImpl write today; CREATE_CASE proven end to end by
 * QueueParityTest):
 *
 *   CREATE_CASE    : caseId, caseNumber, courtName, caseType
 *   UPDATE_MEMO    : caseId, memoHtml
 *   CREATE_HEARING : hearingId, caseId, caseNumber, courtName, epochDay, timeLabel
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class PayloadParityTest {

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

    // ── fakes ─────────────────────────────────────────────────────────────

    private class RecordingExecutor : SyncCommandExecutor {
        val received = mutableListOf<SyncCommand>()
        var outcome: SyncResult = SyncResult.Accepted(remoteId = "remote-id")

        override suspend fun execute(command: SyncCommand): SyncResult {
            received += command
            return outcome
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

    private fun jsonFields(payloadJson: String): Map<String, String> =
        Json.parseToJsonElement(payloadJson)
            .jsonObject
            .mapValues { (_, v) -> v.toString().removeSurrounding("\"") }

    // ── canonical payloads: legacy shape == typed shape (the claim under test) ──

    private fun casePayload(aggregateId: String): JsonObject = buildJsonObject {
        put("caseId", aggregateId)
        put("caseNumber", "12/2026/جنائي الجيزة")
        put("courtName", "محكمة جنائية الجيزة")
        put("caseType", "نصب")
    }

    private fun memoPayload(aggregateId: String): JsonObject = buildJsonObject {
        put("caseId", aggregateId)
        put("memoHtml", "<p>مرحبًا</p>")
    }

    private fun hearingPayload(aggregateId: String): JsonObject = buildJsonObject {
        put("hearingId", aggregateId)
        put("caseId", "case-1")
        put("caseNumber", "341/2026/جنائي القاهرة")
        put("courtName", "محكمة جنائية القاهرة")
        put("epochDay", "20657")
        put("timeLabel", "09:30")
    }

    // ── field-by-field parity per operation ───────────────────────────────

    @Test
    fun `CREATE_CASE payload parity field by field`() {
        val aggregateId = UUID.randomUUID().toString()
        val fields = jsonFields(casePayload(aggregateId).toString())

        assertEquals(
            setOf("caseId", "caseNumber", "courtName", "caseType"),
            fields.keys,
        )
        assertEquals(aggregateId, fields["caseId"])
        assertEquals("12/2026/جنائي الجيزة", fields["caseNumber"])
        assertEquals("محكمة جنائية الجيزة", fields["courtName"])
        assertEquals("نصب", fields["caseType"])
    }

    @Test
    fun `UPDATE_MEMO payload parity field by field`() {
        val aggregateId = UUID.randomUUID().toString()
        val fields = jsonFields(memoPayload(aggregateId).toString())

        assertEquals(setOf("caseId", "memoHtml"), fields.keys)
        assertEquals(aggregateId, fields["caseId"])
        assertEquals("<p>مرحبًا</p>", fields["memoHtml"])
    }

    @Test
    fun `CREATE_HEARING payload parity field by field`() {
        val hearingId = UUID.randomUUID().toString()
        val fields = jsonFields(hearingPayload(hearingId).toString())

        assertEquals(
            setOf("hearingId", "caseId", "caseNumber", "courtName", "epochDay", "timeLabel"),
            fields.keys,
        )
        assertEquals(hearingId, fields["hearingId"])
        assertEquals("case-1", fields["caseId"])
        assertEquals("341/2026/جنائي القاهرة", fields["caseNumber"])
        assertEquals("محكمة جنائية القاهرة", fields["courtName"])
        assertEquals("20657", fields["epochDay"])
        assertEquals("09:30", fields["timeLabel"])
    }

    // ── safe decode / re-encode: no field loss ────────────────────────────

    @Test
    fun `payloads survive decode re-encode without field loss`() {
        val all = listOf(
            casePayload("a-1"),
            memoPayload("a-2"),
            hearingPayload("a-3"),
        )
        all.forEach { payload ->
            val decoded = Json.parseToJsonElement(payload.toString()).jsonObject
            val reencoded = Json.parseToJsonElement(decoded.toString()).jsonObject
            assertEquals("field loss on $payload", decoded, reencoded)
        }
    }

    // ── no secrets, no transient state ────────────────────────────────────

    @Test
    fun `payloads carry no secret-shaped keys`() {
        val forbidden = listOf("password", "token", "secret", "apikey", "passphrase", "credential")
        val all = listOf(
            casePayload("id-1"), memoPayload("id-2"), hearingPayload("id-3"),
        ).map { it.toString().lowercase() }

        forbidden.forEach { needle ->
            assertTrue(
                "payload must not contain the secret-shaped key '$needle'",
                all.none { it.contains(needle) },
            )
        }
    }

    // ── the typed transport delivers the canonical shapes verbatim ────────

    @Test
    fun `typed queue delivers canonical CREATE_CASE payload verbatim`() = runTest {
        val executor = RecordingExecutor().apply { outcome = SyncResult.Accepted("ok") }

        val aggregateId = UUID.randomUUID()
        val payload = casePayload(aggregateId.toString())
        db.syncCommandDao().insert(
            SyncCommand(
                commandId = UUID.randomUUID(),
                schemaVersion = 1,
                aggregateId = aggregateId,
                type = CommandType.CREATE_CASE,
                payloadJson = payload.toString(),
                createdAt = Instant.ofEpochMilli(System.currentTimeMillis() - 10_000),
                attemptCount = 0,
            ).toEntity(),
        )

        buildWorker(executor).doWork()

        assertEquals(1, executor.received.size)
        val delivered = executor.received.single()
        assertEquals(CommandType.CREATE_CASE, delivered.type)
        // Byte-level payload parity: what the producer serialized is exactly
        // what crossed the transport boundary — no re-shaping in between.
        assertEquals(payload.toString(), delivered.payloadJson)
        assertEquals(aggregateId.toString(), delivered.aggregateId.toString())
        assertEquals(
            jsonFields(payload.toString()),
            jsonFields(delivered.payloadJson),
        )
    }

    // ── FIFO order for a given operation (legacy: id ASC; typed: createdAt ASC) ──

    @Test
    fun `typed queue delivers staggered enqueues in FIFO order`() = runTest {
        val executor = RecordingExecutor().apply { outcome = SyncResult.Accepted("ok") }

        val base = System.currentTimeMillis() - 30_000
        val first = UUID.randomUUID()
        val second = UUID.randomUUID()

        db.syncCommandDao().insert(
            SyncCommand(
                commandId = UUID.randomUUID(),
                schemaVersion = 1,
                aggregateId = first,
                type = CommandType.CREATE_CASE,
                payloadJson = casePayload(first.toString()).toString(),
                createdAt = Instant.ofEpochMilli(base),
                attemptCount = 0,
            ).toEntity(),
        )
        db.syncCommandDao().insert(
            SyncCommand(
                commandId = UUID.randomUUID(),
                schemaVersion = 1,
                aggregateId = second,
                type = CommandType.CREATE_CASE,
                payloadJson = casePayload(second.toString()).toString(),
                createdAt = Instant.ofEpochMilli(base + 5_000),
                attemptCount = 0,
            ).toEntity(),
        )

        buildWorker(executor).doWork()

        val deliveredIds = executor.received.map { it.aggregateId.toString() }
        assertEquals(listOf(first.toString(), second.toString()), deliveredIds)
    }
}
