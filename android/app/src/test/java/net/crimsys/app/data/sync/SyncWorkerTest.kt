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
import kotlin.time.Duration.Companion.minutes
import kotlinx.coroutines.test.runTest
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.local.SyncCommandStatus
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * SyncWorker drain integration test — JVM only (Robolectric + work-testing),
 * per RELEASE_CHECKLIST.md §3.1 "اختبارات المرحلة التالية".
 *
 * What makes this an integration test, not a unit test: the drain runs
 * against a REAL Room queue (in-memory) executing the production SQL
 * (`nextReady` / `recordRetry` / `markDead` / `markConflict` /
 * `deleteAccepted`), with only the remote transport faked behind
 * [SyncCommandExecutor]. `WorkManagerTestInitHelper` satisfies the
 * scheduleSelf() re-drain path; the scheduled request is deliberately not
 * driven — the durable contract is the ROW deferral, asserted below.
 *
 * Parked-row reads: `nextReady` selects `status = 'PENDING'` only, so rows
 * parked as CONFLICT/DEAD are asserted through a direct SELECT
 * ([rowByCommandId]) — the same contract a review UI would rely on.
 *
 * Robolectric config:
 *  - `application = Application::class` replaces the @HiltAndroidApp
 *    [net.crimsys.app.CrimSysApplication] — Hilt/Firestore cannot start on
 *    the JVM, and the drain must not depend on them (the worker receives its
 *    collaborators through a plain WorkerFactory).
 *  - `sdk = 35` deliberately, not 36: Robolectric 4.16 supports SDK 36
 *    (Baklava) but requires a JDK 21 test JVM for that target, while the
 *    project verification ladder (verify.sh, RELEASE_CHECKLIST.md §3.1)
 *    standardizes on JDK 17. The drain under test is SDK-independent
 *    (Room SQL + WorkManager), so SDK 35 keeps the gate green on JDK 17.
 *    Bump to [36] together with a JDK 21 test JVM in the same commit.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class SyncWorkerTest {

    private lateinit var context: Context
    private lateinit var db: CrimSysDatabase
    private lateinit var dao: SyncCommandDao

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()

        db = Room.inMemoryDatabaseBuilder(context, CrimSysDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.syncCommandDao()

        // scheduleSelf() calls WorkManager.getInstance(...) — the test
        // initializer makes that legal on the JVM (requests are tracked,
        // never executed: no driver is installed).
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
    }

    @After
    fun tearDown() {
        db.close()
    }

    // ── fakes / builders / row readers ───────────────────────────────────

    /** Transport fake: replays scripted outcomes and records what it saw. */
    private class FakeExecutor(
        vararg outcomes: SyncResult,
    ) : SyncCommandExecutor {
        private val queue = ArrayDeque(outcomes.toList())
        val received = mutableListOf<SyncCommand>()

        override suspend fun execute(command: SyncCommand): SyncResult {
            received += command
            return queue.removeFirstOrNull()
                ?: error("unexpected extra execute() for ${command.commandId}")
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
                        SyncWorker(appContext, workerParameters, dao, executor)
                },
            )
            .build()

    private suspend fun enqueueCommand(
        type: String = CommandType.CREATE_CASE.name,
        commandId: String = UUID.randomUUID().toString(),
        aggregateId: String = UUID.randomUUID().toString(),
        createdAt: Long = System.currentTimeMillis() - 60_000,
        attemptCount: Int = 0,
    ): SyncCommandEntity =
        SyncCommandEntity(
            commandId = commandId,
            schemaVersion = 1,
            aggregateId = aggregateId,
            type = type,
            payloadJson = "{}",
            createdAtEpochMillis = createdAt,
            attemptCount = attemptCount,
            nextAttemptAtEpochMillis = null,
            status = SyncCommandStatus.PENDING,
            lastError = null,
        ).also { dao.insert(it) }

    /**
     * Direct row read bypassing the `status = 'PENDING'` filter of
     * [SyncCommandDao.nextReady] — the only way to observe parked
     * (CONFLICT/DEAD) rows, exactly as a review UI would.
     */
    private suspend fun rowByCommandId(
        commandId: String,
    ): SyncCommandEntity? =
        // allowMainThreadQueries() is enabled for the in-memory db.
        db.openHelper.readableDatabase
            .query(
                "SELECT * FROM sync_commands WHERE commandId = ?",
                arrayOf(commandId),
            )
            .use { c ->
                if (!c.moveToFirst()) {
                    null
                } else {
                    SyncCommandEntity(
                        commandId = c.getString(c.getColumnIndexOrThrow("commandId")),
                        schemaVersion = c.getInt(c.getColumnIndexOrThrow("schemaVersion")),
                        aggregateId = c.getString(c.getColumnIndexOrThrow("aggregateId")),
                        type = c.getString(c.getColumnIndexOrThrow("type")),
                        payloadJson = c.getString(c.getColumnIndexOrThrow("payloadJson")),
                        createdAtEpochMillis = c.getLong(c.getColumnIndexOrThrow("createdAtEpochMillis")),
                        attemptCount = c.getInt(c.getColumnIndexOrThrow("attemptCount")),
                        nextAttemptAtEpochMillis = if (c.isNull(c.getColumnIndexOrThrow("nextAttemptAtEpochMillis"))) null else c.getLong(c.getColumnIndexOrThrow("nextAttemptAtEpochMillis")),
                        status = c.getString(c.getColumnIndexOrThrow("status")),
                        lastError = if (c.isNull(c.getColumnIndexOrThrow("lastError"))) null else c.getString(c.getColumnIndexOrThrow("lastError")),
                    )
                }
            }

    // ── outcomes ─────────────────────────────────────────────────────────

    @Test
    fun `accepted command is deleted from the queue`() =
        runTest {
            val row = enqueueCommand()
            val worker = buildWorker(FakeExecutor(SyncResult.Accepted(remoteId = "remote-1")))

            val result = worker.doWork()

            assertEquals(ListenableWorker.Result.success(), result)
            assertNull(dao.nextReady(Long.MAX_VALUE)) // queue fully drained
            assertEquals(0, dao.pendingCount())
            assertNull("accepted row must be deleted, not parked", rowByCommandId(row.commandId))
        }

    @Test
    fun `retryable command is deferred durably`() =
        runTest {
            enqueueCommand()
            val worker =
                buildWorker(
                    FakeExecutor(
                        SyncResult.Retryable(
                            reason = "socket timeout",
                            retryAfter = 5.minutes,
                        ),
                    ),
                )

            val result = worker.doWork()

            assertEquals(ListenableWorker.Result.success(), result)

            // Inside its backoff window the row is invisible to the drain…
            assertNull(dao.nextReady(System.currentTimeMillis()))

            // …but durably present: budget advanced, reason recorded, future
            // nextAttemptAt set — a process death here loses nothing.
            val row = dao.nextReady(Long.MAX_VALUE)
            assertNotNull(row)
            row!!

            assertEquals(SyncCommandStatus.PENDING, row.status)
            assertEquals(1, row.attemptCount)
            assertEquals("socket timeout", row.lastError)
            assertNotNull(row.nextAttemptAtEpochMillis)
            assertTrue(
                "deferral must be in the future",
                row.nextAttemptAtEpochMillis!! > System.currentTimeMillis(),
            )
            assertEquals(1, dao.pendingCount())
        }

    @Test
    fun `conflict parks the row for review`() =
        runTest {
            val row = enqueueCommand()
            val worker = buildWorker(FakeExecutor(SyncResult.Conflict(remoteVersion = 42L)))

            assertEquals(ListenableWorker.Result.success(), worker.doWork())

            // Parked, NOT retried and NOT deleted — human review required.
            assertEquals(0, dao.pendingCount())
            val parked = rowByCommandId(row.commandId)
            assertNotNull(parked)
            parked!!

            assertEquals(SyncCommandStatus.CONFLICT, parked.status)
            assertEquals("REMOTE_VERSION=42", parked.lastError)
        }

    @Test
    fun `permanent failure dead-letters the row`() =
        runTest {
            val row = enqueueCommand()
            val worker =
                buildWorker(FakeExecutor(SyncResult.PermanentFailure(reason = "schema mismatch")))

            assertEquals(ListenableWorker.Result.success(), worker.doWork())

            // Dead-lettered rows are KEPT for inspection, never deleted.
            assertEquals(0, dao.pendingCount())
            val dead = rowByCommandId(row.commandId)
            assertNotNull(dead)
            dead!!

            assertEquals(SyncCommandStatus.DEAD, dead.status)
            assertEquals("schema mismatch", dead.lastError)
        }

    @Test
    fun `undecodable head row dead-letters without blocking the queue`() =
        runTest {
            // Livelock regression: a row that can never parse sits at the
            // HEAD. Without the decode guard its attempt counter never
            // advanced, MAX_ATTEMPTS never fired, and every future drain
            // pass crashed into it forever.
            val poison =
                enqueueCommand(
                    type = "NOT_A_COMMAND_TYPE",
                    createdAt = System.currentTimeMillis() - 120_000,
                )
            val healthy = enqueueCommand(createdAt = System.currentTimeMillis() - 60_000)

            val executor = FakeExecutor(SyncResult.Accepted(remoteId = "remote-2"))
            val worker = buildWorker(executor)

            assertEquals(ListenableWorker.Result.success(), worker.doWork())

            // The poison row is parked, not routed…
            assertEquals(1, dao.deadCount())
            val parked = rowByCommandId(poison.commandId)
            assertNotNull(parked)
            assertEquals("UNDECODABLE_COMMAND_ROW", parked!!.lastError)

            // …and the healthy row behind it was drained in the same pass.
            assertEquals(1, executor.received.size)
            assertEquals(healthy.aggregateId, executor.received.single().aggregateId.toString())
            assertNull(rowByCommandId(healthy.commandId))
            assertEquals(0, dao.pendingCount())
        }

    @Test
    fun `max attempts row dead-letters without touching the transport`() =
        runTest {
            // SyncWorker.MAX_ATTEMPTS = 8 — a row that already burned its
            // budget must dead-letter WITHOUT another transport attempt.
            val row = enqueueCommand(attemptCount = 8)
            val executor = FakeExecutor(SyncResult.Accepted(remoteId = "remote-3"))
            val worker = buildWorker(executor)

            assertEquals(ListenableWorker.Result.success(), worker.doWork())

            assertEquals(0, executor.received.size)
            assertEquals(0, dao.pendingCount())
            val dead = rowByCommandId(row.commandId)
            assertNotNull(dead)
            dead!!

            assertEquals(SyncCommandStatus.DEAD, dead.status)
            assertEquals("MAX_ATTEMPTS_EXCEEDED", dead.lastError)
        }

    @Test
    fun `empty queue drains to immediate success`() =
        runTest {
            val executor = FakeExecutor(SyncResult.Accepted(remoteId = "remote-4"))
            val worker = buildWorker(executor)

            assertEquals(ListenableWorker.Result.success(), worker.doWork())
            assertEquals(0, executor.received.size)
        }
}
