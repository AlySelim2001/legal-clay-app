# Changelog

All notable changes to CRIM-SYS 2026 (LAW-SYS) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
