package net.crimsys.app.core.evidence

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent

object ChainEventHasher {

    fun create(
        action: ChainAction,
        timestampEpochMillis: Long,
        previousHash: String?,
        contentHash: String,
    ): ChainEvent {

        val canonical =
            buildString {
                append(action.name)
                append('|')
                append(timestampEpochMillis)
                append('|')
                append(previousHash.orEmpty())
                append('|')
                append(contentHash)
            }

        return ChainEvent(
            action = action,
            timestampEpochMillis =
                timestampEpochMillis,
            previousHash = previousHash,
            currentHash = sha256(canonical),
        )
    }

    private fun sha256(
        value: String,
    ): String =
        MessageDigest
            .getInstance("SHA-256")
            .digest(
                value.toByteArray(
                    StandardCharsets.UTF_8,
                ),
            )
            .joinToString("") {
                "%02x".format(it)
            }
}
