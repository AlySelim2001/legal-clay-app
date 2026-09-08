# --- Kotlinx coroutines ---
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# --- Firestore / Firebase ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# --- SQLCipher (sqlcipher-android) ---
-keep class net.zetetic.database.** { *; }
-dontwarn net.zetetic.database.**

# --- Room entities ---
-keep class net.crimsys.app.data.local.** { *; }
