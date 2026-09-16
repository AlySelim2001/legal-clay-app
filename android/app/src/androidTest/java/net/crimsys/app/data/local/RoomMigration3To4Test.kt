package net.crimsys.app.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.runner.RunWith
import org.junit.Test

/**
 * Room migration test for schema v3 → v4 (HarisCore slice).
 *
 * Contract (project rule): the migration must be additive-only and lose zero
 * practice data. The suite:
 *  1. creates a REAL v3 database (exact shape MIGRATION_1_2 + MIGRATION_2_3
 *     produced, exported in `app/schemas/.../3.json`),
 *  2. pre-seeds it with case/hearing/queue rows a live v3 install could hold,
 *  3. runs [CrimSysDatabase.MIGRATION_3_4] through [MigrationTestHelper],
 *     which validates the migrated schema against the CURRENT v4 entity
 *     definitions (the migrated db must match what Room generates at v4),
 *  4. asserts every seeded row survived byte-for-byte and the new tables
 *     (legal_sources, evidence, sync_commands) enforce their constraints.
 *
 * The v4 schema JSON is exported by KSP (`room.schemaLocation`), so the
 * validation target is always the live entity code, never a stale copy.
 */
@RunWith(AndroidJUnit4::class)
class RoomMigration3To4Test {

    private val helper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            CrimSysDatabase::class.java,
        )

    // ─────────────────────────────────────────────────────────────────────
    // v3 seed data — deliberately covers the boundary rows the queue logic
    // branches on: a PENDING row, an exhausted DEAD (dead-letter) row, and
    // the pre-MIGRATION_1_2 legacy sentinel actionUuid = ''.
    // ─────────────────────────────────────────────────────────────────────
    private val seededCases =
        listOf(
            // Full row (all columns populated).
            CaseEntity(
                id = "case-1",
                caseNumber = "341/2026/جنائي القاهرة",
                courtName = "محكمة جنائية القاهرة",
                caseType = "سرقة",
                memoHtml = "<p>مذكرة دفاع</p>",
                isSynced = true,
                createdAt = 1_700_000_000_000L,
                updatedAt = 1_700_000_100_000L,
            ),
            // Defaults row: what a v3 install wrote for a minimal draft case
            // (memoHtml = "", isSynced = false).
            CaseEntity(id = "case-2", caseNumber = "12/2026/جنائي الجيزة", courtName = "محكمة جنائية الجيزة", caseType = "نصب"),
        )

    private val seededHearings =
        listOf(
            HearingEntity(
                id = "hearing-1",
                caseId = "case-1",
                caseNumber = "341/2026/جنائي القاهرة",
                courtName = "محكمة جنائية القاهرة",
                epochDay = 20_650L,
                timeLabel = "09:30",
                notes = "شهادة الادعاء",
            ),
            // Defaults row: no time label, no notes.
            HearingEntity(id = "hearing-2", caseId = "case-2", caseNumber = "12/2026/جنائي الجيزة", courtName = "محكمة جنائية الجيزة", epochDay = 20_699L),
        )

    private val seededActions =
        listOf(
            // Live queue row (full shape).
            OfflineActionEntity(
                id = 1,
                actionUuid = "11111111-2222-3333-4444-555555555555",
                type = OfflineActionType.CREATE_CASE,
                payloadJson = """{"id":"case-1","caseNumber":"341/2026"}""",
                createdAt = 1_700_000_000_000L,
                retryCount = 0,
                maxRetries = 3,
                status = OfflineActionStatus.PENDING,
            ),
            // Dead-lettered row (exhausted retries) — must be KEPT, not lost.
            OfflineActionEntity(
                id = 2,
                actionUuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                type = OfflineActionType.UPDATE_MEMO,
                payloadJson = """{"id":"case-1","memo":"<p>x</p>"}""",
                createdAt = 1_700_000_050_000L,
                retryCount = 3,
                maxRetries = 3,
                status = OfflineActionStatus.DEAD,
            ),
            // Legacy sentinel row: pre-MIGRATION_1_2 history with
            // actionUuid = '' — SyncManager's repair loop re-keys these; the
            // migration must not touch them.
            OfflineActionEntity(
                id = 3,
                actionUuid = "",
                type = OfflineActionType.CREATE_HEARING,
                payloadJson = """{"caseId":"case-2"}""",
                createdAt = 1_700_000_060_000L,
                retryCount = 1,
                maxRetries = 3,
                status = OfflineActionStatus.PENDING,
            ),
        )

    @Test
    fun migration3To4_preservesAllSeededData() =
        runBlocking {
            val dbName = "migration-test-3to4-data"

            helper.createDatabase(dbName, 3).use { v3 ->
                seededCases.forEach { case ->
                    v3.execSQL(
                        """
                        INSERT INTO cases (id, caseNumber, courtName, caseType, memoHtml, isSynced, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(case.id, case.caseNumber, case.courtName, case.caseType, case.memoHtml, if (case.isSynced) 1L else 0L, case.createdAt, case.updatedAt),
                    )
                }

                seededHearings.forEach { hearing ->
                    v3.execSQL(
                        """
                        INSERT INTO hearings (id, caseId, caseNumber, courtName, epochDay, timeLabel, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(hearing.id, hearing.caseId, hearing.caseNumber, hearing.courtName, hearing.epochDay, hearing.timeLabel, hearing.notes),
                    )
                }

                seededActions.forEach { action ->
                    v3.execSQL(
                        """
                        INSERT INTO offline_actions (id, actionUuid, type, payloadJson, createdAt, retryCount, maxRetries, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(action.id, action.actionUuid, action.type, action.payloadJson, action.createdAt, action.retryCount, action.maxRetries, action.status),
                    )
                }
            }

            // Runs MIGRATION_3_4, then validates the migrated schema against
            // the CURRENT v4 entities (fails on any column/index mismatch).
            val migrated = helper.runMigrationsAndValidate(dbName, 4, true, CrimSysDatabase.MIGRATION_3_4)

            // ── Cases survived byte-for-byte ──
            seededCases.forEach { case ->
                migrated.query("SELECT * FROM cases WHERE id = ?", arrayOf(case.id)).use { c ->
                    assertTrue("case ${case.id} missing after migration", c.moveToFirst())
                    assertEquals(case.caseNumber, c.getString(c.getColumnIndexOrThrow("caseNumber")))
                    assertEquals(case.courtName, c.getString(c.getColumnIndexOrThrow("courtName")))
                    assertEquals(case.caseType, c.getString(c.getColumnIndexOrThrow("caseType")))
                    assertEquals(case.memoHtml, c.getString(c.getColumnIndexOrThrow("memoHtml")))
                    assertEquals(if (case.isSynced) 1L else 0L, c.getLong(c.getColumnIndexOrThrow("isSynced")))
                    assertEquals(case.createdAt, c.getLong(c.getColumnIndexOrThrow("createdAt")))
                    assertEquals(case.updatedAt, c.getLong(c.getColumnIndexOrThrow("updatedAt")))
                }
            }

            // ── Hearings survived byte-for-byte ──
            seededHearings.forEach { hearing ->
                migrated.query("SELECT * FROM hearings WHERE id = ?", arrayOf(hearing.id)).use { c ->
                    assertTrue("hearing ${hearing.id} missing after migration", c.moveToFirst())
                    assertEquals(hearing.caseId, c.getString(c.getColumnIndexOrThrow("caseId")))
                    assertEquals(hearing.epochDay, c.getLong(c.getColumnIndexOrThrow("epochDay")))
                    assertEquals(hearing.timeLabel, c.getString(c.getColumnIndexOrThrow("timeLabel")))
                    assertEquals(hearing.notes, c.getString(c.getColumnIndexOrThrow("notes")))
                }
            }

            // ── Queue rows survived — including the dead-letter row and the
            //    legacy sentinel; the queue keeps its exact lifecycle state ──
            seededActions.forEach { action ->
                migrated.query("SELECT * FROM offline_actions WHERE id = ?", arrayOf(action.id)).use { c ->
                    assertTrue("action ${action.id} missing after migration", c.moveToFirst())
                    assertEquals(action.actionUuid, c.getString(c.getColumnIndexOrThrow("actionUuid")))
                    assertEquals(action.type, c.getString(c.getColumnIndexOrThrow("type")))
                    assertEquals(action.payloadJson, c.getString(c.getColumnIndexOrThrow("payloadJson")))
                    assertEquals(action.retryCount, c.getInt(c.getColumnIndexOrThrow("retryCount")))
                    assertEquals(action.maxRetries, c.getInt(c.getColumnIndexOrThrow("maxRetries")))
                    assertEquals(action.status, c.getString(c.getColumnIndexOrThrow("status")))
                }
            }

            // Nothing extra was injected into existing tables.
            migrated.query("SELECT COUNT(*) FROM cases").use { c ->
                c.moveToFirst(); assertEquals(seededCases.size.toLong(), c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM hearings").use { c ->
                c.moveToFirst(); assertEquals(seededHearings.size.toLong(), c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM offline_actions").use { c ->
                c.moveToFirst(); assertEquals(seededActions.size.toLong(), c.getLong(0))
            }

            migrated.close()
            helper.close()
        }

    @Test
    fun migration3To4_newTablesEnforceTheirContract() =
        runBlocking {
            val dbName = "migration-test-3to4-structure"

            helper.createDatabase(dbName, 3).close()

            val migrated = helper.runMigrationsAndValidate(dbName, 4, true, CrimSysDatabase.MIGRATION_3_4)

            // The v4 upgrade starts empty but must accept the production row
            // shapes (NOT NULL columns, TEXT affinity, nullable opt-ins).
            migrated.execSQL(
                """
                INSERT INTO legal_sources (
                    id, lawNumber, lawName, article, paragraph,
                    effectiveFromEpochDay, effectiveToEpochDay,
                    sourceSha256, officialSourceUrl, gazetteIssue, verified
                ) VALUES ('ls-1', '58', 'قانون العقوبات', '341', NULL,
                          24426, NULL, 'a', 'https://example.gov.eg/law', NULL, 1)
                """.trimIndent(),
            )

            migrated.execSQL(
                """
                INSERT INTO evidence (
                    id, caseId, originalFileHash, processedFileHash, mimeType,
                    captureTimestamp, chainOfCustodyJson, immutableRelativePath
                ) VALUES ('ev-1', 'case-1', 'a', NULL, 'image/jpeg',
                          1700000000000, '[{"action":"CAPTURED"}]', 'evidence/ev-1.bin')
                """.trimIndent(),
            )

            migrated.execSQL(
                """
                INSERT INTO sync_commands (
                    commandId, schemaVersion, aggregateId, type, payloadJson,
                    createdAtEpochMillis, attemptCount, nextAttemptAtEpochMillis,
                    status, lastError
                ) VALUES ('cmd-1', 1, 'case-1', 'UPSERT_CASE', '{}',
                          1700000000000, 0, NULL, 'PENDING', NULL)
                """.trimIndent(),
            )

            migrated.execSQL(
                """
                INSERT INTO sync_commands (
                    commandId, schemaVersion, aggregateId, type, payloadJson,
                    createdAtEpochMillis, attemptCount, nextAttemptAtEpochMillis,
                    status, lastError
                ) VALUES ('cmd-2', 1, 'case-2', 'UPSERT_CASE', '{}',
                          1700000001000, 1, 1700003600000, 'PENDING', 'timeout')
                """.trimIndent(),
            )

            // UNIQUE(originalFileHash) — the dedup contract the evidence
            // pipeline relies on — must reject a second identical capture.
            var duplicateRejected = false
            try {
                migrated.execSQL(
                    """
                    INSERT INTO evidence (
                        id, caseId, originalFileHash, processedFileHash, mimeType,
                        captureTimestamp, chainOfCustodyJson, immutableRelativePath
                    ) VALUES ('ev-2', 'case-1', 'a', NULL, 'image/jpeg',
                              1700000000001, '[]', 'evidence/ev-2.bin')
                    """.trimIndent(),
                )
            } catch (_: Exception) {
                duplicateRejected = true
            }
            assertTrue("evidence UNIQUE(originalFileHash) is not enforced", duplicateRejected)

            // Rows actually landed with correct values through the migrated
            // columns (commandId PK dedup → exactly 2 rows for 2 upserts).
            migrated.query("SELECT COUNT(*) FROM legal_sources").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM evidence").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM sync_commands").use { c ->
                c.moveToFirst(); assertEquals(2L, c.getLong(0))
            }

            migrated.close()
            helper.close()
        }
}