package net.crimsys.app.core

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Injectable time sources.
 *
 * Why not `System.currentTimeMillis()` inline everywhere:
 *  - Tests need deterministic time (chain events, retention cutoffs).
 *  - The two clocks have DIFFERENT trust levels and must never be confused:
 *
 *  [WallClock] — the user-settable device clock. Human-meaningful. Used for
 *  display, retention cutoffs, and chain-event timestamps. A lawyer's device
 *  clock CAN be wrong or deliberately altered; the evidence chain therefore
 *  never relies on it for ordering (insertion order does that) — timestamps
 *  are recorded for humans, not trusted for integrity.
 *
 *  [MonotonicClock] — `System.nanoTime()`, stops only at reboot. Used to
 *  measure elapsed durations (scan timing, drain latency). NEVER use it as a
 *  wall-clock timestamp: its epoch is arbitrary.
 */
fun interface WallClock {
    /** Current wall-clock epoch milliseconds. */
    fun nowMillis(): Long
}

fun interface MonotonicClock {
    /** Monotonic elapsed nanoseconds since an arbitrary epoch (reboot). */
    fun elapsedNanos(): Long
}

@Module
@InstallIn(SingletonComponent::class)
object ClockModule {

    @Provides
    @Singleton
    fun provideWallClock(): WallClock = WallClock { System.currentTimeMillis() }

    @Provides
    @Singleton
    fun provideMonotonicClock(): MonotonicClock = MonotonicClock { System.nanoTime() }
}
