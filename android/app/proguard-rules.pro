# CRIM-SYS 2026 — ProGuard/R8 rules

# --- Kotlin coroutines ---
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.coroutines.AnnotationsKt

# --- Room ---
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# --- SQLCipher ---
-keep class net.zetetic.database.** { *; }
-keep class net.sqlcipher.** { *; }
-dontwarn net.zetetic.database.**

# --- Hilt / Dagger ---
-dontwarn com.google.errorprone.annotations.**

# --- kotlinx.datetime / java.time used by calendar library (desugared not enabled; minSdk 26 has java.time) ---
-dontwarn java.time.**

# Keep compose-rich-editor model classes used with HTML serialization
-keep class com.mohamedrejeb.richeditor.model.** { *; }

# Keep debug line sources for readable crash reports (release keeps line numbers only)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
