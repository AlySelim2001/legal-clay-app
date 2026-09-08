package net.crimsys.app.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Generates a random 256-bit database passphrase on first launch, encrypts it
 * with an Android Keystore key, and persists the ciphertext in app files.
 *
 * Why not store the raw passphrase in SharedPreferences? Because then a
 * rooted-device file dump yields the plaintext. Here the key never leaves
 * the secure hardware (when available), so the persisted blob alone is
 * useless without the device.
 *
 * Error handling: any Keystore failure (corrupted key, wiped TEE, ROM quirks)
 * throws [IllegalStateException] with a contextual message. Hilt surfaces the
 * crash at first DB access — intentional, because silently regenerating the
 * key would brick access to already-encrypted case data.
 */
@Singleton
class DatabasePassphraseProvider @Inject constructor(
    private val context: Context,
) {
    @Volatile
    private var cached: ByteArray? = null

    /** Returns the stable passphrase bytes; creates and persists them on first call. */
    fun getOrCreatePassphrase(): ByteArray {
        cached?.let { return it }
        synchronized(this) {
            cached?.let { return it }

            val prefs =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val stored = prefs.getString(KEY_CIPHERTEXT, null)

            val plaintext: ByteArray =
                if (stored == null) {
                    // First run: generate random key, encrypt via Keystore, persist blob.
                    val fresh = ByteArray(KEY_SIZE_BYTES).also { java.security.SecureRandom().nextBytes(it) }
                    prefs.edit().putString(KEY_CIPHERTEXT, encryptWithKeystore(fresh)).apply()
                    fresh
                } else {
                    decryptWithKeystore(stored)
                }

            cached = plaintext
            return plaintext
        }
    }

    private fun keystoreKey(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator =
            KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE,
            )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private fun encryptWithKeystore(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keystoreKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plain)
        // Layout: [ivLen: Int][iv][ciphertext], Base64-encoded.
        val out = ByteArray(INT_BYTES + iv.size + ciphertext.size)
        iv.size.toBytes().copyInto(out, 0)
        iv.copyInto(out, INT_BYTES)
        ciphertext.copyInto(out, INT_BYTES + iv.size)
        return android.util.Base64.encodeToString(out, android.util.Base64.NO_WRAP)
    }

    private fun decryptWithKeystore(blob: String): ByteArray {
        val data = android.util.Base64.decode(blob, android.util.Base64.NO_WRAP)
        val ivLen = data.bytesToInt(0)
        val iv = data.copyOfRange(INT_BYTES, INT_BYTES + ivLen)
        val ciphertext = data.copyOfRange(INT_BYTES + ivLen, data.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        return cipher.doFinal(ciphertext)
    }

    private companion object {
        const val PREFS_NAME = "crimsys_security"
        const val KEY_CIPHERTEXT = "db_passphrase_blob"
        const val KEY_ALIAS = "crimsys_db_key"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_SIZE_BYTES = 32
        const val GCM_TAG_BITS = 128
        const val INT_BYTES = 4

        fun Int.toBytes(): ByteArray =
            byteArrayOf(
                (this shr 24).toByte(),
                (this shr 16).toByte(),
                (this shr 8).toByte(),
                this.toByte(),
            )

        fun ByteArray.bytesToInt(offset: Int): Int =
            (this[offset].toInt() and 0xFF) shl 24 or
                ((this[offset + 1].toInt() and 0xFF) shl 16) or
                ((this[offset + 2].toInt() and 0xFF) shl 8) or
                (this[offset + 3].toInt() and 0xFF)
    }
}
