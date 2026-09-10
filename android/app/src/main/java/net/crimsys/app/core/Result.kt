package net.crimsys.app.core

/** Domain failure reasons surfaced to the UI. */
sealed interface AppError {
    data object NetworkOffline : AppError
    data object RemoteUnavailable : AppError
    data class Validation(val message: String) : AppError

    /**
     * Unmapped failure. Carries the original [cause] so a future Crashlytics
     * sink can report the real stack trace instead of an empty unknown.
     * Do NOT log [cause] to Logcat: for legal work it may embed case data.
     */
    data class Unknown(val cause: Throwable? = null) : AppError
}

/**
 * Mandatory pattern for every repository/use-case return per project spec.
 *
 * ```kotlin
 * when (val r = useCase()) {
 *     is Result.Success -> render(r.data)
 *     is Result.Error   -> showError(r.error)
 * }
 * ```
 */
sealed interface Result<out T> {
    data class Success<T>(val data: T) : Result<T>
    data class Error(val error: AppError) : Result<Nothing>
}

/**
 * Run [block] mapping any throwable into [Result.Error]([AppError.Unknown]).
 *
 * R3 remediation: `kotlinx.coroutines.CancellationException` is control flow,
 * not a failure — swallowing it breaks structured concurrency (a cancelled
 * `drainQueue()` or `viewModelScope` job would keep "running" and could then
 * complete stale work). Re-throw it immediately and only wrap genuine
 * failures. Never call `runCatching { }` on suspending code; always use this.
 */
inline fun <T> runCatchingResult(block: () -> T): Result<T> =
    try {
        Result.Success(block())
    } catch (ce: kotlinx.coroutines.CancellationException) {
        throw ce // MUST propagate — cancellation is not an AppError.
    } catch (t: Throwable) {
        Result.Error(AppError.Unknown(t))
    }
