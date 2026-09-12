# Legal Clay — Mobile (Flutter, Android-first)

Native mobile client for the Zero-Trust legal stack. Arabic-first RTL,
offline-first, PII-gated. Self-contained: `flutter pub get && flutter build apk --release`.

## Architecture (Clean Architecture)

```
lib/
  core/            constants (API paths, dart-defines, legal text), error model
  domain/          pure logic — NO Flutter imports:
    legal/         EgyptianDeadlineCalculator (port of the audited Kotlin M4 engine)
    security/      PiiScrubber (port of presidio-scrubber/egyptian_nid.py)
  data/
    backend/       BackendClient — Dio, HTTPS-only release, fail-closed TLS pin,
                   on-device PII gate before any text leaves the device
    local/         SQLCipher database (AppDatabase) + Keystore-backed DbKeyManager
  presentation/    provider-based shell (HomeShell, 5 tabs), clay theme,
                   a11y controller/banners, voice gateway (TTS/STT facades)
test/               deadline / PII suites (parity with the Kotlin + Python tests)
```

### Domain logic — one engine per law, tested twice

- **Deadlines** (`domain/legal/egyptian_deadline_calculator.dart`): the three
  channels (المعارضة 10d, الاستئناف الجنائي 10d, الطعن بالنقض 60d), Fri/Sat
  rolled **forward** to Sunday, and the same **dual-verification** rule as the
  Kotlin engine: `DateTime`-anchored arithmetic vs a hand-rolled
  proleptic-Gregorian day-count (Zeller weekday + manual month lengths) that
  shares zero code with DateTime. Disagreement → `DeadlineDualCheckFailed` →
  the UI blocks, it never renders a possibly-wrong legal date. Every channel
  carries `needsLegalReview` until counsel signs off.
- **PII** (`domain/security/pii_scrubber.dart`): byte-parity port of the
  server recognizer — 14-digit Egyptian NID, Luhn checksum, governorate table
  (01–35 + 88), Arabic-Indic digit normalization, context boost. **Fail-closed**:
  if scrubbing itself fails, the payload is blocked, never leaked.

### Data & security layers

- **SQLCipher** (`sqflite_sqlcipher`) AES-256. The DB key is 32 random bytes
  (hex), generated once, stored via `flutter_secure_storage`
  (hardware-backed Android Keystore). It never leaves the device. A broken
  Keystore fails closed — the DB simply never opens in plaintext.
- **Backend**: `dio`. Release builds are **HTTPS-only** — a non-https base URL
  throws `ConfigurationError` before any request exists. Release can pin the
  server certificate via `--dart-define=TLS_FINGERPRINT_SHA256=...`
  (fail-closed `badCertificateCallback` with constant-time compare; for
  CA-validated chains the system validator applies — stated honestly, no
  overclaim).
- **PII gate**: every text payload (assistant questions) is scrubbed on-device
  before transmission; scanned images go to the local OCR service, whose
  pipeline text passes the server-side Presidio gate — images can't be
  regexed.
- No Firebase, no Google services, no analytics, no telemetry.

### Presentation & accessibility

- **HomeShell**: 5 tabs (الاستغاثة / مسح مستند / المساعد / المواعيد / حول),
  RTL-locked `Directionality`, Material 3 clay theme (warm matte clay,
  inflated double-layer shadows, 28dp radii, 56dp+ touch targets).
- **Accessibility controller**: font scale 100/125/150/200% applied through
  `MediaQuery.textScaler` (nothing breaks at 200%), high-contrast black/yellow
  AAA theme variant, `Semantics.liveRegion` banners for legal alerts,
  long-press spoken explanations on every emergency action.
- **Honest pipeline**: the scanner shows exactly the stages that exist
  (capture → upload → OCR text). No fake "YOLO detection" stages for a model
  that isn't shipped.

## Release flow

1. `security/create-keystore.sh` → generates `android/app/upload-keystore.jks`
   + `android/key.properties` (both gitignored).
2. Repo secrets: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`,
   `KEY_PASSWORD`.
3. Tag `v*` (or manual dispatch) → `.github/workflows/mobile-release.yml`:
   analyze + tests are a **hard gate**, the keystore is **required** (a missing
   secret fails the job — no debug-signed "release" ever ships), split + universal
   APKs are built, signatures verified with `apksigner`, and the GitHub Release
   publishes `legal-clay-app-v<version>-<abi>.apk` + SHA256SUMS.

> Note: `gradle-wrapper.jar` is not committed (binary). CI regenerates the
> wrapper with the runner's system Gradle before building (version pinned to
> match `gradle/wrapper/gradle-wrapper.properties`). Locally, run `gradle
> wrapper` once (Gradle 8.12+) before your first `flutter build apk`.
