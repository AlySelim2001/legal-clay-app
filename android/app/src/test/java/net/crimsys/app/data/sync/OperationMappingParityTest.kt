package net.crimsys.app.data.sync

import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.domain.sync.CommandType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Operation-mapping parity (P1-A §4): every legacy offline action type must
 * have an EXACT typed [CommandType] equivalent — no catch-all "UNKNOWN"
 * fallback may hide an architectural gap.
 *
 * The mapping is exhaustive in both directions:
 *
 *   Legacy OfflineActionType      →  CommandType
 *   ─────────────────────────────────────────────────
 *   CREATE_CASE                   →  CREATE_CASE
 *   UPDATE_MEMO                   →  UPDATE_MEMO
 *   CREATE_HEARING                →  CREATE_HEARING
 *
 *   CREATE_EVIDENCE (typed-only)  →  new capability, no legacy equivalent;
 *                                    no legacy producer exists for it, so it
 *                                    is outside the parity surface.
 *
 * If a legacy operation is added without a typed counterpart, this test
 * FAILS and blocks the migration — by design (spec §4).
 */
class OperationMappingParityTest {

    /** The complete legacy → typed mapping, asserted element by element. */
    private val legacyToTyped: Map<String, CommandType> = mapOf(
        OfflineActionType.CREATE_CASE to CommandType.CREATE_CASE,
        OfflineActionType.UPDATE_MEMO to CommandType.UPDATE_MEMO,
        OfflineActionType.CREATE_HEARING to CommandType.CREATE_HEARING,
    )

    @Test
    fun `every legacy operation has an exact typed counterpart`() {
        val legacyTypes = OfflineActionType::class
            .java
            .declaredFields
            .filter { it.type == String::class.java && !it.isSynthetic }
            .map { it.get(null) as String }

        assertTrue("legacy operation inventory must not be empty", legacyTypes.isNotEmpty())

        val gaps = legacyTypes.filter { it !in legacyToTyped }
        assertEquals(
            "UNMAPPED LEGACY OPERATIONS — add an explicit CommandType before migration (no UNKNOWN fallback): " +
                gaps.joinToString(", "),
            emptyList(),
            gaps,
        )
    }

    @Test
    fun `every typed counterpart is a real CommandType member`() {
        val typedMembers = CommandType.entries.map { it.name }
        legacyToTyped.forEach { (legacy, typed) ->
            assertTrue(
                "mapping $legacy → $typed references a non-existent CommandType",
                typed.name in typedMembers,
            )
        }
    }

    @Test
    fun `mapping is injective - no two legacy operations collapse into one type`() {
        assertEquals(
            legacyToTyped.size,
            legacyToTyped.values.toSet().size,
        )
    }

    @Test
    fun `typed queue adds CREATE_EVIDENCE without disturbing the parity surface`() {
        // Documented, deliberate asymmetry: the typed vocabulary is a strict
        // superset. CREATE_EVIDENCE has no legacy producer (evidence never
        // traversed the offline queue) and therefore imposes no parity
        // obligation — but its presence must never be used to satisfy a
        // legacy-mapping gap.
        assertEquals(
            legacyToTyped.values.toSet() + CommandType.CREATE_EVIDENCE.name,
            CommandType.entries.map { it.name }.toSet(),
        )
    }
}
