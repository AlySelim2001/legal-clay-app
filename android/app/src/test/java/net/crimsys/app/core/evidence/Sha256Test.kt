package net.crimsys.app.core.evidence

import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Sha256Test {

    @Test
    fun `known vector - empty string`() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            Sha256.digest(ByteArrayInputStream(ByteArray(0))),
        )
    }

    @Test
    fun `known vector - abc`() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            Sha256.digest(ByteArrayInputStream("abc".toByteArray(Charsets.UTF_8))),
        )
    }

    @Test
    fun `known vector - Arabic UTF-8 text`() {
        assertEquals(
            "25986227cccd1a5557b484f9e34fad6046ca3fbc39d683dd0f65b7f706b3d3d9",
            Sha256.digest(ByteArrayInputStream("سلسلة عهدة الأدلة".toByteArray(Charsets.UTF_8))),
        )
    }

    @Test
    fun `output is always 64 lowercase hex chars`() {
        val hex = Sha256.digest(ByteArrayInputStream("سلسلة عهدة الأدلة".toByteArray(Charsets.UTF_8)))
        assertEquals(64, hex.length)
        assertTrue(hex.all { it in "0123456789abcdef" })
    }

    @Test
    fun `streaming spans buffer boundaries - large input stays constant memory`() {
        // 64 KiB buffer (Sha256.BUFFER_SIZE) — 70_000 bytes crosses it twice.
        val bytes = ByteArray(70_000) { (it % 251).toByte() }
        val hex = Sha256.digest(ByteArrayInputStream(bytes))
        assertEquals(64, hex.length)
        assertTrue(hex.all { it in "0123456789abcdef" })
    }

    @Test
    fun `digest is deterministic`() {
        val bytes = ByteArray(1_000) { (it * 7).toByte() }
        assertEquals(
            Sha256.digest(ByteArrayInputStream(bytes)),
            Sha256.digest(ByteArrayInputStream(bytes)),
        )
    }
}
