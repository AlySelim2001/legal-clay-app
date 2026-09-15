package net.crimsys.app.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import net.crimsys.app.data.evidence.EvidenceRepositoryImpl
import net.crimsys.app.data.legal.LegalRegistryRepositoryImpl
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.remote.FirebaseSyncCommandExecutor
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.legal.LegalRegistryRepository
import net.crimsys.app.domain.sync.SyncCommandExecutor

@Module
@InstallIn(SingletonComponent::class)
object HarisCoreModule {

    @Provides
    fun provideLegalSourceDao(
        db: CrimSysDatabase,
    ): LegalSourceDao =
        db.legalSourceDao()

    @Provides
    fun provideEvidenceDao(
        db: CrimSysDatabase,
    ): EvidenceDao =
        db.evidenceDao()

    @Provides
    fun provideSyncCommandDao(
        db: CrimSysDatabase,
    ): SyncCommandDao =
        db.syncCommandDao()

    @Provides
    @Singleton
    fun provideLegalRegistryRepository(
        impl: LegalRegistryRepositoryImpl,
    ): LegalRegistryRepository =
        impl

    @Provides
    @Singleton
    fun provideEvidenceRepository(
        impl: EvidenceRepositoryImpl,
    ): EvidenceRepository =
        impl

    @Provides
    @Singleton
    fun provideSyncCommandExecutor(
        impl: FirebaseSyncCommandExecutor,
    ): SyncCommandExecutor =
        impl
}
