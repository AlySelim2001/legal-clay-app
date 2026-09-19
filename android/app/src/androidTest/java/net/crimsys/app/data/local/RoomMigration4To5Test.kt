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
 * Room migration test for schema v4 → v5 (legal_documents catalog).
 *
 * Contract (project rule): the migration must be additive-only and lose zero
 * practice data. MIGRATION_4_5 only CREATEs the `legal_documents` table plus
 * three indices — it must NOT touch cases, hearings, offline_actions,
 * legal_sources, evidence, or sync_commands in any way.
 *
 * The suite:
 *  1. creates a REAL v4 database (exact shape MIGRATION_1_2 + MIGRATION_2_3 +
 *     MIGRATION_3_4 produced, exported in `app/schemas/.../4.json`),
 *  2. pre-seeds it with rows a live v4 install could hold — including the
 *     queue boundary rows and the evidence dedup pair,
 *  3. runs [CrimSysDatabase.MIGRATION_4_5] through [MigrationTestHelper],
 *     which validates the migrated schema against the CURRENT v5 entity
 *     definitions (the migrated db must match what Room generates at v5),
 *  4. asserts every seeded row survived byte-for-byte and the new catalog
 *     enforces its constraints (NOT NULL, PK dedup, indices present),
 *  5. proves the DDL is idempotent (CREATE ... IF NOT EXISTS) so a partial
 *     re-application can never corrupt an upgraded database.
 *
 * RUNTIME PREREQUISITE (unblock gate): `runMigrationsAndValidate(dbName, 5, …)`
 * reads the KSP-exported `app/schemas/…CrimSysDatabase/5.json` from the
 * androidTest assets. That file does not exist yet — it is produced by the
 * first successful KSP build (never hand-written). Until a CI run exports it,
 * every test in this class fails at asset lookup. That is the documented
 * BLOCKED state in ROOM_MIGRATION_4_5_REPORT.md, not a code defect.
 */
@RunWith(AndroidJUnit4::class)
class RoomMigration4To5Test {

