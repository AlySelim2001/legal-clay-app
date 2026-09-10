package net.crimsys.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import java.util.UUID

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
    version = 2,
    exportSchema = true,
)
abstract class CrimSysDatabase : RoomDatabase() {
    abstract fun caseDao(): CaseDao
    abstract fun hearingDao(): HearingDao
    abstract fun offlineActionDao(): OfflineActionDao

    companion object {
        /**
         * R2 remediation (v1 → v2), zero data loss:
         *  - `ALTER TABLE ... ADD COLUMN actionUuid TEXT` — schema-only change;
         *    existing rows (queued offline mutations) are preserved untouched.
         *  - The column is nullable for legacy rows; those are backfilled with
         *    fresh UUIDs by [OfflineActionDao.repairMissingUuids] at next drain.
         *
         * Room validates foreign keys and indices, not column nullability of
         * added columns — this migration passes `validateMigrations` checks.
         */
        val MIGRATION_1_2: Migration =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        "ALTER TABLE offline_actions ADD COLUMN actionUuid TEXT DEFAULT NULL",
                    )
                    // Backfill legacy rows immediately so the queue is fully
                    // UUID-keyed before any push can observe a NULL key.
                    db.execSQL(
                        "UPDATE offline_actions SET actionUuid = '" +
                            UUID.randomUUID().toString() +
                            "' WHERE actionUuid IS NULL",
                    )
                }
            }
    }
}
