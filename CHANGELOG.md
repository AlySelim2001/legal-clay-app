# Changelog

All notable changes to CRIM-SYS 2026 (LAW-SYS) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🌐 Web — lint debt cleared (46 → 0) and lint promoted to a CI hard gate

- **Zero-error lint gate** (`bun run lint` exit 0; `bun tsc -b --noEmit` exit 0): 22 no-unused-vars after per-site proof of dead code, 5 no-useless-escape, 4 `no-explicit-any` replaced with real types (`QueryType` from `lib/evidence`; `EvidenceStatus` exported from `schema.ts` via `Infer`), and 15 React-Compiler `react-hooks` errors fixed with behavior-preserving patterns: `queueMicrotask` effect boundaries (10), `useState(() => …)` per-instance randomness instead of render-time `Math.random` (sidebar), deferred `CASE-<ts>` generation into submit payload before Zod validation (EnterpriseCaseForm), latest-ref sync inside `useEffect` (useSessionTimeout), declared-before-use `submit` with `useCallback` (LegalChatPanel), and manual-memoization removal where inferred deps (`person.cases`) could not match source deps (`person?.cases`) (EnterprisePersonDetail)
- **CI policy change** (`.github/workflows/main.yml`): the lint step is no longer advisory — renamed `ESLint (hard gate)` with `continue-on-error` removed; `build-android needs [quality, android-unit]` makes it load-bearing. Remaining advisories: `Build Web` step only
- **Remaining 25 warnings documented in `TECHNICAL_DEBT.md`** (21 react-refresh/only-export-components — shadcn `*Variants` and Provider+hook conventions; 4 unused-disable headers on Convex `_generated` files that codegen restores) — each with file, rule, cause, generated-code flag, removal plan, and priority; one dead directive removed in-branch (`convex/lib/text.ts`), 26 → 25
- **Phase 1 evidence pack**: `PHASE1_FINAL.md` (surface status + handoff), `RUN_120_EVIDENCE.md` (launch attempts blocked — triple platform lock, failure-layer taxonomy, fill-in template), `ROOM_MIGRATION_4_5_REPORT.md` (4→5 contract + `RoomMigration4To5Test` written; `5.json` must come from KSP, never hand-written), `FLUTTER_APPROVAL_MATRIX.md` (13-package decision table: 0 ACCEPT · 3 ACCEPT-ready · 10 DEFER + patch appendices; `pubspec.yaml` untouched pending explicit approval)
- No claims of Android/Flutter/test success — nothing outside the web toolchain actually executed in this environment; Run #120 remains the sole proof for the native gate

### 🔁 Android Native — P1-A: queue parity verification (no producers changed)

- **Semantic parity suites for the typed sync queue** (`data/sync/`): `OperationMappingParityTest` (exhaustive legacy→typed operation mapping, fails on any gap, no UNKNOWN fallback), `PayloadParityTest` (field-by-field payload parity for CREATE_CASE/UPDATE_MEMO/CREATE_HEARING, decode/re-encode safety, no-secret keys, verbatim transport delivery, FIFO order), `SyncOperationParityTest` (identity/payload-opaque/durability/retry/permanent/conflict matrix + remote-registry idempotency evidence: same commandId retried after a lost response commits the remote mutation exactly once), and `CrashConsistencyMatrixTest` (file-backed DB close/reopen proving commands, retry state, and parked CONFLICT rows survive process death)
- All suites run the REAL `SyncWorker` drain against REAL Room; only the transport is faked. P1-A is verification-only: legacy queue intact, producers untouched

### 🧱 Android Native — P0 Hilt graph hardening

- `@ApplicationContext` added to the unqualified `Context` injections in `SyncWorkScheduler` and `DatabasePassphraseProvider` — Dagger cannot satisfy an unqualified `Context` binding in `SingletonComponent`, so the first command-queue producer to inject `SyncWorkScheduler` (and any direct injection of `DatabasePassphraseProvider`) would have failed the Hilt graph at compile time

### 🤖 Android Native — HarisCore Test Gates (all three pre-release stages complete)

