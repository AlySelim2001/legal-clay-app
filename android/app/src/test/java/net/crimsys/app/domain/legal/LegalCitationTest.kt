package net.crimsys.app.domain.legal

import org.junit.Assert.assertEquals
import org.junit.Test

class LegalCitationTest {

    @Test
    fun `articleKey is deterministic and trims whitespace`() {
        assertEquals(
            LegalCitation.articleKey("law-150-2020", "مادة ٤٠"),
            LegalCitation.articleKey(" law-150-2020 ", " مادة ٤٠ "),
        )
        assertEquals("law-150-2020#مادة ٤٠", LegalCitation.articleKey("law-150-2020", "مادة ٤٠"))
    }

    @Test
    fun `different references produce different keys`() {
        val a = LegalCitation.articleKey("law-150-2020", "مادة ٤٠")
        val b = LegalCitation.articleKey("law-150-2020", "مادة ٤١")
        org.junit.Assert.assertNotEquals(a, b)
    }
}
