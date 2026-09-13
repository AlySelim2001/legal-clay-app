package net.crimsys.app.core.evidence

import java.io.InputStream
import java.security.MessageDigest

/**
 * SHA-256 helpers for the evidence chain of custody.
 *
 * Pure `java.security` — no third-party crypto. `ofStream` hashes in constant
 * memory so multi-hundred-MB case recordings never load into the heap.
 *
 * Every hex string produced here is lowercase (64 chars). Stored on the
 * evidence row and inside the chain of custody; the upstream hash record in
 * Firestore is what makes a tampered local copy detectable.
 */
object Sha256 {

    private const val ALGORITHM = "SHA-256"
    private val HEX = "0123456789abcdef".toCharArray()

    fun ofBytes(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance(ALGORITHM).digest(bytes)
        return digest.toHex()
    }

    fun ofString(text: String): String = ofBytes(text.toByteArray(Charsets.UTF_8))

    /**
     * Streams [input] through the digest without closing it — the caller owns
     * the stream (`use { Sha256.ofStream(it) }` at the call site).
     */
    fun ofStream(input: InputStream, bufferSize: Int = DEFAULT_BUFFER_SIZE): String {
        val md = MessageDigest.getInstance(ALGORITHM)
        val buffer = ByteArray(bufferSize)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (read > 0) md.update(buffer, 0, read)
        }
        return md.digest().toHex()
    }

    /** Constant-shape equality (length-normalized, case-insensitive). */
    fun matches(expectedHex: String, actualHex: String): Boolean =
        expectedHex.length == actualHex.length && expectedHex.equals(actualHex, ignoreCase = true)

    private fun ByteArray.toHex(): String {
        val sb = StringBuilder(size * 2)
        for (b in this) {
            val i = b.toInt() and 0xFF
            sb.append(HEX[i ushr 4]).append(HEX[i and 0x0F])
        }
        return sb.toString()
    }
}
