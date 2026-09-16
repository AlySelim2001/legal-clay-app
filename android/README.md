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

**Two queue generations coexist by policy — the legacy `OfflineActionQueue`
must NOT be deleted while it still has live producers:**

```
                    CURRENT
                       │
              OfflineActionQueue
                       │
             ┌─────────┴─────────┐
             │                   │
       Existing producers    New producers
             │                   │
             ▼                   ▼
       Legacy Queue        SyncCommand Queue
                                 │
                                 ▼
                            WorkManager
                                 │
                                 ▼
                       Typed SyncResult
                                 │
             ┌───────────────────┼──────────────────┐
             ▼                   ▼                  ▼
          Accepted            Retryable          Conflict
             │                   │                  │
          Delete             Backoff              Review
```

- `CaseRepositoryImpl` and `HearingRepositoryImpl` are **live producers** of
  the legacy queue (Room write → `offlineActionDao.enqueue` → `SyncManager`
  drain), and the UI sync badges read its Flows — removal would break case
  intake outright.
- New producers write to the `SyncCommandQueue` (`SyncCommandEntity` →
  `SyncWorkScheduler` → `SyncWorker` → typed `SyncResult`).
- **Deprecation order (hard gate):** migrate ALL producers to the
  sync-command queue → run parity tests (identical outcomes for the same
  operation through both queues) → only then mark the legacy queue DEPRECATED
  and remove it.
- **Parity gate — implemented:** `QueueParityTest` (unit tests) already
  proves identical observable outcomes through both generations for case
  intake (accepted / rejected / poison-head / FIFO order). When a producer
  migrates, extend the suite with that producer's operation on the command
  side and re-run BEFORE deleting its legacy enqueue.
- **P1-A semantic parity suites:** the operation vocabulary mapping
  (`OperationMappingParityTest`), the canonical payload shapes
  (`PayloadParityTest`), the typed-command reliability matrix incl.
  remote-registry idempotency (`SyncOperationParityTest`), and the
  crash-consistency matrix on a file-backed DB (`CrashConsistencyMatrixTest`)
  — P1-A is verification-only: no legacy component removed, no producer
  changed. Producer-side atomicity rows of the crash matrix (Case+Command
  in one transaction) are P1-B RED tests, not yet claimable.

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
| `test/…/data/sync/SyncWorkerTest.kt` | JVM/Robolectric (SDK 35 — Robolectric 4.16 needs JDK 21 for the SDK 36 target; the ladder pins JDK 17) drain integration test: real in-memory Room queue + fake executor over work-testing. Covers Accepted/Retryable/Conflict/PermanentFailure, the undecodable-head livelock regression (poor row dead-lettered, tail still drained), MAX_ATTEMPTS=8 dead-letter without transport touch, and durable retry deferral (attemptCount/lastError/nextAttemptAt + invisibility inside the window) |
| `test/…/data/sync/QueueParityTest.kt` | **Parity gate (coexistence policy):** proves the two queue generations produce IDENTICAL observable outcomes for the same operations — real `CaseRepositoryImpl` + `SyncManager` on the legacy side vs the canonical command mapping + `SyncWorker` on the command side, both against real in-memory Room, transport faked. Scenarios: accepted (one delivery, empty queue), rejected (retained, one attempt), poison-head (dead-lettered without blocking the tail), multi-mutation FIFO order. Legacy-only producer behaviors (isSynced flip) and command-side bindings (payload caseId == aggregateId) are asserted on their own sides — the isSynced coupling migrates WITH the producer, after this suite passes |
| `data/sync/SyncWorkScheduler.kt` (in `SyncWorker.kt`) | Public `enqueue()` entry point (KEEP) for on-write drain scheduling by command-producing repositories |
| `domain/evidence/` | `ChainEvent` (`@Serializable`, closed `ChainAction` vocabulary), `EvidenceRepository` (capture + OCR stages on `Resource<T>`) |
| `domain/legal/` | `LegalCitation` (evidence-grade: temporal window + source digest + gazette), `CitationValidator` (self-parsing Arabic citations, clock-injected event dates, sanitize-with-refusal) + `LegalRegistryRepository` |
| `domain/sync/` | `SyncCommand` (CQRS: commandId/aggregateId, closed `CommandType` enum, schemaVersion, attemptCount), `SyncResult` (Accepted/Retryable/Conflict/PermanentFailure), `SyncCommandExecutor` |

