plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "net.crimsys.legalclay"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.crimsys.legalclay"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    // Release signing reads mobile_app/android/key.properties (gitignored).
    // A missing keystore FAILS assembleRelease loudly — no debug-signed
    // "release" APK ever ships.
    signingConfigs {
        create("release") {
            val keystoreProperties = java.util.Properties()
            val keystoreFile = rootProject.file("key.properties")
            if (keystoreFile.exists()) {
                keystoreFile.inputStream().use { keystoreProperties.load(it) }
            } else if (gradle.startParameter.taskNames.any {
                    it.contains("Release", ignoreCase = true)
                }
            ) {
                throw GradleException(
                    "key.properties missing: release builds require signing config " +
                        "(see mobile_app/README.md → Release flow)."
                )
            }
            storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false // Flutter shrinker handles release sizing
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

flutter {
    source = "../.."
}
