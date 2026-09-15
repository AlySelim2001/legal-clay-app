package net.crimsys.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Encrypted local database (SQLCipher via SupportOpenHelperFactory — see
 * AppModule). Schema JSONs are exported to app/schemas for migration tests.
 *
 * NEVER enable `fallbackToDestructiveMigration` on this database: it holds
 * the practice's only local copy of case files, and the DB is deliberately
 * excluded from Android cloud backup. A failed migration must fail loudly,
 * not wipe evidence. Schema evolution goes exclusively through explicit
 * `CrimSysDatabase.MIGRATION_x_y` objects.
 */
@Database(
    entities = [
        CaseEntity::class,
        HearingEntity::class,
        OfflineActionEntity::class,
        LegalSourceEntity::class,
        EvidenceEntity::class,
        SyncCommandEntity::class,
    ],
    version = 4,
    exportSchema = true,
)
abstract class CrimSysDatabase : RoomDatabase() {

    abstract fun caseDao(): CaseDao

    abstract fun hearingDao(): HearingDao

    abstract fun offlineActionDao(): OfflineActionDao

    abstract fun legalSourceDao(): LegalSourceDao

    abstract fun evidenceDao(): EvidenceDao

    abstract fun syncCommandDao(): SyncCommandDao

    companion object {

        /**
         * R2 remediation (v1 → v2), zero data loss:
         *  - `ALTER TABLE ... ADD COLUMN actionUuid TEXT NOT NULL DEFAULT ''`.
         *    NOT NULL must match the Kotlin field type exactly — a nullable
         *    column paired with the non-null entity field fails Room's schema
         *    validation and crashes on first open after the upgrade. `''` is
         *    the "legacy row" sentinel.
         *  - Existing rows (queued offline mutations) are preserved untouched:
         *    no table rebuild, no data loss. A DISTINCT uuid is assigned to
         *    each legacy row before the next drain (see SyncManager's repair
         *    loop + [OfflineActionDao.assignUuid]) so two legacy rows can
         *    never share one Firestore document id.
         */
        val MIGRATION_1_2: Migration =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        "ALTER TABLE offline_actions ADD COLUMN actionUuid TEXT NOT NULL DEFAULT ''",
                    )
                }
            }

        /**
         * P1 remediation (v2 → v3), zero data loss: Dead Letter Queue.
         *  - `maxRetries INTEGER NOT NULL DEFAULT 3` — push-attempt budget
         *    before an action stops blocking the FIFO.
         *  - `status TEXT NOT NULL DEFAULT 'PENDING'` — lifecycle column.
         *    Every pre-existing row maps to PENDING, i.e. keeps behaving
         *    exactly as before: queued, drained in id order. No rows are
         *    deleted or rewritten; the migration is two pure ADD COLUMNs.
         *  - A partial index on PENDING status keeps the drain's hot query
         *    (`WHERE status = 'PENDING' ORDER BY id`) on an index scan.
         */
        val MIGRATION_2_3: Migration =
            object : Migration(2, 3) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        "ALTER TABLE offline_actions ADD COLUMN maxRetries INTEGER NOT NULL DEFAULT 3",
                    )
                    db.execSQL(
                        "ALTER TABLE offline_actions ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS index_offline_actions_status_id " +
                            "ON offline_actions (status, id)",
                    )
                }
            }

        /**
         * HarisCore slice (v3 → v4), zero data loss: creates the three Haris
         * tables — the authoritative legal-source registry, the single-table
         * evidence store with embedded chain of custody, and the command-keyed
         * sync queue — in their current production shapes.
         *
         * Every statement is CREATE ... IF NOT EXISTS; the existing v3 tables
         * (`cases`, `hearings`, `offline_actions`) are untouched, so a v3
         * install upgrades in place with no destructive step (project rule:
         * no destructive migration, ever).
         */
        val MIGRATION_3_4 =
            object : Migration(3, 4) {

                override fun migrate(
                    db: SupportSQLiteDatabase,
                ) {

                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS legal_sources (
                            id TEXT NOT NULL PRIMARY KEY,
                            lawNumber TEXT NOT NULL,
                            lawName TEXT NOT NULL,
                            article TEXT NOT NULL,
                            paragraph TEXT,
                            effectiveFromEpochDay INTEGER NOT NULL,
                            effectiveToEpochDay INTEGER,
                            sourceSha256 TEXT NOT NULL,
                            officialSourceUrl TEXT NOT NULL,
                            gazetteIssue TEXT,
                            verified INTEGER NOT NULL
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE INDEX IF NOT EXISTS
                        index_legal_sources_lawName_article_paragraph
                        ON legal_sources(
                            lawName,
                            article,
                            paragraph
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE INDEX IF NOT EXISTS
                        index_legal_sources_lawNumber_article_paragraph
                        ON legal_sources(
                            lawNumber,
                            article,
                            paragraph
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS evidence (
                            id TEXT NOT NULL PRIMARY KEY,
                            caseId TEXT NOT NULL,
                            originalFileHash TEXT NOT NULL,
                            processedFileHash TEXT,
                            mimeType TEXT NOT NULL,
                            captureTimestamp INTEGER NOT NULL,
                            chainOfCustodyJson TEXT NOT NULL,
                            immutableRelativePath TEXT NOT NULL
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS
                        index_evidence_originalFileHash
                        ON evidence(originalFileHash)
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE INDEX IF NOT EXISTS
                        index_evidence_caseId
                        ON evidence(caseId)
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS sync_commands (
                            commandId TEXT NOT NULL PRIMARY KEY,
                            schemaVersion INTEGER NOT NULL,
                            aggregateId TEXT NOT NULL,
                            type TEXT NOT NULL,
                            payloadJson TEXT NOT NULL,
                            createdAtEpochMillis INTEGER NOT NULL,
                            attemptCount INTEGER NOT NULL,
                            nextAttemptAtEpochMillis INTEGER,
                            status TEXT NOT NULL,
                            lastError TEXT
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE INDEX IF NOT EXISTS
                        index_sync_commands_status_createdAtEpochMillis
                        ON sync_commands(
                            status,
                            createdAtEpochMillis
                        )
                        """.trimIndent(),
                    )

                    db.execSQL(
                        """
                        CREATE INDEX IF NOT EXISTS
                        index_sync_commands_aggregateId
                        ON sync_commands(aggregateId)
                        """.trimIndent(),
                    )
                }
            }
    }
}
