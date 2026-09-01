# 🏗️ LAW-SYS 2026 — Build Guide

> دليل البناء والتصدير المحلي لنظام إدارة القضايا LAW-SYS 2026

---

## Prerequisites (المتطلبات الأساسية)

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Node.js** | ≥ 18 | Ships with Bun |
| **Java JDK** | 17 (OpenJDK) | `sudo apt install openjdk-17-jdk` or Android Studio |
| **Android Studio** | Latest | [developer.android.com/studio](https://developer.android.com/studio) |

---

## Quick Start (البداية السريعة)

```bash
# 1. Clone the repository
git clone https://github.com/AlySelim2001/legal-clay-app.git
cd legal-clay-app

# 2. Install all dependencies
bun install

# 3. Run the development server
bun run dev
```

---

## Web Production Build (بناء الويب للإنتاج)

```bash
# TypeScript type check
bun tsc -b --noEmit

# Lint check
bun run lint

# Production build → outputs to /dist
bun run build

# Preview production build locally
bun run preview
```

---

## Android Build with Capacitor (بناء أندرويد مع كابوريتور)

### First-Time Setup

```bash
# 1. Build the web assets
bun run build

# 2. Initialize the Android platform (only once)
bunx cap add android

# 3. Sync web build to Android native project
bunx cap sync android
```

### Open in Android Studio

```bash
# Opens the android/ directory in Android Studio
bun run cap:open
```

### Build APK from Command Line

```bash
# Grant Gradle wrapper execution rights
chmod +x android/gradlew

# Navigate to Android project
cd android

# Build Debug APK
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build Release APK (requires signing configuration)
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### One-Command Build

```bash
# Build web + sync + prepare for Android Studio
bun run cap:sync

# Full pipeline: add android + build + sync
bun run android
```

---

## Release Signing (توقيع الإصدار الرسمي)

To sign a release APK for production distribution:

1. Generate a keystore (one-time):
   ```bash
   keytool -genkey -v -keystore crimsys-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias crimsys
   ```

2. Add signing config to `android/app/build.gradle`:
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file("crimsys-release.jks")
               storePassword System.getenv("KEYSTORE_PASSWORD")
               keyAlias "crimsys"
               keyPassword System.getenv("KEY_PASSWORD")
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

3. Build with credentials:
   ```bash
   cd android
   KEYSTORE_PASSWORD=your_password KEY_PASSWORD=your_password ./gradlew assembleRelease
   ```

---

## CI/CD (GitHub Actions)

This repository includes an automated CI/CD pipeline at `.github/workflows/android-build.yml`.

**Triggers:**
- Every push to `main` branch
- Manual trigger via GitHub Actions UI

**Pipeline:**
1. TypeScript type check + ESLint
2. Web production build
3. Capacitor sync + Gradle Debug APK build
4. APK uploaded as downloadable artifact (30-day retention)

**Access the latest APK:**
1. Go to [GitHub Actions](https://github.com/AlySelim2001/legal-clay-app/actions)
2. Click the latest successful workflow run
3. Download `LAW-SYS-2026-Debug-APK` artifact

---

## Available Scripts (السكريبتات المتاحة)

| Script | Command | Description |
|--------|---------|-------------|
| `bun run dev` | Start dev server | Vite development server with HMR |
| `bun run build` | Production build | Optimized build to `/dist` |
| `bun run preview` | Preview build | Preview production build locally |
| `bun run lint` | Lint check | ESLint check across all source files |
| `bun run cap:sync` | Capacitor sync | Build + sync to Android |
| `bun run cap:open` | Open Android Studio | Opens native Android project |
| `bun run cap:run` | Build + run | Build, sync, and run on connected device |
| `bun run android` | Full Android setup | Add platform + build + sync |

---

## Troubleshooting (حل المشكلات)

| Issue | Solution |
|-------|----------|
| `supabaseUrl is required` | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment |
| `JAVA_HOME not set` | Install JDK 17 and set `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64` |
| `gradlew: Permission denied` | Run `chmod +x android/gradlew` |
| Build OOM (SIGKILL) | Increase Node memory: `export NODE_OPTIONS="--max-old-space-size=4096"` |
| `bun install` fails | Delete `node_modules` and `bun.lockb`, then run `bun install` again |

---

## System Capabilities (قدرات النظام)

- ✅ **Multi-Agent AI Legal Swarm** — 5 specialized Egyptian law agents + Colombo forensic agent
- ✅ **Dynamic Deadline Calculator** — Criminal, civil, administrative, family, and labor deadlines
- ✅ **OCR Document Scanner** — Arabic + English document recognition via Tesseract.js
- ✅ **PDF Generation** — Court-formatted legal documents with Amiri Arabic font
- ✅ **Excel Import/Export** — SheetJS integration for legacy workbook compatibility
- ✅ **Offline-First Architecture** — IndexedDB + TanStack Query persistence
- ✅ **FullCalendar Integration** — Arabic RTL court schedule management
- ✅ **Entity Resolution Engine** — Duplicate case/client linkage across courts
- ✅ **Cassation Court Precedent Research** — Searchable Egyptian judicial rulings database
- ✅ **CapacitorJS Android** — Native mobile app with push notifications
- ✅ **Dark Mode** — Full theme support with Arabic/English toggle
- ✅ **Backup & Restore** — Complete data sovereignty with local JSON export/import

---

## Legal Disclaimer (إخلاء المسؤولية)

> ⚠️ هذا النظام أداة مساعدة لإدارة المعلومات القانونية فقط. لا يُغني عن استشارة المحامي المختص. جميع النتائج والحسابات تقديرية ويجب التحقق منها قبل اتخاذ أي إجراء قانوني.

---

## Support (التواصل والدعم)

- 📱 **WhatsApp:** [01119886662](https://wa.me/201119886662)
- 🔗 **Repository:** [github.com/AlySelim2001/legal-clay-app](https://github.com/AlySelim2001/legal-clay-app)

---

*Built with ❤️ for the Egyptian legal community*
