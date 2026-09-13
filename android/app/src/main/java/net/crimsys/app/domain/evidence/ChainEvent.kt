package net.crimsys.app.domain.evidence

import kotlinx.serialization.Serializable

@Serializable
enum class ChainAction {
    CAPTURED,
    OCR_PROCESSED,
    EXPORTED,
}

@Serializable
data class ChainEvent(
    val action: ChainAction,
    val timestampEpochMillis: Long,
    val previousHash: String?,
    val currentHash: String,
)
