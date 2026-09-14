package net.crimsys.app.core.evidence

import java.io.InputStream
import java.security.MessageDigest

object Sha256 {

    private const val BUFFER_SIZE = 64 * 1024

    fun digest(
        input: InputStream,
    ): String {

        val digest =
            MessageDigest.getInstance("SHA-256")

        val buffer = ByteArray(BUFFER_SIZE)

        while (true) {

            val read = input.read(buffer)

            if (read < 0) break

            if (read == 0) continue

            digest.update(
                buffer,
                0,
                read,
            )
        }

        return digest.digest().toHex()
    }

    private fun ByteArray.toHex(): String =
        joinToString("") {
            "%02x".format(it)
        }
}
