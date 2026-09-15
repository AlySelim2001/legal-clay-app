package net.crimsys.app.data.local

import java.util.UUID
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant

/**
 * Round-trip coverage for the flat command ↔ entity mappers. The old JSON
 * envelope codec is gone — [SyncCommandEntity] IS the storage form now, so
 * these tests pin the field mapping, the attemptCount symmetry, and the
 * loud failure on a legacy/foreign enum value (the closed-vocabulary rule).
 */
class SyncCommandEntityTest {

    private fun command(
        type: CommandType = CommandType.CREATE_EVIDENCE,
        attemptCount: Int = 0,
    ): SyncCommand =
        SyncCommand(
            commandId = UUID.fromString("11111111-1111-1111-1111-111111111111"),
            schemaVersion = 1,
            aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222"),
            type = type,
            payloadJson = "{\"evidenceId\":\"x\"}",
            createdAt = Instant.ofEpochMilli(1_700L),
            attemptCount = attemptCount,
        )

    @Test
    fun `round-trips through the flat row`() {
        val original = command()
        val decoded = SyncCommandEntity.fromCommand(original).toCommand()
        assertEquals(original, decoded)
    }

    @Test
    fun `attemptCount survives persistence and re-persisting`() {
        val attempted = command(attemptCount = 2)
        val entity = SyncCommandEntity.fromCommand(attempted)
        assertEquals(2, entity.attemptCount)
        assertEquals(attempted, entity.toCommand())
    }

    @Test
    fun `defaults a fresh row to PENDING with full retry budget`() {
        val entity = SyncCommandEntity.fromCommand(command())
        assertEquals(SyncCommandStatus.PENDING, entity.status)
        assertEquals(0, entity.attemptCount)
        assertEquals(3, entity.maxRetries)
    }

    @Test
    fun `unknown CommandType name fails loudly instead of mis-routing`() {
        val entity = SyncCommandEntity.fromCommand(command(type = CommandType.CREATE_CASE))
            .copy(type = "NOT_A_REAL_TYPE")
        assertThrows(IllegalArgumentException::class.java) { entity.toCommand() }
    }
}
