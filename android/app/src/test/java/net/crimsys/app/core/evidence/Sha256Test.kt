package net.crimsys.app.core.evidence

import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Sha256Test {

    @Test
    fun `known vector - empty string`() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            Sha256.ofString(""),
        )
    }

    @Test
    fun `known vector - abc`() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            Sha256.ofString("abc"),
        )
    }

    @Test
    fun `output is always 64 lowercase hex chars`() {
        val hex = Sha256.ofString("سلسلة عهدة الأدلة")
        assertEquals(64, hex.length)
        assertTrue(hex.all { it in "0123456789abcdef" })
    }

    @Test
    fun `stream hashing matches byte hashing`() {
        val bytes = ByteArray(70_000) { (it % 251).toByte() } // spans buffer boundaries
        val viaStream = Sha256.ofStream(ByteArrayInputStream(bytes))
        val viaBytes = Sha256.ofBytes(bytes)
        assertEquals(viaBytes, viaStream)
    }

    @Test
    fun `matches is case-insensitive and length-sensitive`() {
        val a = Sha256.ofString("abc")
        assertTrue(Sha256.matches(a, a.uppercase()))
        assertFalse(Sha256.matches(a, a.dropLast(1)))
        assertFalse(Sha256.matches(a, Sha256.ofString("abd")))
    }
}
