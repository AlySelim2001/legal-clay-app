package net.crimsys.app.di

import android.content.Context
import androidx.work.WorkManager
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import net.crimsys.app.data.evidence.EvidenceRepositoryImpl
import net.crimsys.app.data.legal.LegalRegistryRepositoryImpl
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.remote.FirebaseSyncCommandExecutor
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.legal.CitationValidator
import net.crimsys.app.domain.legal.LegalRegistryRepository
import net.crimsys.app.domain.legal.RegistryBackedCitationValidator
import net.crimsys.app.domain.sync.SyncCommandExecutor

/**
 * Wiring for the HarisCore slice: evidence chain of custody, the authoritative
 * legal-source registry, citation validation, and the command-based sync queue.
 *
 * Bound interfaces (§22 adapter rule — transports and stores stay swappable):
 *  - [EvidenceRepository] → Room-first implementation with hash-linked appends
 *  - [LegalRegistryRepository] → Room registry (persist-only, no scraping)
 *  - [CitationValidator] → registry-backed validator (pure domain logic)
 *  - [SyncCommandExecutor] → Firestore transport; swap for the Zero-Trust
 *    legal backend without touching domain, storage, or UI
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class HarisCoreBindings {

    @Binds
    @Singleton
    abstract fun bindEvidenceRepository(impl: EvidenceRepositoryImpl): EvidenceRepository

    @Binds
    @Singleton
    abstract fun bindLegalRegistryRepository(impl: LegalRegistryRepositoryImpl): LegalRegistryRepository

    @Binds
    @Singleton
    abstract fun bindCitationValidator(impl: RegistryBackedCitationValidator): CitationValidator

    @Binds
    @Singleton
    abstract fun bindSyncCommandExecutor(impl: FirebaseSyncCommandExecutor): SyncCommandExecutor
}

@Module
@InstallIn(SingletonComponent::class)
object HarisCoreModule {

    // ------------------------------------------------------------ Room DAOs
    // (Database + migrations live in AppModule; DAO accessors are added to
    // CrimSysDatabase alongside the existing ones.)

    @Provides
    fun provideLegalSourceDao(db: net.crimsys.app.data.local.CrimSysDatabase): LegalSourceDao = db.legalSourceDao()

    @Provides
    fun provideEvidenceDao(db: net.crimsys.app.data.local.CrimSysDatabase): EvidenceDao = db.evidenceDao()

    @Provides
    fun provideSyncCommandDao(db: net.crimsys.app.data.local.CrimSysDatabase): SyncCommandDao = db.syncCommandDao()

    // ----------------------------------------------------------- WorkManager
    // Used by SyncWorker scheduling (expedited drain after queue writes).
    // Requires CrimSysApplication to implement Configuration.Provider with the
    // HiltWorkerFactory — otherwise @HiltWorker injection cannot resolve.

    @Provides
    @Singleton
    fun provideWorkManager(
        @ApplicationContext context: Context,
    ): WorkManager = WorkManager.getInstance(context)
}
