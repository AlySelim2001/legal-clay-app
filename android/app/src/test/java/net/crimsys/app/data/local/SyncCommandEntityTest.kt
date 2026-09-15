package net.crimsys.app.data.local

import java.time.Instant
import java.util.UUID
import net.crimsys.app.domain.sync.CommandType
import net.crimsys.app.domain.sync.SyncCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * Round-trip coverage for the command ↔ row extensions. The adopted entity
 * is a pure data shape; the mapping lives in [SyncCommandEntityMappers.kt],
 * and these tests pin the field mapping, lifecycle defaults, and the loud
 * failure on a legacy/foreign enum value (the closed-vocabulary rule).
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

    private fun entity(command: SyncCommand = command()): SyncCommandEntity =
        SyncCommandEntity(
            commandId = command.commandId.toString(),
            schemaVersion = command.schemaVersion,
            aggregateId = command.aggregateId.toString(),
            type = command.type.name,
            payloadJson = command.payloadJson,
            createdAtEpochMillis = command.createdAt.toEpochMilli(),
            attemptCount = command.attemptCount,
            nextAttemptAtEpochMillis = null,
            status = SyncCommandStatus.PENDING,
            lastError = null,
        )

    @Test
    fun `round-trips through the flat row`() {
        val original = command()
        assertEquals(original, entity(original).toCommand())
    }

    @Test
    fun `attemptCount survives persistence and re-persisting`() {
        val attempted = command(attemptCount = 2)
        assertEquals(attempted, entity(attempted).toCommand())
    }

    @Test
    fun `fresh mapping defers to the queue with due-now null marker and clean status`() {
        val row = command().toEntity()
        assertNull(row.nextAttemptAtEpochMillis)
        assertEquals(SyncCommandStatus.PENDING, row.status)
        assertNull(row.lastError)
    }

    @Test
    fun `commandId is the row identity`() {
        val row = entity()
        assertEquals(row.commandId, row.toCommand().commandId.toString())
    }

    @Test
    fun `unknown CommandType name fails loudly instead of mis-routing`() {
        val row = entity(command(type = CommandType.CREATE_CASE))
            .copy(type = "NOT_A_REAL_TYPE")
        assertThrows(IllegalArgumentException::class.java) { row.toCommand() }
    }
}