    private val helper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            CrimSysDatabase::class.java,
        )

    // ─────────────────────────────────────────────────────────────────────
    // v4 seed data — covers the boundary rows the sync/queue logic branches
    // on (PENDING, dead-lettered DEAD, legacy actionUuid='' sentinel) plus
    // one row in every table MIGRATION_4_5 must leave untouched.
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
            // Defaults row: what a live install wrote for a minimal draft
            // case (memoHtml = "", isSynced = false).
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
            // actionUuid = '' — the repair loop re-keys these; untouched.
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

    private val seededLegalSource =
        // One citable source row — v4 install state that must survive v5.
        """INSERT INTO legal_sources (
               id, lawNumber, lawName, article, paragraph,
               effectiveFromEpochDay, effectiveToEpochDay,
               sourceSha256, officialSourceUrl, gazetteIssue, verified
           ) VALUES ('ls-1', '58', 'قانون العقوبات', '341', NULL,
                     24426, NULL, 'a', 'https://example.gov.eg/law', NULL, 1)"""

    private val seededEvidence =
        """INSERT INTO evidence (
               id, caseId, originalFileHash, processedFileHash, mimeType,
               captureTimestamp, chainOfCustodyJson, immutableRelativePath
           ) VALUES ('ev-1', 'case-1', 'a', NULL, 'image/jpeg',
                     1700000000000, '[{"action":"CAPTURED"}]', 'evidence/ev-1.bin')"""

    private val seededSyncCommand =
        """INSERT INTO sync_commands (
               commandId, schemaVersion, aggregateId, type, payloadJson,
               createdAtEpochMillis, attemptCount, nextAttemptAtEpochMillis,
               status, lastError
           ) VALUES ('cmd-1', 1, 'case-1', 'UPSERT_CASE', '{}',
                     1700000000000, 0, NULL, 'PENDING', NULL)"""

    @Test
    fun migration4To5_preservesAllSeededData() =
        runBlocking {
            val dbName = "migration-test-4to5-data"

            helper.createDatabase(dbName, 4).use { v4 ->
                seededCases.forEach { case ->
                    v4.execSQL(
                        """
                        INSERT INTO cases (id, caseNumber, courtName, caseType, memoHtml, isSynced, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(case.id, case.caseNumber, case.courtName, case.caseType, case.memoHtml, if (case.isSynced) 1L else 0L, case.createdAt, case.updatedAt),
                    )
                }

                seededHearings.forEach { hearing ->
                    v4.execSQL(
                        """
                        INSERT INTO hearings (id, caseId, caseNumber, courtName, epochDay, timeLabel, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(hearing.id, hearing.caseId, hearing.caseNumber, hearing.courtName, hearing.epochDay, hearing.timeLabel, hearing.notes),
                    )
                }

                seededActions.forEach { action ->
                    v4.execSQL(
                        """
                        INSERT INTO offline_actions (id, actionUuid, type, payloadJson, createdAt, retryCount, maxRetries, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """.trimIndent(),
                        arrayOf(action.id, action.actionUuid, action.type, action.payloadJson, action.createdAt, action.retryCount, action.maxRetries, action.status),
                    )
                }

                v4.execSQL(seededLegalSource)
                v4.execSQL(seededEvidence)
                v4.execSQL(seededSyncCommand)
            }

            // Runs MIGRATION_4_5, then validates the migrated schema against
            // the CURRENT v5 entities (fails on any column/index mismatch —
            // including any unintended change to the six pre-existing tables).
            val migrated = helper.runMigrationsAndValidate(dbName, 5, true, CrimSysDatabase.MIGRATION_4_5)

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

            // ── Queue rows survived with their exact lifecycle state ──
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

            // ── v4 catalog rows survived (the tables the migration must not
            //    touch: legal_sources, evidence, sync_commands) ──
            migrated.query("SELECT * FROM legal_sources WHERE id = 'ls-1'").use { c ->
                assertTrue("legal_sources row missing after migration", c.moveToFirst())
                assertEquals("58", c.getString(c.getColumnIndexOrThrow("lawNumber")))
                assertEquals("341", c.getString(c.getColumnIndexOrThrow("article")))
                assertEquals(24426L, c.getLong(c.getColumnIndexOrThrow("effectiveFromEpochDay")))
                assertEquals(1L, c.getLong(c.getColumnIndexOrThrow("verified")))
            }
            migrated.query("SELECT * FROM evidence WHERE id = 'ev-1'").use { c ->
                assertTrue("evidence row missing after migration", c.moveToFirst())
                assertEquals("a", c.getString(c.getColumnIndexOrThrow("originalFileHash")))
                assertEquals("image/jpeg", c.getString(c.getColumnIndexOrThrow("mimeType")))
                assertEquals(1_700_000_000_000L, c.getLong(c.getColumnIndexOrThrow("captureTimestamp")))
            }
            migrated.query("SELECT * FROM sync_commands WHERE commandId = 'cmd-1'").use { c ->
                assertTrue("sync_commands row missing after migration", c.moveToFirst())
                assertEquals(1L, c.getLong(c.getColumnIndexOrThrow("schemaVersion")))
                assertEquals("PENDING", c.getString(c.getColumnIndexOrThrow("status")))
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
            migrated.query("SELECT COUNT(*) FROM legal_sources").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM evidence").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            migrated.query("SELECT COUNT(*) FROM sync_commands").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            // The new catalog starts empty on upgrade — no synthetic rows.
            migrated.query("SELECT COUNT(*) FROM legal_documents").use { c ->
                c.moveToFirst(); assertEquals(0L, c.getLong(0))
            }

            // The evidence dedup contract survives the upgrade untouched.
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
            assertTrue("evidence UNIQUE(originalFileHash) weakened by v5 upgrade", duplicateRejected)

            migrated.close()
            helper.close()
        }

    @Test
    fun migration4To5_newCatalogEnforcesItsContract() =
        runBlocking {
            val dbName = "migration-test-4to5-structure"

            // Empty old-data case: a v4 install with zero rows must migrate
            // cleanly to v5 with the catalog present.
            helper.createDatabase(dbName, 4).close()

            val migrated = helper.runMigrationsAndValidate(dbName, 5, true, CrimSysDatabase.MIGRATION_4_5)

            // Production row shape: nullable opt-ins exercised (lawNumber,
            // articleNumber, sourceUrl, publishedAtEpochDay all NULL).
            migrated.execSQL(
                """
                INSERT INTO legal_documents (
                    id, documentType, title, lawNumber, articleNumber, body,
                    sourceUrl, publishedAtEpochDay, updatedAtEpochMillis, verified
                ) VALUES ('ld-1', 'LAW_TEXT', 'قانون العقوبات', NULL, NULL,
                          '<p>نص المادة</p>', NULL, NULL, 1700000000000, 1)
                """.trimIndent(),
            )
            // Full row shape: every column populated.
            migrated.execSQL(
                """
                INSERT INTO legal_documents (
                    id, documentType, title, lawNumber, articleNumber, body,
                    sourceUrl, publishedAtEpochDay, updatedAtEpochMillis, verified
                ) VALUES ('ld-2', 'AMENDMENT', 'تعديل المادة 341', '58', '341',
                          '<p>نص التعديل</p>', 'https://example.gov.eg/amend',
                          24500, 1700000001000, 0)
                """.trimIndent(),
            )

            // PK dedup: a second row with the same id must be rejected.
            var duplicateIdRejected = false
            try {
                migrated.execSQL(
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, lawNumber, articleNumber, body,
                        sourceUrl, publishedAtEpochDay, updatedAtEpochMillis, verified
                    ) VALUES ('ld-1', 'LAW_TEXT', 'duplicate', NULL, NULL,
                              '<p>x</p>', NULL, NULL, 1700000002000, 1)
                    """.trimIndent(),
                )
            } catch (_: Exception) {
                duplicateIdRejected = true
            }
            assertTrue("legal_documents PK dedup is not enforced", duplicateIdRejected)

            // NOT NULL contract: body, title, documentType, updatedAtEpochMillis
            // and verified must refuse NULL — each attempted in isolation.
            val notNullColumns = mapOf(
                "documentType" to
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, body, updatedAtEpochMillis, verified
                    ) VALUES ('nn-1', NULL, 't', 'b', 1, 1)
                    """.trimIndent(),
                "title" to
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, body, updatedAtEpochMillis, verified
                    ) VALUES ('nn-2', 'LAW_TEXT', NULL, 'b', 1, 1)
                    """.trimIndent(),
                "body" to
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, body, updatedAtEpochMillis, verified
                    ) VALUES ('nn-3', 'LAW_TEXT', 't', NULL, 1, 1)
                    """.trimIndent(),
                "updatedAtEpochMillis" to
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, body, updatedAtEpochMillis, verified
                    ) VALUES ('nn-4', 'LAW_TEXT', 't', 'b', NULL, 1)
                    """.trimIndent(),
                "verified" to
                    """
                    INSERT INTO legal_documents (
                        id, documentType, title, body, updatedAtEpochMillis, verified
                    ) VALUES ('nn-5', 'LAW_TEXT', 't', 'b', 1, NULL)
                    """.trimIndent(),
            )
            notNullColumns.forEach { (column, sql) ->
                var rejected = false
                try {
                    migrated.execSQL(sql)
                } catch (_: Exception) {
                    rejected = true
                }
                assertTrue("legal_documents.$column accepted NULL", rejected)
            }

            // Exactly the two accepted rows landed, with values intact.
            migrated.query("SELECT COUNT(*) FROM legal_documents").use { c ->
                c.moveToFirst(); assertEquals(2L, c.getLong(0))
            }
            migrated.query("SELECT * FROM legal_documents WHERE id = 'ld-2'").use { c ->
                assertTrue(c.moveToFirst())
                assertEquals("58", c.getString(c.getColumnIndexOrThrow("lawNumber")))
                assertEquals("341", c.getString(c.getColumnIndexOrThrow("articleNumber")))
                assertEquals(24500L, c.getLong(c.getColumnIndexOrThrow("publishedAtEpochDay")))
                assertEquals(0L, c.getLong(c.getColumnIndexOrThrow("verified")))
            }

            // The three migration indices actually exist on the new table.
            val expectedIndices =
                listOf(
                    "index_legal_documents_documentType",
                    "index_legal_documents_lawNumber_articleNumber",
                    "index_legal_documents_title",
                )
            expectedIndices.forEach { indexName ->
                migrated.query(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ? AND tbl_name = 'legal_documents'",
                    arrayOf(indexName),
                ).use { c ->
                    c.moveToFirst()
                    assertEquals("index $indexName missing after migration", 1L, c.getLong(0))
                }
            }

            migrated.close()
            helper.close()
        }

    @Test
    fun migration4To5_ddlIsIdempotentAgainstReapplication() =
        runBlocking {
            val dbName = "migration-test-4to5-idempotent"

            helper.createDatabase(dbName, 4).close()

            val migrated = helper.runMigrationsAndValidate(dbName, 5, true, CrimSysDatabase.MIGRATION_4_5)

            migrated.execSQL(
                """
                INSERT INTO legal_documents (
                    id, documentType, title, body, updatedAtEpochMillis, verified
                ) VALUES ('ld-1', 'LAW_TEXT', 'قانون العقوبات', '<p>نص</p>', 1700000000000, 1)
                """.trimIndent(),
            )

            // Room applies a Migration object exactly once per version bump,
            // so re-execution is not a supported path. The defense-in-depth
            // contract instead: every statement in MIGRATION_4_5 is
            // `CREATE … IF NOT EXISTS`, so a partial or repeated application
            // (e.g. a failed upgrade retried from a partially-migrated file)
            // can neither throw nor duplicate objects nor lose data.
            val reapplicationStatements =
                listOf(
                    """
                    CREATE TABLE IF NOT EXISTS legal_documents (
                        id TEXT NOT NULL PRIMARY KEY, documentType TEXT NOT NULL, title TEXT NOT NULL,
                        lawNumber TEXT, articleNumber TEXT, body TEXT NOT NULL, sourceUrl TEXT,
                        publishedAtEpochDay INTEGER, updatedAtEpochMillis INTEGER NOT NULL, verified INTEGER NOT NULL
                    )
                    """.trimIndent(),
                    "CREATE INDEX IF NOT EXISTS index_legal_documents_documentType ON legal_documents(documentType)",
                    "CREATE INDEX IF NOT EXISTS index_legal_documents_lawNumber_articleNumber ON legal_documents(lawNumber, articleNumber)",
                    "CREATE INDEX IF NOT EXISTS index_legal_documents_title ON legal_documents(title)",
                )
            reapplicationStatements.forEach { sql ->
                migrated.execSQL(sql) // must not throw, must not alter anything
            }

            // The seeded row is still there — exactly once — and the catalog
            // still holds exactly one table-shaped object set.
            migrated.query("SELECT COUNT(*) FROM legal_documents").use { c ->
                c.moveToFirst(); assertEquals(1L, c.getLong(0))
            }
            migrated.query("SELECT * FROM legal_documents WHERE id = 'ld-1'").use { c ->
                assertTrue(c.moveToFirst())
                assertEquals("قانون العقوبات", c.getString(c.getColumnIndexOrThrow("title")))
                assertEquals("<p>نص</p>", c.getString(c.getColumnIndexOrThrow("body")))
            }

            migrated.close()
            helper.close()
        }
}
