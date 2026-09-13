package net.crimsys.app.core

/**
 * UI-state wrapper for one-shot async work (screen loads, evidence scans,
 * registry seeding). Complements [Result]: [Result] answers "did the operation
 * succeed?" while [Resource] answers "what should the screen render right now?".
 *
 * ```kotlin
 * when (val r = state) {
 *     is Resource.Loading    -> ClaySpinner()
 *     is Resource.Success    -> EvidenceList(r.data)
 *     is Resource.Error      -> ClayErrorBanner(r.error) // Arabic message from AppError
 * }
 * ```
 *
 * Legal-data rule: [Error] carries an [AppError] only — never a raw throwable
 * message, which may embed case content (see [AppError.Unknown]).
 */
sealed interface Resource<out T> {
    data object Loading : Resource<Nothing>
    data class Success<T>(val data: T) : Resource<T>
    data class Error(val error: AppError) : Resource<Nothing>

    companion object {
        /** Maps a [Result] straight into terminal UI state. */
        fun <T> from(result: Result<T>): Resource<T> =
            when (result) {
                is Result.Success -> Success(result.data)
                is Result.Error -> Error(result.error)
            }
    }
}

/** Non-suspending transform for the success branch. */
inline fun <T, R> Resource<T>.map(transform: (T) -> R): Resource<R> =
    when (this) {
        is Resource.Loading -> Resource.Loading
        is Resource.Success -> Resource.Success(transform(data))
        is Resource.Error -> this
    }

/** Data may be null while keeping the terminal-success distinction. */
inline fun <T, R> Resource<T>.mapNullable(transform: (T) -> R?): Resource<R?> =
    when (this) {
        is Resource.Loading -> Resource.Loading
        is Resource.Success -> Resource.Success(transform(data))
        is Resource.Error -> this
    }
