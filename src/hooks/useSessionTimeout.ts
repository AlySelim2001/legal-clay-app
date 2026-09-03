import { useEffect, useCallback, useRef } from "react";

/**
 * Session Timeout Hook
 *
 * Monitors user activity (mouse, keyboard, touch, scroll) and triggers a
 * callback after `timeoutMs` of inactivity.  Designed for legal applications
 * where an unattended device could expose sensitive case data.
 *
 * Default: 15 minutes — configurable via props.
 *
 * @example
 * ```tsx
 * useSessionTimeout({
 *   timeoutMs: 15 * 60 * 1000,
 *   onTimeout: () => {
 *     // Sign out user, clear sensitive state
 *     supabase.auth.signOut();
 *   },
 * });
 * ```
 */

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

interface UseSessionTimeoutOptions {
  /** Timeout in milliseconds. Default: 15 minutes (900,000 ms). */
  timeoutMs?: number;
  /** Callback invoked when the session times out. */
  onTimeout: () => void;
  /** Whether the timeout is active. Default: true. */
  enabled?: boolean;
}

export function useSessionTimeout({
  timeoutMs = 15 * 60 * 1000,
  onTimeout,
  enabled = true,
}: UseSessionTimeoutOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled) {
      timerRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, timeoutMs);
    }
  }, [timeoutMs, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Start the initial timer
    resetTimer();

    // Attach activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [enabled, resetTimer]);
}
