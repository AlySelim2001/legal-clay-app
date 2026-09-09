package net.crimsys.app.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

/** A newer published release on GitHub. */
data class UpdateInfo(
    val tagName: String,
    val releaseName: String,
    val htmlUrl: String,
)

/**
 * In-app update checker backed by the GitHub Releases API — the delivery
 * channel during closed beta, before any Play Store presence.
 *
 * Design notes:
 *  - Uses [HttpURLConnection] on purpose: zero new dependencies for a
 *    single read-only GET, keeps the APK lean (no OkHttp/Retrofit pull).
 *  - Read-only, sends no user data (privacy policy: "we collect nothing").
 *  - All failures map into the project-wide [Result]/[AppError] pattern so
 *    the UI can render a calm "check failed" state — an update check must
 *    never crash or block the screen.
 */
object UpdateChecker {

    /** Read-only endpoint of the repo's latest published (non-draft) release. */
    private const val RELEASES_URL =
        "https://api.github.com/repos/AlySelim2001/legal-clay-app/releases/latest"

    private const val CONNECT_TIMEOUT_MS = 8_000
    private const val READ_TIMEOUT_MS = 10_000

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * @param currentVersion the running [BuildConfig.VERSION_NAME], e.g. "2026.1.0"
     * @return [Result.Success] with `null` when already up to date, or the
     *         newer [UpdateInfo]; [Result.Error] on any network/parse failure.
     */
    suspend fun check(currentVersion: String): Result<UpdateInfo?> =
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL(RELEASES_URL).openConnection() as HttpURLConnection).apply {
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/vnd.github+json")
                    // API versioning keeps response shape stable over time.
                    setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
                }
                val code = conn.responseCode
                if (code !in 200..299) {
                    conn.disconnect()
                    return@withContext Result.Error(AppError.RemoteUnavailable)
                }

                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()

                val root = json.parseToJsonElement(body).jsonObject
                val tagName = root["tag_name"]?.jsonPrimitive?.content.orEmpty()
                val htmlUrl = root["html_url"]?.jsonPrimitive?.content.orEmpty()
                val name = root["name"]?.jsonPrimitive?.content ?: tagName
                if (tagName.isBlank() || htmlUrl.isBlank()) {
                    return@withContext Result.Error(AppError.Unknown)
                }

                // Compare "v2026.2.0" (tag) against "2026.1.0" (versionName).
                if (isNewer(stripTagPrefix(tagName), currentVersion)) {
                    Result.Success(UpdateInfo(tagName = tagName, releaseName = name, htmlUrl = htmlUrl))
                } else {
                    Result.Success(null)
                }
            } catch (e: java.io.IOException) {
                Result.Error(AppError.NetworkOffline)
            } catch (t: Throwable) {
                Result.Error(AppError.Unknown)
            }
        }

    private fun stripTagPrefix(tag: String): String = tag.removePrefix("v").removePrefix("V")

    /**
     * Numeric-aware comparison of dotted versions ("2026.2.0" > "2026.1.10").
     * Non-numeric segments (-beta2 suffixes) fall back to string comparison so
     * pre-releases never register as regressions.
     */
    internal fun isNewer(candidate: String, current: String): Boolean {
        val cParts = candidate.split('.').map { it.trim() }
        val kParts = current.split('.').map { it.trim() }
        val size = maxOf(cParts.size, kParts.size)
        for (i in 0 until size) {
            val c = cParts.getOrNull(i) ?: "0"
            val k = kParts.getOrNull(i) ?: "0"
            val cNum = c.toLongOrNull()
            val kNum = k.toLongOrNull()
            val cmp = when {
                cNum != null && kNum != null -> cNum.compareTo(kNum)
                else -> c.compareTo(k)
            }
            if (cmp != 0) return cmp > 0
        }
        return false
    }
}
