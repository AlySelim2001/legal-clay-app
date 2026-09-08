# --- Kotlinx coroutines ---
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# --- Firestore / Firebase ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# --- SQLCipher ---
-keep class net.sqlcipher.** { *; }
-dontwarn net.sqlcipher.**

# --- Room entities (reflection via converters) ---
-keep class com.legalsys.crimsys.data.local.entity.** { *; }
