package net.crimsys.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Encrypted local database (SQLCipher via SupportFactory — see AppModule).
 * Schema JSONs are exported to app/schemas for migration tests.
 */
@Database(
    entities = [CaseEntity::class, HearingEntity::class, OfflineActionEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class CrimSysDatabase : RoomDatabase() {
    abstract fun caseDao(): CaseDao
    abstract fun hearingDao(): HearingDao
    abstract fun offlineActionDao(): OfflineActionDao
}
