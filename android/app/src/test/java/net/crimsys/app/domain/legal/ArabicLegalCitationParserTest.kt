package net.crimsys.app.domain.legal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ArabicLegalCitationParserTest {

    private val parser = ArabicLegalCitationParser()

    @Test
    fun `parses article and law name with span`() {
        val text = "بناءً على قانون الإجراءات الجنائية رقم 150 لسنة 2020، المادة 40"
        val parsed = parser.parse(text)

        assertNotNull(parsed)
        parsed!!
        assertEquals("40", parsed.article)
        assertEquals("قانون الإجراءات الجنائية رقم 150 لسنة 2020", parsed.lawName)
        assertNull(parsed.paragraph)
        assertTrue(parsed.startIndex >= 0)
        assertTrue(parsed.endIndex > parsed.startIndex)
        assertEquals(text.substring(parsed.startIndex, parsed.endIndex).contains("المادة 40"), true)
    }

    @Test
    fun `normalizes Arabic-Indic digits`() {
        val parsed = parser.parse("المادة ٤٠")
        assertEquals("40", parsed?.article)
    }

    @Test
    fun `parses paragraph when numbered with digits`() {
        val parsed = parser.parse("قانون العقوبات، المادة 212 الفقرة 3")
        assertEquals("212", parsed?.article)
        assertEquals("3", parsed?.paragraph)
    }

    @Test
    fun `no article means no citation`() {
        assertNull(parser.parse("قانون الإجراءات الجنائية رقم 150 لسنة 2020"))
        assertNull(parser.parse("نص لا علاقة له بالقانون"))
        assertNull(parser.parse(""))
    }

    @Test
    fun `span indexes are valid for rendering`() {
        val text = "ووفقاً للمادة 212 من قانون العقوبات"
        val parsed = parser.parse(text)!!
        assertTrue(parsed.startIndex <= parsed.endIndex)
        assertTrue(parsed.endIndex <= text.length)
        // The matched span must contain the article phrase.
        assertTrue(text.substring(parsed.startIndex, parsed.endIndex).contains("المادة 212"))
    }
}
