# 🏗️ CRIM-SYS 2026 — Build Guide

> دليل البناء لنظام إدارة القضايا CRIM-SYS 2026 — تطبيق ويب مرجعي + وحدة أندرويد أصلية.

The repo has **two buildable surfaces**:

| Surface | Location | Toolchain |
|---|---|---|
| **Native Android app** (production target) | `android/` | JDK 17, Android SDK 35, Gradle 8.9 (wrapper) |
| **Web reference app** | repo root | Bun ≥ 1.1, Vite 7, TypeScript |

---

## Prerequisites (المتطلبات الأساسية)

| Tool | Version | Notes |
|------|---------|-------|
| **JDK** | 17 (Zulu/OpenJDK) | required by both AGP and Kotlin |
| **Android SDK** | platform 35 | `sdkmanager "platforms;android-35"` — or Android Studio |
| **Bun** | ≥ 1.1 | web reference app only — `curl -fsSL https://bun.sh/install \| bash` |

---

## Native Android App (الهدف الإنتاجي)

```bash
cd android
chmod +x gradlew

# Debug APK — no signing setup needed
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Lint gate
./gradlew :app:lintDebug
```

The Gradle wrapper bootstraps Gradle 8.9 automatically on first run.
`google-services.json` is **optional**: without it, Firestore sync degrades
gracefully and the app runs fully offline.

### Release build & signing (توقيع الإصدار)

Signing reads `android/keystore.properties` (git-ignored — see
`keystore.properties.example`). One-time setup:

```bash
cd android
keytool -genkeypair -v -keystore crimsys-release.jks -alias crimsys \
  -keyalg RSA -keysize 2048 -validity 10000
cp keystore.properties.example keystore.properties   # fill in the values
```

Then build and verify:

```bash
./gradlew copyReleaseApk     # → app/build/distribution/CRIM-SYS-<ver>-<sha>.apk
./gradlew copyReleaseBundle  # → AAB for Google Play

# Verify the signature — must pass before shipping anything:
BT="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)"
"$BT/apksigner" verify --print-certs app/build/outputs/apk/release/app-release.apk
```

> Release builds run R8 minification + resource shrinking; the rules live in
> `android/app/proguard-rules.pro` and every build emits a `mapping.txt` for
> de-obfuscating crash traces. Pre-flight gates: `android/RELEASE_CHECKLIST.md`.

### Automated releases (GitHub Releases)

Pushing a tag `v2026.X.Y` triggers
[.github/workflows/android-release.yml](.github/workflows/android-release.yml):
it verifies the tag matches `versionName`, builds the signed APK from CI
secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`),
verifies it with `apksigner`, and attaches it to a GitHub Release with SHA256
checksums — the delivery channel for the closed beta
([docs/LAUNCH_STRATEGY.md](docs/LAUNCH_STRATEGY.md)).

---

## Web Reference App (المرجع التجريبي)

```bash
bun install          # install dependencies
bun run dev          # dev server
bun tsc -b --noEmit  # type check
bun run lint         # eslint
bun run build        # production build → dist/
bun run preview      # preview the production build
```

Tests (Playwright):

```bash
bun run test         # headless run
bun run test:ui      # interactive UI mode
```

---

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
|---|---|---|
| [android-build.yml](.github/workflows/android-build.yml) | push/PR to `main` | web QC (non-blocking) + native `assembleDebug` + debug-APK artifact |
| [android-release.yml](.github/workflows/android-release.yml) | tag `v*` | signed release APK → GitHub Release + SHA256SUMS |

Access the latest debug build: **Actions → CRIM-SYS 2026 — Android Build &
Quality Control → latest run → `CRIM-SYS-2026-Debug-APK`**.

---

## Troubleshooting (حل المشكلات)

| Issue | Solution |
|-------|----------|
| `JAVA_HOME not set` / wrong JVM | `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64` (JDK 17 exactly) |
| `gradlew: Permission denied` | `chmod +x android/gradlew` |
| `SDK location not found` | create `android/local.properties` with `sdk.dir=/path/to/android-sdk`, or set `ANDROID_HOME` |
| Gradle OOM (SIGKILL) | `./gradlew -Dorg.gradle.jvmargs="-Xmx3g" assembleDebug` |
| `UnsatisfiedLinkError: sqlcipher` | wrong ABI on the emulator/device — use an arm64 or x86_64 image |
| Release unsigned / `apksigner` fails | `keystore.properties` missing or wrong values — see the signing section above |
| `bun install` fails | delete `node_modules` + lockfile, reinstall |

---

## System Capabilities (قدرات النظام)

- ✅ **Native Android, offline-first** — Room single source of truth + deferred sync queue
- ✅ **SQLCipher encryption** — Keystore-wrapped key, backup-excluded
- ✅ **Hearings calendar + rich-text Arabic memo editor** (Compose)
- ✅ **In-app update checker** — GitHub Releases API, zero telemetry
- ✅ **Production hardening** — R8, baseline profile, network security config
- ✅ **Web reference app** — multi-agent legal swarm, Arabic OCR, PDF export, RTL calendar

---

## Legal Disclaimer (إخلاء المسؤولية)

> ⚠️ هذا النظام أداة مساعدة لإدارة المعلومات القانونية فقط. لا يُغني عن استشارة المحامي المختص. جميع النتائج والحسابات تقديرية ويجب التحقق منها قبل اتخاذ أي إجراء قانوني. النص الكامل: [DISCLAIMER.md](DISCLAIMER.md).

---

## Support (الدعم)

- 📱 **WhatsApp:** [01119886662](https://wa.me/201119886662)
- 🔗 **Repository:** [github.com/AlySelim2001/legal-clay-app](https://github.com/AlySelim2001/legal-clay-app)
