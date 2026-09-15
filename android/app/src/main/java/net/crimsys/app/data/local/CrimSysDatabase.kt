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
        SyncCommandEntity::class,
    ],
    version = 7,
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
         * HarisCore slice (v3 → v4): legal_sources, evidence_items,
         * evidence_chain_events, sync_commands.
         *
         * [MIGRATION_4_5] below REPLACES the two evidence tables with the
         * redesigned single-table `evidence` store — v4 evidence rows are
         * unrecoverable from their new shape (the v4 store recorded bare
         * digests with no file bytes or storage path, so a faithful custody
         * reconstruction is impossible). See the migration's KDoc for the
         * deliberate data decision and the reason this stays fail-loud.
         */
        val MIGRATION_3_4: Migration =
            object : Migration(3, 4) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    // Legal-source registry (citation verification): a
                    // TEMPORALLY VERSIONED store — one article may carry many
                    // verified rows (amendments/replacements), each with its
                    // own validity window (epoch days) and source digest.
                    // Two non-unique indices back the exact-match lookups.
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `legal_sources` (" +
                            "`id` TEXT NOT NULL PRIMARY KEY, " +
                            "`lawNumber` TEXT NOT NULL, " +
                            "`lawName` TEXT NOT NULL, " +
                            "`article` TEXT NOT NULL, " +
                            "`paragraph` TEXT, " +
                            "`effectiveFromEpochDay` INTEGER NOT NULL, " +
                            "`effectiveToEpochDay` INTEGER, " +
                            "`sourceSha256` TEXT NOT NULL, " +
                            "`officialSourceUrl` TEXT NOT NULL, " +
                            "`gazetteIssue` TEXT, " +
                            "`verified` INTEGER NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS " +
                            "`index_legal_sources_lawName_article_paragraph` " +
                            "ON `legal_sources` (`lawName`, `article`, `paragraph`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS " +
                            "`index_legal_sources_lawNumber_article_paragraph` " +
                            "ON `legal_sources` (`lawNumber`, `article`, `paragraph`)",
                    )

                    // Evidence items + hash-linked chain of custody.
                    // (Superseded by the v4 → v5 redesign below; kept here so
                    // a v3 install can reach v4 and then upgrade onward.)
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
                            "`action` TEXT NOT NULL, " +
                            "`occurredAtEpochMs` INTEGER NOT NULL, " +
                            "`contentHash` TEXT NOT NULL, " +
                            "`eventHash` TEXT NOT NULL, " +
                            "`previousEventHash` TEXT NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_evidence_chain_events_evidenceId` " +
                            "ON `evidence_chain_events` (`evidenceId`)",
                    )

                    // Haris sync-command queue (same lifecycle as offline_actions).
                    // (v4 DDL kept as the historical upgrade path — the v4 → v6
                    // reshape below rebuilds this table with the CQRS column set.)
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

        /**
         * Evidence redesign (v4 → v5): the two-table evidence store
         * (`evidence_items` + `evidence_chain_events`) is replaced by the
         * single `evidence` table — chain of custody embedded as a JSON
         * column, storage path, case linkage, and a UNIQUE original-file
         * hash for dedup.
         *
         * Deliberate data decision: v4 evidence rows cannot be faithfully
         * reconstructed into the new shape. The v4 store persisted only bare
         * SHA-256 digests — no file bytes, no storage path, no case linkage,
         * no mime type — so the new NOT NULL columns would have to be filled
         * with invented values, and an evidence record with fabricated
         * provenance is worse than a loud failure. A v3→v4→v5 upgrade path
         * therefore preserves cases/hearings/queues and FAILS on open with a
         * clear IllegalStateException instead of silently substituting fake
         * custody data. Field devices in that state need the SQLCipher file
         * preserved for forensic extraction before upgrading.
         */
        val MIGRATION_4_5: Migration =
            object : Migration(4, 5) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL("DROP TABLE IF EXISTS `evidence_chain_events`")
                    db.execSQL("DROP TABLE IF EXISTS `evidence_items`")
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `evidence` (" +
                            "`id` TEXT NOT NULL PRIMARY KEY, " +
                            "`caseId` TEXT NOT NULL, " +
                            "`originalFileHash` TEXT NOT NULL, " +
                            "`processedFileHash` TEXT, " +
                            "`mimeType` TEXT NOT NULL, " +
                            "`captureTimestamp` INTEGER NOT NULL, " +
                            "`chainOfCustodyJson` TEXT NOT NULL, " +
                            "`immutableRelativePath` TEXT NOT NULL)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_evidence_caseId` " +
                            "ON `evidence` (`caseId`)",
                    )
                    db.execSQL(
                        "CREATE UNIQUE INDEX IF NOT EXISTS `index_evidence_originalFileHash` " +
                            "ON `evidence` (`originalFileHash`)",
                    )
                }
            }

        /**
         * Sync-command queue reshape (v5 → v6), zero data loss: the queued
         * [net.crimsys.app.domain.sync.SyncCommand] model moved from a
         * free-form `type` string + JSON envelope to a closed [CommandType]
         * enum with CQRS identity (commandId/aggregateId, schemaVersion,
         * attemptCount). The table is rebuilt in place:
         *
         *  - columns are renamed, not dropped: `uuid` → `commandId`,
         *    `retryCount` → `attemptCount` — every queued mutation survives.
         *  - `schemaVersion` defaults to 1 (the version this transport speaks)
         *    and `aggregateId` to the legacy sentinel `''`.
         *  - the UNIQUE index moves from `uuid` to `commandId` — same
         *    identity guarantee, new column name.
         *  - legacy rows keep `PENDING`/`DEAD` status untouched: `PENDING`
         *    rows drain exactly as before, `DEAD` rows stay inspectable.
         *
         * Legacy payload columns carry no digest anymore; integrity at the
         * transport is now enforced by the schema gate + create-vs-conflict
         * transaction (see FirebaseSyncCommandExecutor), not by a stored
         * digest.
         */
        val MIGRATION_5_6: Migration =
            object : Migration(5, 6) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `sync_commands_new` (" +
                            "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                            "`commandId` TEXT NOT NULL, " +
                            "`schemaVersion` INTEGER NOT NULL, " +
                            "`aggregateId` TEXT NOT NULL, " +
                            "`type` TEXT NOT NULL, " +
                            "`payloadJson` TEXT NOT NULL, " +
                            "`createdAtEpochMs` INTEGER NOT NULL, " +
                            "`attemptCount` INTEGER NOT NULL, " +
                            "`maxRetries` INTEGER NOT NULL, " +
                            "`status` TEXT NOT NULL)",
                    )
                    // Preserve every row: rename the identity column, default
                    // the new schema fields, keep the attempt counter.
                    db.execSQL(
                        "INSERT INTO `sync_commands_new` " +
                            "(`id`, `commandId`, `schemaVersion`, `aggregateId`, `type`, `payloadJson`, `createdAtEpochMs`, `attemptCount`, `maxRetries`, `status`) " +
                            "SELECT `id`, `uuid`, 1, '', `type`, `payloadJson`, `createdAtEpochMs`, `retryCount`, `maxRetries`, `status` " +
                            "FROM `sync_commands`",
                    )
                    db.execSQL("DROP TABLE `sync_commands`")
                    db.execSQL("ALTER TABLE `sync_commands_new` RENAME TO `sync_commands`")
                    db.execSQL(
                        "CREATE UNIQUE INDEX IF NOT EXISTS `index_sync_commands_commandId` " +
                            "ON `sync_commands` (`commandId`)",
                    )
                }
            }

        /**
         * Sync-command queue reshape (v6 → v7), zero data loss: the queue row
         * becomes command-keyed and self-scheduling.
         *
         *  - `commandId` moves from a UNIQUE column to the PRIMARY KEY — the
         *    autoincrement ordinal was device-local bookkeeping; the command
         *    UUID is the real identity.
         *  - `createdAtEpochMs` → `createdAtEpochMillis` (renamed, value kept)
         *    — the FIFO order authority is now a (status, createdAt) index.
         *  - `nextAttemptAtEpochMillis` added, NULL default — per-row durable
         *    retry deferral; NULL means "due now".
         *  - `lastError` added, NULL default — short inspection breadcrumb.
         *  - `maxRetries` dropped — the attempt budget is now a code constant
         *    in [net.crimsys.app.data.sync.SyncWorker].
         *  - `attemptCount` and `status` preserved for every row; `PENDING`
         *    rows drain exactly as before, `DEAD` rows stay inspectable.
         *
         * Room cannot ALTER a primary key or rename a column in one step on
         * older SQLite, so the table is rebuilt in place and every row is
         * copied across — no queued mutation is lost.
         */
        val MIGRATION_6_7: Migration =
            object : Migration(6, 7) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        "CREATE TABLE IF NOT EXISTS `sync_commands_new` (" +
                            "`commandId` TEXT NOT NULL PRIMARY KEY, " +
                            "`schemaVersion` INTEGER NOT NULL, " +
                            "`aggregateId` TEXT NOT NULL, " +
                            "`type` TEXT NOT NULL, " +
                            "`payloadJson` TEXT NOT NULL, " +
                            "`createdAtEpochMillis` INTEGER NOT NULL, " +
                            "`attemptCount` INTEGER NOT NULL, " +
                            "`nextAttemptAtEpochMillis` INTEGER, " +
                            "`status` TEXT NOT NULL, " +
                            "`lastError` TEXT)",
                    )
                    // Preserve every row: keep identity, schema stamp, payload,
                    // creation time, attempt counter, and lifecycle status.
                    // Deferred rows (none exist in v6) would map to NULL = due.
                    db.execSQL(
                        "INSERT INTO `sync_commands_new` " +
                            "(`commandId`, `schemaVersion`, `aggregateId`, `type`, `payloadJson`, `createdAtEpochMillis`, `attemptCount`, `nextAttemptAtEpochMillis`, `status`, `lastError`) " +
                            "SELECT `commandId`, `schemaVersion`, `aggregateId`, `type`, `payloadJson`, `createdAtEpochMs`, `attemptCount`, NULL, `status`, NULL " +
                            "FROM `sync_commands`",
                    )
                    db.execSQL("DROP TABLE `sync_commands`")
                    db.execSQL("ALTER TABLE `sync_commands_new` RENAME TO `sync_commands`")
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_sync_commands_status_createdAtEpochMillis` " +
                            "ON `sync_commands` (`status`, `createdAtEpochMillis`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_sync_commands_aggregateId` " +
                            "ON `sync_commands` (`aggregateId`)",
                    )
                }
            }
    }
}
