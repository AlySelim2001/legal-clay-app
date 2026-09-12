# Legal Clay — Mobile (Flutter, Android-first)

Native mobile client for the Zero-Trust legal stack. Arabic-first, offline-first,
PII-gated. Self-contained: `flutter pub get && flutter build apk --release`.

## Architecture (Clean Architecture)
```
lib/
  core/            constants, error model, clay theme, service locator
  domain/          pure logic — NO Flutter imports:
    legal/         EgyptianDeadlineCalculator (port of the audited Kotlin M4 engine)
    security/      PiiScrubber (port of presidio-scrubber/egyptian_nid.py)
  data/            SQLCipher database + DAOs, Dio backend client with pinning
  presentation/    pages + accessibility controller
test/               deadline / PII / DAO / cross-repo contract suites
```

### Domain logic — one engine per law, tested twice
- **Deadlines** (`domain/legal/egyptian_deadline_calculator.dart`): the three
  channels (المعارضة 10d, الاستئناف الجنائي 10d, الطعن بالنقض 60d), Fri/Sat
  rolled **forward** to Sunday, and the same **dual-verification** rule as the
  Kotlin engine: `java.time`-equivalent arithmetic vs a hand-rolled
  proleptic-Gregorian day-count that shares zero code. Disagreement →
  `DualCheckFailed` → the UI blocks, it never renders a possibly-wrong legal
  date. Every channel carries `needsLegalReview` until counsel signs off.
- **PII** (`domain/security/pii_scrubber.dart`): byte-parity port of the
  server recognizer — 14-digit Egyptian NID, Luhn checksum, governorate table
  (01–35 + 88), Arabic-Indic digit normalization, context boost. **Fail-closed**:
  if scrubbing itself fails, the payload is blocked, never leaked.

### Data layer
- **SQLCipher** (`sqflite_sqlcipher`) AES-256. The DB key is 32 random bytes
  (hex), generated once, stored via `flutter_secure_storage`
  (hardware-backed Android Keystore). It never leaves the device.
- **Backend**: `dio`. Release builds are **HTTPS-only** — a non-https base URL
  throws before any request exists. Release can pin the server certificate via
  `--dart-define=TLS_FINGERPRINT_SHA256=...` (enforced through
  `HttpClient.badCertificateCallback`; for CA-validated chains the system
  validator applies — stated honestly, no overclaim).
- **PII gate**: every *text* payload (assistant questions) is scrubbed on-device
  before it leaves. Scanned images are sent to the local OCR service, whose
  pipeline text passes the server-side Presidio gate — images can't be regexed.
- No Firebase, no Google services, no analytics, no telemetry.

## Release flow
1. `security/create-keystore.sh` → generates `android/app/upload-keystore.jks`
   + `android/key.properties` (both gitignored).
2. Repo secrets: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`,
   `KEY_PASSWORD`.
3. Tag `v*` (or manual dispatch) → `.github/workflows/mobile-release.yml`:
   analyze + tests are a **hard gate**, the keystore is **required** (a missing
   secret fails the job — no debug-signed "release" ever ships), split + universal
   APKs are built, signatures verified with `apksigner`, and the GitHub Release
   publishes `legal-clay-app-v<version>-<abi>.apk`.

> Note: `gradle-wrapper.jar` is not committed (binary). CI regenerates the
> wrapper with the runner's system Gradle before building.
