# Legal Clay App — R8 rules.
# Flutter plugin AARs ship consumer rules; these cover the app's own surface.

# --- Crash on any missed class rather than silently misbehaving -------------
-dontwarn android.os.**

# --- flutter_secure_storage -------------------------------------------------
# Accesses via reflection into its own Kotlin classes; keep the public API.
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# --- SQLCipher (bundled by sqflite_sqlcipher) -------------------------------
-keep class net.sqlcipher.** { *; }
-keep class net.zetetic.database.** { *; }

# --- Never ship logs or verbose flags ---------------------------------------
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Strip debug line numbers but keep source metadata for honest crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
