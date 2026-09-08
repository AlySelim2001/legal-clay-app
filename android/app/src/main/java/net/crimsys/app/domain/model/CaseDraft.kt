package net.crimsys.app.domain.model

/** Validated intake payload for a new case. */
data class CaseDraft(
    val caseNumber: String,
    val courtName: String,
    val caseType: String,
    val memoHtml: String = "",
)
