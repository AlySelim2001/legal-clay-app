package net.crimsys.app.domain.sync

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.evidence.Sha256
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncCommandCodecTest {

    @Test
    fun `create computes the payload digest`() {
        val command = SyncCommand.create("EVIDENCE_APPEND_EVENT", "{\"evidenceId\":\"x\"}", 1_700L)
        assertEquals(Sha256.ofString("{\"evidenceId\":\"x\"}"), command.payloadSha256)
        assertTrue(command.uuid.isNotBlank())
    }

    @Test
    fun `round-trips through the envelope`() {
        val command =
            SyncCommand.create(SyncCommand.Type.LEGAL_ATTEST_REQUEST, "{\"lawName\":\"قانون 150\",\"article\":\"40\"}", 1_700L)
        val decoded = SyncCommand.Codec.fromJson(SyncCommand.Codec.toJson(command))
        assertEquals(command, decoded)
    }

    @Test
    fun `malformed input returns null instead of crashing the drain`() {
        assertNull(SyncCommand.Codec.fromJson("not json at all"))
        assertNull(SyncCommand.Codec.fromJson("[1,2,3]"))
        assertNull(SyncCommand.Codec.fromJson("{}")) // missing payload
        assertNull(SyncCommand.Codec.fromJson("{\"payload\":123}")) // payload must be a string
    }

    @Test
    fun `missing digest falls back to recomputation - missing uuid is fatal`() {
        val envelope = buildJsonObject {
            put("type", "PENDING_LEGAL_QUERY")
            put("payload", "{\"q\":1}")
            put("createdAt", 1_700L)
        }.toString()
        val decoded = SyncCommand.Codec.fromJson(envelope)
        assertEquals(Sha256.ofString("{\"q\":1}"), decoded?.payloadSha256)

        val noUuid = buildJsonObject {
            put("type", "PENDING_LEGAL_QUERY")
            put("payload", "{\"q\":1}")
        }.toString()
        assertNull(SyncCommand.Codec.fromJson(noUuid))
    }

    @Test
    fun `unknown envelope keys are ignored - forward compatible`() {
        val command = SyncCommand.create("PENDING_LEGAL_QUERY", "{\"q\":1}", 1_700L)
        val padded = SyncCommand.Codec.toJson(command).replace("}", ",\"futureField\":true}")
        val decoded = SyncCommand.Codec.fromJson(padded)
        assertEquals(command, decoded)
    }
}