- **Room migration test 3 → 4** (`RoomMigration3To4Test`) — hand-written frozen `3.json` + `MIGRATION_3_4` validation, zero data loss byte-for-byte
- **Evidence capture instrumentation test** (`EvidenceCaptureInstrumentedTest`) — real-device custody pipeline: fused hash+copy → fsync → read-only → rename → genesis `CAPTURED` event, red-team tamper-and-compare, clean-failure paths, OCR stage
- **SyncWorker integration test** (`SyncWorkerTest`, JVM/Robolectric SDK 35 — Robolectric 4.16 needs JDK 21 for an SDK 36 target; the ladder pins JDK 17) — real in-memory Room queue + fake executor: Accepted/Retryable/Conflict/PermanentFailure, undecodable-head livelock regression, MAX_ATTEMPTS=8, durable retry deferral
- **Queue parity suite** (`QueueParityTest`) — the coexistence-policy gate: identical observable outcomes (delivery count, payload, FIFO order, park/retain semantics, anti-livelock) through the legacy OfflineActionQueue (real `CaseRepositoryImpl` + `SyncManager`) and the SyncCommand queue (canonical mapping + `SyncWorker`); passing it unblocks producer migration to the command queue
- Gradle wiring: `robolectric` 4.16, `androidx-work-testing`, `androidx-test-core`, `testOptions.unitTests.isIncludeAndroidResources = true`

## [2.0.0] - 2026-09-03

### 🚀 Added — Phase 2 Enterprise Features

- **Person Detail View** (`/app/persons/:personCode`) with masked National ID (last 4 digits only)
- **Case Create/Edit Form** with full Zod validation, auto-generated tracking numbers
- **Session Create/Edit Modal** with direct case linking, judge/court selection
- **Document Upload** wired to Supabase Storage with signed URLs (3600s TTL)
- **Settings Page** with RBAC management (Admin, Lawyer, Assistant, ReadOnly)
- **Interactive Calendar** with FullCalendar, Arabic RTL date format support
- **Audit Logging** — client-side and database triggers for all mutations
- **Legal Disclaimers** on Dashboard, CaseDetail, Calendar, Actions, Persons, AuditLog

### 🔒 Security Hardening

- **Session Timeout** — auto-logout after 15 minutes of inactivity
- **Encrypted Local Storage** — Web Crypto API (AES-GCM 256-bit) for sensitive cached data
- **RLS Policies** — Supabase Row Level Security on all 6 enterprise tables
- **pgcrypto Encryption** — National ID encrypted with AES-256, only last 4 digits displayed
- **Audit Trail Triggers** — database-level logging on INSERT/UPDATE/DELETE for all entities
- **XSS Protection** — HTML sanitizer strips dangerous tags, event handlers, and protocols
- **RBAC Guards** — server-side role enforcement with client-side UI adaptation

### ⚡ Performance Optimization

- **Code Splitting** — all routes lazy-loaded via `React.lazy()` and `Suspense`
- **TanStack Query Persistence** — 24-hour offline cache with IndexedDB/localStorage
- **Lazy Tesseract.js** — OCR engine (~2MB) loaded on-demand only when scanning
- **Exponential Backoff** — query retry with 1s → 2s → 4s delays
- **Network Mode: Always** — queries serve from cache when offline

### 🤖 Android Build

- **CapacitorJS 8.5.0** — native Android app via `@capacitor/android`
- **GitHub Actions CI/CD** — Bun-based pipeline with Quality Control → Android APK build
- **APK Artifact** — auto-uploaded as `CRIM-SYS-2026-Debug-APK` (30-day retention)
- **Build Guide** — complete local and CI build documentation

### 🧪 Testing

- **Playwright E2E** — criminal case flow, OCR scan, deadline calculator tests
- **TypeScript Strict Mode** — zero errors across 160+ source files

### 📝 Documentation

- **BUILD_GUIDE.md** — comprehensive build and troubleshooting guide
- **USER_GUIDE_AR.md** — Arabic user manual for non-technical lawyers
- **CHANGELOG.md** — this file

### 🌐 Arabic RTL

- Full Arabic-first interface with `<html dir="rtl" lang="ar">`
- Logical spacing utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- All empty states in Arabic: "لا توجد بيانات مسجلة بعد"
- Legal disclaimer: "جميع البيانات والإجراءات مقترحة تحتاجة إلى مراجعة واعتماد محامٍ مختص"

---

## [1.0.0] - 2026-08-01

### Initial Release

- Base React + Vite + Tailwind CSS + shadcn/ui template
- Supabase Auth integration (email OTP)
- Convex backend scaffold
- Claymorphism theme with urgency color tokens
- Sidebar navigation with RTL drawer
- Dashboard with KPI cards
- Basic case, client, and calendar placeholder pages
