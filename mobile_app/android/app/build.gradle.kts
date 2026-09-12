import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// ---------------------------------------------------------------------------
// Signing: key.properties (local dev) OR environment variables (CI).
// Fallback to debug keys ONLY for debug builds — release without credentials
// fails the build (enforced again in CI with a hard error).
// ---------------------------------------------------------------------------
val keystoreProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

fun envOrProp(name: String): String? =
    System.getenv(name) ?: keystoreProperties.getProperty(name)

android {
    namespace = "app.legalclay.mobile"
    compileSdk = 35

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "app.legalclay.mobile"
        minSdk = 24          // camera2 + StrongBox-capable devices span
        targetSdk = 35
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            val storeFile = envOrProp("KEYSTORE_FILE") ?: "app/upload-keystore.jks"
            val storePassword = envOrProp("KEYSTORE_PASSWORD")
            val keyAliasValue = envOrProp("KEY_ALIAS")
            val keyPasswordValue = envOrProp("KEY_PASSWORD")
            if (storePassword != null && keyAliasValue != null && keyPasswordValue != null) {
                setStoreFile(file(storeFile))
                setStorePassword(storePassword)
                setKeyAlias(keyAliasValue)
                setKeyPassword(keyPasswordValue)
            }
        }
    }

    buildTypes {
        release {
            // A release build without signing credentials must fail loudly,
            // never fall back to debug keys.
            val signed = keystoreProperties.getProperty("KEYSTORE_PASSWORD") != null ||
                System.getenv("KEYSTORE_PASSWORD") != null
            if (!signed) {
                throw GradleException(
                    "Release build requires signing credentials: provide " +
                        "android/key.properties or KEYSTORE_PASSWORD/KEY_ALIAS/" +
                        "KEY_PASSWORD environment variables."
                )
            }
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // Explicit splits keep artifacts predictable for the release workflow;
    // CI additionally builds a universal APK in a second invocation.
    splits {
        abi {
            isEnable = true
            reset()
            include("armeabi-v7a", "arm64-v8a", "x86_64")
            isUniversalApk = false
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
}
