# CRIM-SYS 2026 — Native Android Module (Kotlin + Compose)

Native Android client for the Egyptian criminal litigation platform, built
offline-first per the project spec: Room (SQLCipher-encrypted) as the single
source of truth, an Offline Action Queue drained to Firestore when
connectivity returns, Arabic-first RTL UI throughout.

> **Note:** This native module replaces the earlier Capacitor wrapper that
> previously lived in `android/`. The web app in `src/` remains the reference
> implementation; `bun run cap:*` scripts are no longer applicable.

---

## Architecture (Data Flow)

```
UI (Compose, StateFlow) 
  → ViewModel (viewModelScope, StateFlow/SharedFlow)
    → UseCase (validation, Result<T>)
      → Repository (Room write → queue enqueue → opportunistic push)
        ├─ Room/SQLCipher  ← single source of truth, reactive Flow reads
        └─ OfflineActionQueue (Room) → SyncManager → Firestore (FIFO drain)
```

- **Reads** never touch the network: `CaseDao.observeCases()` is observed
  directly by ViewModels via `stateIn`.
- **Writes** land in Room immediately with `isSynced = false`, enqueue an
  `OfflineActionEntity`, then attempt an immediate push if online.
- **Sync**: `SyncManager` (booted in `CrimSysApplication`) collects
  `NetworkMonitor.observe()` and drains the queue FIFO on reconnect; a failed
  push increments `retryCount` and stops the drain to preserve ordering.
- **Encryption**: the SQLCipher passphrase is a random 256-bit key wrapped by
  an Android Keystore AES-GCM key (`DatabasePassphraseProvider`); the DB file
  and key blob are excluded from backups.

## Module Map

| Path | Role |
|---|---|
| `app/src/main/java/net/crimsys/app/core/` | `Result<T>` pattern, Keystore-backed DB passphrase |
| `data/local/` | Room entities, DAOs, encrypted `CrimSysDatabase` |
| `data/remote/` | Firestore push behind `RemoteDataSource` (degrades gracefully without `google-services.json`) |
| `data/sync/` | `NetworkMonitor` (callbackFlow) + `SyncManager` (queue drain) |
| `data/repository/` | Offline-first `CaseRepositoryImpl`, `HearingRepositoryImpl` |
| `domain/` | Repository interfaces, `CaseDraft`, use cases (validation gates) |
| `di/AppModule.kt` | Hilt providers (DB, DAOs, DataStore, remote, repos) |
| **HarisCore slice (v4–v5)** | Evidence chain of custody, legal registry, command sync |
| `core/Resource.kt` | `Resource<T>` UI-state wrapper (`Loading/Success/Error`) on top of `Result<T>` |
| `core/ClockModule.kt` | Injected `java.time.Clock` (systemUTC) — every timestamp/event-date derives from one test-fixable clock |
| `core/evidence/` | `Sha256` streaming `digest(InputStream)` + `ChainEventHasher.create` (canonical `action\|timestamp\|prev\|contentHash` pipe string → complete `ChainEvent`) |
| `data/evidence/EvidenceRepositoryImpl.kt` | Two-stage custody pipeline on `Resource<T>`: `captureAndSecureEvidence` (single-pass hash+copy → fsync → read-only → rename → genesis event) and `recordOcrProcessing` (processed artifact secured the same way → `processedFileHash` + `OCR_PROCESSED` event in one atomic UPDATE); per-failure file cleanup |
| `data/legal/LegalRegistryRepositoryImpl.kt` | Exact-match lookup (`findExact` + temporal `isEffective`) over the registered set — only verified artifacts are ever stored |
| `data/local/{EvidenceEntity,EvidenceDao}.kt` | Single `evidence` table — chain of custody embedded as JSON, UNIQUE original-file hash dedup, case linkage (v5 migration replaces the v4 evidence tables) |
| `data/local/{LegalSourceEntity,LegalSourceDao}.kt` | `legal_sources` — temporally versioned citable sources (amendments coexist; windows resolved on the event date) |
| `data/local/{SyncCommandEntity,SyncCommandEntityMappers,SyncCommandDao}.kt` | `sync_commands` — command-keyed FIFO queue (PK = `commandId` UUID); pop-one `nextReady` drain, durable per-row retry deferral (`nextAttemptAtEpochMillis`), `lastError` breadcrumbs, and a three-state lifecycle (PENDING / CONFLICT / DEAD) |
| `data/remote/FirebaseSyncCommandExecutor.kt` | Firestore transport behind `SyncCommandExecutor` (contract: **commandId is the idempotency key**, satisfied by remote document identity); typed `FirebaseFirestoreException` → `SyncResult` mapping |
| `data/sync/SyncWorker.kt` | `@HiltWorker` drain: pop-one FIFO loop, per-command `SyncResult` outcomes (Accepted→delete, Retryable→backoff+jitter deferral + delayed REPLACE re-drain, Conflict→'CONFLICT' park, PermanentFailure→'DEAD' park), MAX_ATTEMPTS=8 budget, decode-guard dead-lettering |
| `data/sync/SyncWorkScheduler.kt` (in `SyncWorker.kt`) | Public `enqueue()` entry point (KEEP) for on-write drain scheduling by command-producing repositories |
| `domain/evidence/` | `ChainEvent` (`@Serializable`, closed `ChainAction` vocabulary), `EvidenceRepository` (capture + OCR stages on `Resource<T>`) |
| `domain/legal/` | `LegalCitation` (evidence-grade: temporal window + source digest + gazette), `CitationValidator` (self-parsing Arabic citations, clock-injected event dates, sanitize-with-refusal) + `LegalRegistryRepository` |
| `domain/sync/` | `SyncCommand` (CQRS: commandId/aggregateId, closed `CommandType` enum, schemaVersion, attemptCount), `SyncResult` (Accepted/Retryable/Conflict/PermanentFailure), `SyncCommandExecutor` |

