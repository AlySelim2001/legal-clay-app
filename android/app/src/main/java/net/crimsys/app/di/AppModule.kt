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
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.HearingDao
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

    @Provides
    @Singleton
    fun provideDatabasePassphraseProvider(
        @ApplicationContext context: Context,
    ): DatabasePassphraseProvider = DatabasePassphraseProvider(context)

    /**
     * SQLCipher-encrypted Room database. The passphrase is a random 256-bit key
     * generated on first launch and stored in the Android Keystore — the
     * database file itself is useless if pulled off the device.
     *
     * Failure handling: if the native `sqlcipher` .so is missing for the current
     * ABI, [System.loadLibrary] throws [UnsatisfiedLinkError] at first DB
     * injection — a loud, early failure beats a silently corrupted store.
     */
    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context,
        passphraseProvider: DatabasePassphraseProvider,
    ): CrimSysDatabase {
        // sqlcipher-android (the maintained successor of android-database-sqlcipher)
        // requires its native library to be loaded before any database handle exists.
        System.loadLibrary("sqlcipher")

        val factory =
            net.zetetic.database.sqlcipher.SupportOpenHelperFactory(
                passphraseProvider.getOrCreatePassphrase(),
                /* hook = */ null,
                /* enableWriteAheadLogging = */ false,
            )
        return Room.databaseBuilder(context, CrimSysDatabase::class.java, "crimsys.db")
            .openHelperFactory(factory)
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()
    }

    @Provides
    fun provideCaseDao(db: CrimSysDatabase): CaseDao = db.caseDao()

    @Provides
    fun provideHearingDao(db: CrimSysDatabase): HearingDao = db.hearingDao()

    @Provides
    fun provideOfflineActionDao(db: CrimSysDatabase): OfflineActionDao = db.offlineActionDao()

    @Provides
    @Singleton
    fun providePreferencesDataStore(
        @ApplicationContext context: Context,
    ): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create(
            produceFile = { context.preferencesDataStoreFile("crimsys_settings") },
        )

    /**
     * Remote data source behind an interface so unit tests can swap in a fake
     * (the Firebase SDK itself is never needed on the JVM).
     */
    @Provides
    @Singleton
    fun provideRemoteDataSource(
        @ApplicationContext context: Context,
    ): RemoteDataSource = FirebaseAuthRemoteDataSource(context)

    @Provides
    @Singleton
    fun provideCaseRepository(impl: CaseRepositoryImpl): CaseRepository = impl

    @Provides
    @Singleton
    fun provideHearingRepository(impl: HearingRepositoryImpl): HearingRepository = impl
}
