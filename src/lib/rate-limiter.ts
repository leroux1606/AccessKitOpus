/**
 * In-memory sliding-window rate limiter.
 *
 * Works well for single-instance (dev, single container).
 * For multi-instance production deployments, replace `store` with
 * an Upstash Redis client using @upstash/ratelimit.
 */

interface RateWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateWindow>();

// Clean expired windows every minute to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of store) {
      if (now > w.resetAt) store.delete(key);
    }
  }, 60_000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the window resets */
  resetInMs: number;
}

/**
 * @param key     Unique identifier (e.g. "verify:{userId}", "scan:{websiteId}:{userId}")
 * @param limit   Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let w = store.get(key);

  if (!w || now > w.resetAt) {
    w = { count: 1, resetAt: now + windowMs };
    store.set(key, w);
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (w.count >= limit) {
    return { allowed: false, remaining: 0, resetInMs: w.resetAt - now };
  }

  w.count++;
  return { allowed: true, remaining: limit - w.count, resetInMs: w.resetAt - now };
}