**Sync-command queue generations:** v6 rebuilt the table around the CQRS `SyncCommand` (closed enum, no digest); v7 (current) made `commandId` the primary key, added durable per-row retry deferral + `lastError`, and moved the attempt budget into code (`SyncWorker.MAX_ATTEMPTS = 8`). |
| `app/schemas/…CrimSysDatabase/` | Exported Room schema JSONs — the migration-test contract. `3.json` is **hand-written and frozen** (deterministic mirror of what `MIGRATION_1_2`+`MIGRATION_2_3` built — nothing in the repo can regenerate it); `4.json` is re-exported by KSP on every build (`exportSchema = true`). Packaged as androidTest assets so `MigrationTestHelper` finds them; never shipped in the production APK. |
| `app/src/androidTest/…/RoomMigration3To4Test.kt` | Instrumented 3→4 migration gate: builds a real v3 db from `3.json`, seeds boundary rows (PENDING, DLQ `DEAD`, legacy `actionUuid=''` sentinel), runs `MIGRATION_3_4` with full schema validation, asserts zero data loss byte-for-byte + new-table constraints (`UNIQUE(originalFileHash)` dedup). Requires a device/emulator. |
| `app/src/androidTest/…/EvidenceCaptureInstrumentedTest.kt` | Instrumented evidence-capture gate: runs the real `captureAndSecureEvidence` critical path on-device (fused hash+copy → fsync → read-only → rename → Room insert → genesis CAPTURED event, pinned to the `Sha256Test` `"hello"` vector), a live red-team tamper-and-compare on the secured file, clean-failure/no-leftover-file paths (unreadable source, UNIQUE-hash duplicate), and the OCR stage (chain-head-linked `OCR_PROCESSED` event + `processedFileHash` stamp + second-derivative refusal). Requires a device/emulator. |
| `di/HarisCoreModule.kt` | Bindings + DAO/WorkManager providers for the slice |
| `ui/` | `CrimSysApp` scaffold (RTL drawer + top bar), NavHost, clay components, theme (Cairo font, urgency tokens) |
| `ui/screens/cases/` | Case list, case file, rich-text memo editor |
| `ui/screens/calendar/` | kizitonwose hearings calendar with day indicators |

## Production Gates — what is NOT yet allowed to ship

**Gate 1 — Command envelope validation (backend).**
`FirebaseSyncCommandExecutor` makes redelivery idempotent by document
identity, but document identity alone is not domain synchronization.
`firestore.rules` (this directory) is the deployable first enforcement layer:
`commandId` == document key, `schemaVersion == 1` only, closed `CommandType`
vocabulary, exact field shape, `ownerUid == request.auth.uid`, updates must be
byte-identical (append-only log), no client deletes. Honest boundary: rules
cannot parse `payloadJson` — deep payload-schema validation, aggregate
referential checks, and retention are Cloud Functions responsibilities.

**Gate 2 — Legal source ingestion (process, not code).** The DAO is not
trust: every `LegalSourceDao` query reads `verified = 1` rows only, so an
unreviewed source is invisible to the Citation Gate *by construction*. Trust
comes from the ingestion pipeline — official source → downloaded original →
SHA-256 → parser → legal review → effective dates → `verified = true` —
enforced by `docs/engineering/skills/legal-source-review.md`. There is
intentionally NO in-app producer of `LegalSourceEntity`.

**Gate 3 — Evidence integrity verification (runtime).** `setReadOnly()` is
defense-in-depth, not a rooted-device guarantee. The evidence is the
COMBINATION: original hash + chain of custody + encrypted metadata —
re-derived at runtime by `EvidenceIntegrityVerifier` (SHA-256 recomputation
from disk bytes + custody-chain replay with genesis anchoring to the stored
`originalFileHash`), red-team tested in `EvidenceIntegrityVerifierTest`
(tamper-and-compare, swapped anchor, reordered/forged links). Honest
boundary: this proves tamper-*evidence*, not tamper-*proof*; an attacker who
can rewrite both the file and the local DB is a remote-log/attestation
problem (Gate 1's append-only command log is the anchor).

## Build
```bash
cd android
./gradlew assembleDebug          # debug APK
./gradlew :app:lintDebug         # lint
```

- Requires JDK 17 and an Android SDK with platform 36 (`sdkmanager "platforms;android-36"`).
- The Gradle wrapper bootstraps Gradle 8.11.1 automatically on first run.
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
