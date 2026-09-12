# Legal Clay — Mobile (Flutter, Android-first)

Native mobile client for the Zero-Trust legal stack. Arabic-first, offline-first,
PII-gated. This directory is self-contained: `flutter pub get && flutter build apk --release`.

## Architecture (Clean Architecture)
```
lib/
  core/            theme, error model, constants, DI container
  domain/          entities + pure logic (deadline calculator, PII scrubber)
  data/            SQLCipher database, repository impl, backend client
  presentation/    pages, widgets
test/               deadline + PII + DB + matrix-integrity suites
```

### Domain logic — one engine per law, tested twice
- `domain/legal/egyptian_deadline_calculator.dart` — Dart port of
  `android/app/.../EgyptianDeadlineCalculator.kt`: three channels (opposition 10d,
  criminal appeal 10d, cassation 60d), Fri/Sat rolled forward to Sunday, and the
  same **dual-verification** rule (two independent engines must agree or the UI
  shows a block, never a date). Windows carry `needsLegalReview` until counsel signs off.
- `domain/security/pii_scrubber.dart` — Dart port of
  `local-ai/services/presidio-scrubber/egyptian_nid.py`: 14-digit Egyptian NID,
  Luhn checksum, governorate table (01–35 + 88), Arabic-Indic digit normalization,
  context boost. **Fail-closed**: a scrubber exception blocks the payload, never leaks it.

### Data layer
- **SQLCipher** (`sqflite_sqlcipher`) AES-256; the DB key is a random 32-byte hex
  string generated once and stored in `flutter_secure_storage` (Android Keystore T-StrongBox when available).
- **Backend** — release builds talk **HTTPS only** (`https://host:8443`); a URL
  scheme check throws before any request. Debug builds may point at
  `http://127.0.0.1:8300`/LAN for the compose stack. Release additionally pins the
  server cert fingerprint from `--dart-define=TLS_FINGERPRINT_SHA256`; requests are
  fail-closed on TLS errors. PII gate runs before every backend call.
- No Firebase, no Google services, no analytics. Zero telemetry.

## Release flow
1. `security/create-keystore.sh` → generates `key.jks` + `key.properties` locally.
2. Repo secrets: `ANDROID_KEYSTORE_BASE64` (base64 of `key.jks`),
   `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
3. Push a tag `v*` → `.github/workflows/mobile-release.yml` runs analysis + tests
   (hard-failing), builds `--release --split-per-abi`, renames artifacts to
   `legal-clay-app-v<version>-<abi>.apk`, and publishes the GitHub Release.
