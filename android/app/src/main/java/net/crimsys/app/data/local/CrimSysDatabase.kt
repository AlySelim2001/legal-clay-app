package net.crimsys.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Encrypted local database (SQLCipher via SupportFactory — see AppModule).
 * Schema JSONs are exported to app/schemas for migration tests.
 *
 * NEVER enable `fallbackToDestructiveMigration` on this database: it holds
 * the practice's only local copy of case files, and the DB is deliberately
 * excluded from Android cloud backup. A failed migration must fail loudly,
 * not wipe evidence.
 */
@Database(
    entities = [
        CaseEntity::class,
        HearingEntity::class,
        OfflineActionEntity::class,
        LegalSourceEntity::class,
        EvidenceEntity::class,
        EvidenceChainEventEntity::class,
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
         *    loop + [OfflineActionDao.legacyKeyed]/[OfflineActionDao.assignUuid])
         *    so two legacy rows can never share one Firestore document id.
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
         * HarisCore slice (v3 → v4), additive only — zero data loss:
         * four brand-new tables + their indices. No existing table is
         * touched; the migration is pure CREATE TABLE / CREATE INDEX, so a
         * v3 install upgrades in place with its cases, hearings, and queue
         * intact.
         *
         * Column shapes follow the entities exactly: NOT NULL for every
         * non-nullable Kotlin field (a mismatch fails Room's schema
         * validation on open — by design, see the no-destructive-migration
         * rule), nullable Kotlin types as nullable columns, Boolean as
         * INTEGER, ByteArray as BLOB.
         */
        val MIGRATION_3_4: Migration =
            object : Migration(3, 4) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    // Legal-source registry (citation verification): one row
                    // per (law, article[, paragraph]) artifact with its
                    // temporal window, source-artifact digest, and provenance.
                    // The unique natural key guarantees citation verification
                    // can never be ambiguous by construction.
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `legal_sources` (" +
                            "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                            "`lawNumber` TEXT NOT NULL, " +
                            "`lawName` TEXT NOT NULL, " +
                            "`article` TEXT NOT NULL, " +
                            "`paragraph` TEXT, " +
                            "`effectiveFromIso` TEXT NOT NULL, " +
                            "`effectiveToIso` TEXT, " +
                            "`sourceSha256` TEXT NOT NULL, " +
                            "`officialSourceUrl` TEXT NOT NULL, " +
                            "`gazetteIssue` TEXT, " +
                            "`verified` INTEGER NOT NULL, " +
                            "`createdAt` INTEGER NOT NULL, " +
                            "`updatedAt` INTEGER NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE UNIQUE INDEX IF NOT EXISTS " +
                            "`index_legal_sources_lawName_article_paragraph` " +
                            "ON `legal_sources` (`lawName`, `article`, `paragraph`)",
                    )

                    // Evidence items + hash-linked chain of custody.
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `evidence_items` (" +
                            "`id` TEXT NOT NULL PRIMARY KEY, " +
                            "`label` TEXT NOT NULL, " +
                            "`sha256Hex` TEXT NOT NULL, " +
                            "`chainHeadHash` TEXT NOT NULL, " +
                            "`eventCount` INTEGER NOT NULL, " +
                            "`contentUri` TEXT, " +
                            "`isSynced` INTEGER NOT NULL, " +
                            "`capturedAtEpochMs` INTEGER NOT NULL, " +
                            "`createdAt` INTEGER NOT NULL, " +
                            "`updatedAt` INTEGER NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_evidence_items_sha256Hex` " +
                            "ON `evidence_items` (`sha256Hex`)",
                    )
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `evidence_chain_events` (" +
                            "`id` TEXT NOT NULL PRIMARY KEY, " +
                            "`evidenceId` TEXT NOT NULL, " +
                            "`offline` INTEGER NOT NULL, " +
                            "`kind` TEXT NOT NULL, " +
                            "`payload` BLOB, " +
                            "`occurredAtEpochMs` INTEGER NOT NULL, " +
                            "`eventHash` TEXT NOT NULL, " +
                            "`previousEventHash` TEXT NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_evidence_chain_events_evidenceId` " +
                            "ON `evidence_chain_events` (`evidenceId`)",
                    )

                    // Haris sync-command queue (same lifecycle as offline_actions).
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `sync_commands` (" +
                            "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                            "`uuid` TEXT NOT NULL, " +
                            "`type` TEXT NOT NULL, " +
                            "`payloadJson` TEXT NOT NULL, " +
                            "`retryCount` INTEGER NOT NULL, " +
                            "`maxRetries` INTEGER NOT NULL, " +
                            "`status` TEXT NOT NULL, " +
                            "`createdAtEpochMs` INTEGER NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE UNIQUE INDEX IF NOT EXISTS `index_sync_commands_uuid` " +
                            "ON `sync_commands` (`uuid`)",
                    )
                }
            }
    }
}
