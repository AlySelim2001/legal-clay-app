package net.crimsys.app.domain.sync

interface SyncCommandExecutor {

    /**
     * commandId is the idempotency key.
     *
     * Replaying the same command after an ambiguous network failure
     * MUST NOT create a second logical mutation.
     */
    suspend fun execute(
        command: SyncCommand,
    ): SyncResult
}
