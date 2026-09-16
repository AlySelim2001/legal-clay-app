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
import java.io.File
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.test.runTest
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.toEntity
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Crash-consistency matrix (master prompt §24 / P1-A durability gate §8).
 *
 * ── The full matrix and where each row is PROVEN ─────────────────────────
 *
 * | Scenario                          | Proven by                                            |
 * |-----------------------------------|------------------------------------------------------|
 * | DB transaction succeeds           | producer-side atomicity tests — P1-B RED tests,      |
 * |   → Case + Command exist          |   written BEFORE the repository migration            |
 * | DB transaction fails              | producer-side atomicity tests — P1-B RED tests       |
 * |   → neither exists                |                                                      |
 * | Command insertion fails           | producer-side atomicity tests — P1-B RED tests       |
 * |   → entire transaction rolls back |                                                      |
 * | App killed before Worker          | THIS SUITE — file-backed reopen rows below           |
 * |   → Case + Command remain         |                                                      |
 * | Network unavailable               | SyncOperationParityTest — Retryable → durable        |
 * |   → Command remains pending       |   deferral, row stays PENDING                        |
 * | Remote fails transiently          | SyncWorkerTest + SyncOperationParityTest —           |
 * |   → Retryable                     |   typed Retryable mapping, attemptCount growth       |
 * | Remote permanently invalid        | SyncWorkerTest + SyncOperationParityTest —           |
 * |   → PermanentFailure              |   DEAD without retry                                 |
 * | Remote succeeds / response lost   | SyncOperationParityTest — same commandId retry       |
 * |   → retry same commandId          |   reaches the remote registry exactly twice          |
 * | Retry same commandId              | SyncOperationParityTest — registry commits ONCE      |
 * |   → no duplicate mutation         |                                                      *
 *
 * The rows marked P1-B are the producer-side atomicity invariants. They are
 * intentionally NOT faked here: the repositories still enqueue through the
 * legacy queue during P1-A, so there is no transactional Case+Command write
 * to test yet. Per the TDD rule, their RED tests will be written before the
 * CaseRepositoryImpl migration and MUST pass before P1-B is declared done.
 * Pretending they pass in P1-A would be a fake-green suite.
 *
 * What THIS suite proves on a FILE-BACKED database (not in-memory — spec §8):
 * a command row committed by a "dead process" survives a full database
 * close/reopen and continues draining afterwards, including its retry state.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class CrashConsistencyMatrixTest {

    private lateinit var context: Context
    private lateinit var dbFile: File

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
        dbFile = context.getDatabasePath("p1a_crash_matrix.db")
        dbFile.parentFile?.mkdirs()
        // Fresh file per test — no cross-test contamination.
        dbFile.delete()
        File(dbFile.path + "-wal").delete()
        File(dbFile.path + "-shm").delete()
    }

    @After
    fun tearDown() {
        dbFile.delete()
        File(dbFile.path + "-wal").delete()
        File(dbFile.path + "-shm").delete()
    }

    private fun openDb(): CrimSysDatabase =
        Room.databaseBuilder(context, CrimSysDatabase::class.java, dbFile.name)
            .allowMainThreadQueries()
            .build()

    private class RecordingExecutor : SyncCommandExecutor {
        val received = mutableListOf<SyncCommand>()
        var outcome: SyncResult = SyncResult.Accepted(remoteId = "ok")

        override suspend fun execute(command: SyncCommand): SyncResult {
            received += command
            return outcome
        }
    }

    private fun buildWorker(executor: SyncCommandExecutor, db: CrimSysDatabase): SyncWorker =
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

    private fun command(createdAtMillis: Long): SyncCommand {
        val aggregateId = UUID.randomUUID()
        return SyncCommand(
            commandId = UUID.randomUUID(),
            schemaVersion = 1,
            aggregateId = aggregateId,
            type = CommandType.CREATE_CASE,
            payloadJson = buildJsonObject {
                put("caseId", aggregateId.toString())
                put("caseNumber", "77/2026/جنائي الإسكندرية")
                put("courtName", "محكمة جنائية الإسكندرية")
                put("caseType", "اختلاس")
            }.toString(),
            createdAt = Instant.ofEpochMilli(createdAtMillis),
            attemptCount = 0,
        )
    }

    @Test
    fun `command rows survive process death and drain after reopen`() = runTest {
        val db = openDb()
        val dao = db.syncCommandDao()
        val first = command(System.currentTimeMillis() - 20_000)
        val second = command(System.currentTimeMillis() - 10_000)
        dao.insert(first.toEntity())
        dao.insert(second.toEntity())

        // ── "process death": the database is fully closed ──
        db.close()

        // ── "restart": a new process opens the same database file ──
        val reopened = openDb()
        assertEquals(2, reopened.syncCommandDao().pendingCount())

        val executor = RecordingExecutor()
        buildWorker(executor, reopened).doWork()

        // FIFO order preserved across the death/reopen boundary.
        assertEquals(
            listOf(first.commandId.toString(), second.commandId.toString()),
            executor.received.map { it.commandId.toString() },
        )
        assertEquals(0, reopened.syncCommandDao().pendingCount())
        reopened.close()
    }

    @Test
    fun `retry deferral state survives reopen and resumes without early retry`() = runTest {
        val db = openDb()
        val cmd = command(System.currentTimeMillis() - 10_000)
        db.syncCommandDao().insert(cmd.toEntity())

        // Attempt 1 fails retryably → durable deferral (attemptCount=1, future window).
        val executor1 = RecordingExecutor().apply { outcome = SyncResult.Retryable("network flap") }
        buildWorker(executor1, db).doWork()
        db.close()

        // ── restart before the backoff window expires ──
        val reopened = openDb()
        assertEquals(null, reopened.syncCommandDao().nextReady(System.currentTimeMillis()))
        // The row is still there, still pending, still carrying attempt 1.
        val rows = reopened.syncCommandDao().pendingCount()
        assertEquals(1, rows)

        // ── the window expires (modeled by advancing the visible clock) ──
        reopened.openHelper.writableDatabase.execSQL(
            "UPDATE sync_commands SET nextAttemptAtEpochMillis = 0 WHERE commandId = ?",
            arrayOf(cmd.commandId.toString()),
        )
        val executor2 = RecordingExecutor().apply { outcome = SyncResult.Accepted("ok-after-restart") }
        buildWorker(executor2, reopened).doWork()

        assertEquals(1, executor2.received.size)
        assertEquals(cmd.commandId.toString(), executor2.received.single().commandId.toString())
        assertEquals("retry must keep the SAME commandId (§26)", cmd.commandId, executor2.received.single().commandId)
        assertEquals(0, reopened.syncCommandDao().pendingCount())
        reopened.close()
    }

    @Test
    fun `parked conflict rows survive reopen untouched`() = runTest {
        val db = openDb()
        val cmd = command(System.currentTimeMillis() - 10_000)
        db.syncCommandDao().insert(cmd.toEntity())

        val executor = RecordingExecutor().apply { outcome = SyncResult.Conflict(remoteVersion = 7L) }
        buildWorker(executor, db).doWork()
        db.close()

        val reopened = openDb()
        // A parked row is durable evidence: still queued-but-not-live after
        // restart, waiting for deterministic human resolution.
        assertEquals(0, reopened.syncCommandDao().pendingCount())
        assertEquals(0, reopened.syncCommandDao().deadCount())
        // Raw read: the row exists with CONFLICT status and its payload intact.
        reopened.openHelper.readableDatabase
            .query("SELECT status, payloadJson FROM sync_commands WHERE commandId = ?", arrayOf(cmd.commandId.toString()))
            .use { cursor ->
                assertTrue("conflict row must survive reopen", cursor.moveToFirst())
                assertEquals("CONFLICT", cursor.getString(0))
                assertTrue(cursor.getString(1).contains(cmd.aggregateId.toString()))
            }
        reopened.close()
    }
}
