package net.crimsys.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import net.crimsys.app.core.DatabasePassphraseProvider
import net.crimsys.app.data.auth.AuthRepository
import net.crimsys.app.data.auth.FirebaseAuthHolder
import net.crimsys.app.data.auth.FirebaseAuthRepository
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.HearingDao
import net.crimsys.app.data.local.LegalDocumentDao
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.remote.FirebaseAuthRemoteDataSource
import net.crimsys.app.data.remote.RemoteDataSource
import net.crimsys.app.data.repository.CaseRepositoryImpl
import net.crimsys.app.data.repository.HearingRepositoryImpl
import net.crimsys.app.domain.repository.CaseRepository
import net.crimsys.app.domain.repository.HearingRepository

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton
    fun provideDatabasePassphraseProvider(@ApplicationContext context: Context) = DatabasePassphraseProvider(context)

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext context: Context, passphraseProvider: DatabasePassphraseProvider): CrimSysDatabase {
        System.loadLibrary("sqlcipher")
        val factory = net.zetetic.database.sqlcipher.SupportOpenHelperFactory(
            passphraseProvider.getOrCreatePassphrase(), null, false,
        )
        return Room.databaseBuilder(context, CrimSysDatabase::class.java, "crimsys.db")
            .openHelperFactory(factory)
            .addMigrations(
                CrimSysDatabase.MIGRATION_1_2,
                CrimSysDatabase.MIGRATION_2_3,
                CrimSysDatabase.MIGRATION_3_4,
                CrimSysDatabase.MIGRATION_4_5,
            )
            .build()
    }

    @Provides fun provideCaseDao(db: CrimSysDatabase): CaseDao = db.caseDao()
    @Provides fun provideHearingDao(db: CrimSysDatabase): HearingDao = db.hearingDao()
    @Provides fun provideOfflineActionDao(db: CrimSysDatabase): OfflineActionDao = db.offlineActionDao()
    @Provides fun provideLegalDocumentDao(db: CrimSysDatabase): LegalDocumentDao = db.legalDocumentDao()

    @Provides @Singleton
    fun providePreferencesDataStore(@ApplicationContext context: Context): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create {
            context.preferencesDataStoreFile("crimsys_settings")
        }

    @Provides @Singleton fun provideFirebaseAuthHolder(): FirebaseAuthHolder = FirebaseAuthHolder()
    @Provides @Singleton fun provideAuthRepository(impl: FirebaseAuthRepository): AuthRepository = impl
    @Provides @Singleton fun provideRemoteDataSource(authRepository: AuthRepository): RemoteDataSource = FirebaseAuthRemoteDataSource(authRepository)
    @Provides @Singleton fun provideCaseRepository(impl: CaseRepositoryImpl): CaseRepository = impl
    @Provides @Singleton fun provideHearingRepository(impl: HearingRepositoryImpl): HearingRepository = impl
}
