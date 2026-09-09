# ============================================================================
# CRIM-SYS 2026 — R8 / ProGuard configuration (release)
#
# Purpose of every block below: R8 renames and removes classes it thinks are
# unused. Anything reached ONLY through reflection (JNI, DI frameworks,
# annotation processors, serialization) is invisible to static analysis and
# MUST be kept explicitly — otherwise the app compiles fine and crashes in
# production with ClassNotFoundException / NoSuchMethodError.
#
# We keep SourceFile + LineNumberTable so stack traces can be de-obfuscated
# with the per-build mapping.txt (app/build/outputs/mapping/release/).
# ============================================================================

# --- Readable crash reports -------------------------------------------------
# Keeps line numbers so Play Console / Crashlytics can map obfuscated traces.
# WARNING: mapping.txt is per-build and unique — archive it for every release
# or crash reports become useless.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,InnerClasses,Signature,EnclosingMethod

# --- Strip verbose logging from release bytecode ----------------------------
# R8 removes these calls entirely (smaller APK, no log leaks).
# Log.w/e are kept on purpose: SyncManager prints push failures that support
# needs to see on field devices.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
}

# --- Kotlin metadata ---------------------------------------------------------
# Required by kotlinx.serialization and libraries that read @Metadata
# reflectively. Removing this breaks serialization of OfflineAction payloads.
-keep class kotlin.Metadata { *; }

# --- kotlinx.serialization ---------------------------------------------------
# Serializers are generated as Companion/serializer() members and resolved
# via reflection at runtime. Without these rules the offline action queue
# fails with "Serializer for class X is not found".
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault
-keep,includedescriptorclasses class net.crimsys.app.**$$serializer { *; }
-keepclassmembers class net.crimsys.app.** {
    *** Companion;
}
-keepclasseswithmembers class net.crimsys.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# JSON tree types are built dynamically (JsonObject/JsonPrimitive DSL)
-keep class kotlinx.serialization.json.JsonObject { *; }
-keep class kotlinx.serialization.json.JsonPrimitive { *; }
-keep class kotlinx.serialization.json.JsonNull { *; }

# --- Room --------------------------------------------------------------------
# Room generates <Database>_Impl classes it instantiates by reflection, and
# validates entity/DAO names against the annotated sources. The whole
# data.local package is kept (entities + DAOs + generated impl) — it is small
# and is the app's core.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep @androidx.room.Entity class * { *; }
-keep @androidx.room.Dao interface * { *; }
-keep @androidx.room.TypeConverter class * { *; }
-keep class net.crimsys.app.data.local.** { *; }
-dontwarn androidx.room.paging.**

# --- SQLCipher ---------------------------------------------------------------
# Native code (libsqlcipher.so) calls back into these Java classes via JNI;
# renaming them crashes the process on first database open.
-keep class net.zetetic.database.** { *; }
-keep class net.zetetic.database.sqlcipher.** { *; }
-dontwarn net.zetetic.database.**

# --- Hilt / Dagger -----------------------------------------------------------
# Hilt ships consumer keep rules; these cover the remaining reflective bits.
-dontwarn com.google.errorprone.annotations.**
-keep class javax.inject.** { *; }
-keep class dagger.Lazy { *; }

# --- Firebase ----------------------------------------------------------------
# Firestore's POJO mapping and GMS internals use reflection; consumer rules
# cover most of it, these keep the rest.
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- Coroutines ---------------------------------------------------------------
# Debug probing uses reflection on volatile fields; keep them stable.
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.debug.**

# --- Compose-rich-editor ------------------------------------------------------
# HTML round-trip touches model classes dynamically.
-keep class com.mohamedrejeb.richeditor.model.** { *; }

# --- Third-party annotations only present in class files ----------------------
-dontwarn org.jetbrains.annotations.**
-dontwarn javax.annotation.**

# ============================================================================
# IF ON-DEVICE ARABIC OCR (ML Kit) IS RE-ENABLED, UNCOMMENT:
# (Models are loaded from assets by class name; shrinking breaks loading.)
#
# -keep class com.google.mlkit.vision.text.** { *; }
# -keep class com.google.android.gms.internal.mlkit_vision_text.** { *; }
# -dontwarn com.google.mlkit.**
# ============================================================================
