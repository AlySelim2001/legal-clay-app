# Android host for the Flutter mobile app (mobile_app/android)

gradle.properties:
  AndroidX on, R8 full mode off for Flutter default, memory sized for CI.

build.gradle.kts (root): plugins block only (AGP + Kotlin declared, applied in app).

settings.gradle.kts: includes :app, points plugin management at
google()/mavenCentral().

app/build.gradle.kts:
  - applicationId net.crimsys.legalclay
  - Flutter notes: this host is wired for a standard Android build; when
    integrating the Flutter toolchain (flutter gradle plugin), the
    `flutter build apk` CLI drives it and no manual wiring is needed.
  - signing reads mobile_app/android/key.properties (gitignored); missing
    keystore → assembleRelease fails loudly (no debug-signed "release" ships).

gradle wrapper: the jar is gitignored (binary). CI regenerates it with the
runner's system Gradle before invoking `flutter build apk`.
