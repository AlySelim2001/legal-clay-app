/**
 * Client-Side Rate Limiter (Token Bucket Algorithm)
 *
 * Prevents abuse of Supabase queries and AI agent calls
 * from the browser. Server-side RLS is the primary guard;
 * this is a secondary UX safeguard.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/**
 * Try to consume a token from the named bucket.
 * Returns true if allowed, false if rate-limited.
 */
export function tryConsume(
  key: string,
  maxTokens: number = 30,
  refillIntervalMs: number = 60_000,
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillCount = Math.floor(elapsed / refillIntervalMs) * maxTokens;
  if (refillCount > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refillCount);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) return false;

  bucket.tokens -= 1;
  return true;
}

/**
 * Check if a key is rate-limited (without consuming).
 */
export function isRateLimited(key: string): boolean {
  const bucket = buckets.get(key);
  return bucket ? bucket.tokens <= 0 : false;
}

/**
 * Reset a specific bucket.
 */
export function resetBucket(key: string): void {
  buckets.delete(key);
}

/**
 * Clear all buckets.
 */
export function clearAllBuckets(): void {
  buckets.clear();
}
