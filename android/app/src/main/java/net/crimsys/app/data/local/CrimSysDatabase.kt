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
    entities = [CaseEntity::class, HearingEntity::class, OfflineActionEntity::class],
    version = 3,
    exportSchema = true,
)
abstract class CrimSysDatabase : RoomDatabase() {
    abstract fun caseDao(): CaseDao
    abstract fun hearingDao(): HearingDao
    abstract fun offlineActionDao(): OfflineActionDao

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
    }
}
