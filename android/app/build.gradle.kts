// CRIM-SYS 2026 — production Android module.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

val keystoreProperties = java.util.Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.isFile }?.inputStream()?.use(::load)
}
val firestoreProjectId = keystoreProperties.getProperty("firestoreProjectId") ?: ""

android {
    namespace = "net.crimsys.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "net.crimsys.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "2026.1.0"
        resourceConfigurations += listOf("ar", "en")
        vectorDrawables { useSupportLibrary = true }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreProperties.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            // Deliberately no release signing configuration.
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging.resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "META-INF/DEPENDENCIES", "META-INF/versions/9/OSGI-INF/MANIFEST.MF")
    sourceSets { getByName("androidTest") { assets.srcDir("$projectDir/schemas") } }
    testOptions { unitTests { isIncludeAndroidResources = true } }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.incremental", "true")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.sqlcipher)
    implementation(libs.androidx.datastore.preferences)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.compiler)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.kizitonwose.calendar.compose)
    implementation(libs.richeditor.compose)
    testImplementation(libs.junit)
    testImplementation(libs.turbine)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.work.testing)
    testImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.junit.ext)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.room.testing)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

val appVersionName = android.defaultConfig.versionName
val gitShortSha: String by lazy {
    runCatching {
        ProcessBuilder("git", "rev-parse", "--short", "HEAD").directory(rootDir).start().inputStream.bufferedReader().readText().trim()
    }.getOrDefault("nogit")
}
tasks.register("copyReleaseApk") {
    dependsOn("assembleRelease")
    doLast {
        val src = layout.buildDirectory.file("outputs/apk/release/app-release.apk").get().asFile
        val dir = layout.buildDirectory.dir("distribution").get().asFile.also { it.mkdirs() }
        src.copyTo(java.io.File(dir, "CRIM-SYS-$appVersionName-$gitShortSha.apk"), overwrite = true)
    }
}
tasks.register("copyReleaseBundle") {
    dependsOn("bundleRelease")
    doLast {
        val src = layout.buildDirectory.file("outputs/bundle/release/app-release.aab").get().asFile
        val dir = layout.buildDirectory.dir("distribution").get().asFile.also { it.mkdirs() }
        src.copyTo(java.io.File(dir, "CRIM-SYS-$appVersionName-$gitShortSha.aab"), overwrite = true)
    }
}
