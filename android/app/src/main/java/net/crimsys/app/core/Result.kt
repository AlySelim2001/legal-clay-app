package net.crimsys.app.core

/** Domain failure reasons surfaced to the UI. */
sealed interface AppError {
    data object NetworkOffline : AppError
    data object RemoteUnavailable : AppError
    data class Validation(val message: String) : AppError
    data object Unknown : AppError
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

/** Run [block] mapping any throwable into [AppError.Unknown]. */
inline fun <T> runCatchingResult(block: () -> T): Result<T> =
    try {
        Result.Success(block())
    } catch (t: Throwable) {
        Result.Error(AppError.Unknown)
    }
