// CRIM-SYS 2026 — app module (production-hardened).
//
// Signing: reads android/keystore.properties (git-ignored). Copy
// keystore.properties.example → keystore.properties and fill in your values.
// Missing file → assembleRelease produces an unsigned build that apksigner
// will reject; the checklist in RELEASE_CHECKLIST.md covers verification.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

// ─────────────────────────────────────────────────────────────────────────────
// Release signing from keystore.properties (outside VCS)
// ─────────────────────────────────────────────────────────────────────────────
val keystoreProperties = java.util.Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val firestoreProjectId: String = keystoreProperties.getProperty("firestoreProjectId") ?: ""

android {
    namespace = "net.crimsys.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.crimsys.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "2026.1.0"

        // Arabic-first practice: strip all other library locales (~saves MBs
        // of translations pulled in via AppCompat/Play-services).
        resourceConfigurations += listOf("ar", "en")

        vectorDrawables { useSupportLibrary = true }

        // BuildConfig passthrough — secrets stay in keystore.properties,
        // never in source control. Both are OPTIONAL: the app is offline-first
        // and Firestore degrades gracefully when unset (RemoteDataSource
        // returns push=false and the queue keeps waiting).
        buildConfigField("String", "FIRESTORE_PROJECT_ID", "\"$firestoreProjectId\"")
        buildConfigField("boolean", "SYNC_ENABLED", keystoreProperties.getProperty("syncEnabled") ?: "true")
    }

    signingConfigs {
        if (keystoreProperties.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (keystoreProperties.isNotEmpty()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += setOf(
                "/META-INF/{AL2.0,LGPL2.1}",
                "META-INF/DEPENDENCIES",
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
            )
        }
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.incremental", "true")
}

dependencies {
    // AndroidX core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Room + SQLCipher encryption (single source of truth)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.sqlcipher)

    // DataStore (app preferences)
    implementation(libs.androidx.datastore.preferences)

    // Firestore + Auth (sync target; optional — offline-first degrades
    // gracefully when google-services.json is missing).
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.coroutines.play.services)

    // Serialization (offline action JSON payloads)
    implementation(libs.kotlinx.serialization.json)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Calendar & rich text editor
    implementation(libs.kizitonwose.calendar.compose)
    implementation(libs.richeditor.compose)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.turbine)
    testImplementation(libs.mockk)
    androidTestImplementation(libs.junit.ext)
    androidTestImplementation(libs.espresso.core)
    debugImplementation(libs.androidx.compose.ui.tooling)
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribution tasks
//   ./gradlew copyReleaseApk    → app/build/distribution/CRIM-SYS-<ver>-<sha>.apk
//   ./gradlew copyReleaseBundle → app/build/distribution/CRIM-SYS-<ver>-<sha>.aab
// Version+commit naming so builds shared with the practice are tellable apart.
// ─────────────────────────────────────────────────────────────────────────────
val appVersionName = android.defaultConfig.versionName

val gitShortSha: String by lazy {
    runCatching {
        val p = ProcessBuilder("git", "rev-parse", "--short", "HEAD")
            .directory(rootDir).start()
        p.inputStream.bufferedReader().readText().trim()
    }.getOrDefault("nogit")
}

tasks.register("copyReleaseApk") {
    dependsOn("assembleRelease")
    doLast {
        val src = layout.buildDirectory.file("outputs/apk/release/app-release.apk").get().asFile
        val dstDir = layout.buildDirectory.dir("distribution").get().asFile
        dstDir.mkdirs()
        src.copyTo(java.io.File(dstDir, "CRIM-SYS-$appVersionName-$gitShortSha.apk"), overwrite = true)
        println("Distribution APK → ${dstDir}/CRIM-SYS-$appVersionName-$gitShortSha.apk")
    }
}

tasks.register("copyReleaseBundle") {
    dependsOn("bundleRelease")
    doLast {
        val src = layout.buildDirectory.file("outputs/bundle/release/app-release.aab").get().asFile
        val dstDir = layout.buildDirectory.dir("distribution").get().asFile
        dstDir.mkdirs()
        src.copyTo(java.io.File(dstDir, "CRIM-SYS-$appVersionName-$gitShortSha.aab"), overwrite = true)
        println("Distribution AAB → ${dstDir}/CRIM-SYS-$appVersionName-$gitShortSha.aab")
    }
}