**Sync-command queue generations:** v6 rebuilt the table around the CQRS `SyncCommand` (closed enum, no digest); v7 (current) made `commandId` the primary key, added durable per-row retry deferral + `lastError`, and moved the attempt budget into code (`SyncWorker.MAX_ATTEMPTS = 3`). |
| `di/HarisCoreModule.kt` | Bindings + DAO/WorkManager providers for the slice |
| `ui/` | `CrimSysApp` scaffold (RTL drawer + top bar), NavHost, clay components, theme (Cairo font, urgency tokens) |
| `ui/screens/cases/` | Case list, case file, rich-text memo editor |
| `ui/screens/calendar/` | kizitonwose hearings calendar with day indicators |

## Build

```bash
cd android
./gradlew assembleDebug          # debug APK
./gradlew :app:lintDebug         # lint
```

- Requires JDK 17 and an Android SDK with platform 35 (`sdkmanager "platforms;android-35"`).
- The Gradle wrapper bootstraps Gradle 8.9 automatically on first run.
- `google-services.json` is **optional**: without it, Firestore init fails
  gracefully and the app runs fully offline (queue waits indefinitely).

## Optional: enable Firestore sync

1. Create a Firebase project and Android app with package `net.crimsys.app`
   (debug builds use `net.crimsys.app.debug`).
2. Drop `google-services.json` into `android/app/`.
3. Apply the google-services plugin in `android/build.gradle.kts` and
   `android/app/build.gradle.kts` (entries already exist commented in the
   version catalog as `google-services`).

## Release signing

Signing is wired through `android/keystore.properties` (git-ignored). One-time
setup:

```bash
cd android
keytool -genkeypair -v -keystore crimsys-release.jks -alias crimsys \
  -keyalg RSA -keysize 2048 -validity 10000
cp keystore.properties.example keystore.properties   # then fill in the values
```

`app/build.gradle.kts` picks it up automatically (guarded by `exists()`, so
debug builds work without it). Verify the artifact with
`apksigner verify --print-certs` and follow `RELEASE_CHECKLIST.md`.

## RTL / i18n notes

- `CrimSysApplication` forces `ar` via `AppCompatDelegate`; Android 13+
  per-app language overrides are honored (values-en/ was consolidated into
  the default `values/` as the English fallback).
- All UI strings go through `stringResource(R.string.…)`; both `values/` and
  `values-ar/` carry identical key sets.
- Layouts use start/end-agnostic Compose APIs (`Row`, `weight`, `Spacer`) —
  no hardcoded left/right anywhere.
