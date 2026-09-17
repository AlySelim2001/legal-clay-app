package net.crimsys.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** Encrypted Room store. Legal documents are kept in the same SQLite file that AnyQuery inspects. */
@Database(
    entities = [
        CaseEntity::class,
        HearingEntity::class,
        OfflineActionEntity::class,
        LegalSourceEntity::class,
        LegalDocumentEntity::class,
        EvidenceEntity::class,
        SyncCommandEntity::class,
    ],
    version = 5,
    exportSchema = true,
)
abstract class CrimSysDatabase : RoomDatabase() {
    abstract fun caseDao(): CaseDao
    abstract fun hearingDao(): HearingDao
    abstract fun offlineActionDao(): OfflineActionDao
    abstract fun legalSourceDao(): LegalSourceDao
    abstract fun legalDocumentDao(): LegalDocumentDao
    abstract fun evidenceDao(): EvidenceDao
    abstract fun syncCommandDao(): SyncCommandDao

    companion object {
        val MIGRATION_1_2: Migration = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE offline_actions ADD COLUMN actionUuid TEXT NOT NULL DEFAULT ''")
            }
        }

        val MIGRATION_2_3: Migration = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE offline_actions ADD COLUMN maxRetries INTEGER NOT NULL DEFAULT 3")
                db.execSQL("ALTER TABLE offline_actions ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_offline_actions_status_id ON offline_actions (status, id)")
            }
        }

        val MIGRATION_3_4: Migration = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS legal_sources (
                        id TEXT NOT NULL PRIMARY KEY, lawNumber TEXT NOT NULL, lawName TEXT NOT NULL,
                        article TEXT NOT NULL, paragraph TEXT, effectiveFromEpochDay INTEGER NOT NULL,
                        effectiveToEpochDay INTEGER, sourceSha256 TEXT NOT NULL, officialSourceUrl TEXT NOT NULL,
                        gazetteIssue TEXT, verified INTEGER NOT NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_sources_lawName_article_paragraph ON legal_sources(lawName, article, paragraph)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_sources_lawNumber_article_paragraph ON legal_sources(lawNumber, article, paragraph)")
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS evidence (
                        id TEXT NOT NULL PRIMARY KEY, caseId TEXT NOT NULL, originalFileHash TEXT NOT NULL,
                        processedFileHash TEXT, mimeType TEXT NOT NULL, captureTimestamp INTEGER NOT NULL,
                        chainOfCustodyJson TEXT NOT NULL, immutableRelativePath TEXT NOT NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_evidence_originalFileHash ON evidence(originalFileHash)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_evidence_caseId ON evidence(caseId)")
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS sync_commands (
                        commandId TEXT NOT NULL PRIMARY KEY, schemaVersion INTEGER NOT NULL, aggregateId TEXT NOT NULL,
                        type TEXT NOT NULL, payloadJson TEXT NOT NULL, createdAtEpochMillis INTEGER NOT NULL,
                        attemptCount INTEGER NOT NULL, nextAttemptAtEpochMillis INTEGER, status TEXT NOT NULL, lastError TEXT
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS index_sync_commands_status_createdAtEpochMillis ON sync_commands(status, createdAtEpochMillis)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_sync_commands_aggregateId ON sync_commands(aggregateId)")
            }
        }

        /** Adds only the new catalog; all pre-existing case and evidence rows remain untouched. */
        val MIGRATION_4_5: Migration = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS legal_documents (
                        id TEXT NOT NULL PRIMARY KEY, documentType TEXT NOT NULL, title TEXT NOT NULL,
                        lawNumber TEXT, articleNumber TEXT, body TEXT NOT NULL, sourceUrl TEXT,
                        publishedAtEpochDay INTEGER, updatedAtEpochMillis INTEGER NOT NULL, verified INTEGER NOT NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_documentType ON legal_documents(documentType)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_lawNumber_articleNumber ON legal_documents(lawNumber, articleNumber)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_title ON legal_documents(title)")
            }
        }
    }
}
