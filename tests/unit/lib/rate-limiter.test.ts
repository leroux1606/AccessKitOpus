import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * Each test uses a unique key so the shared module-level store never
 * carries state from one test into another.
 */
let keySeq = 0;
const key = (label: string) => `test:${label}:${++keySeq}`;

describe("checkRateLimit", () => {
  // ─── First request ───────────────────────────────────────────────────────

  it("allows the first request and decrements remaining by 1", () => {
    const result = checkRateLimit(key("first"), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("returns resetInMs equal to the window for a fresh key", () => {
    const before = Date.now();
    const result = checkRateLimit(key("reset-fresh"), 5, 60_000);
    // resetInMs should be close to the full window
    expect(result.resetInMs).toBeGreaterThanOrEqual(59_900);
    expect(result.resetInMs).toBeLessThanOrEqual(60_000 + (Date.now() - before));
  });

  // ─── Counting within the window ──────────────────────────────────────────

  it("counts consecutive requests against the same key", () => {
    const k = key("counting");
    checkRateLimit(k, 3, 60_000); // 1st  → remaining 2
    const second = checkRateLimit(k, 3, 60_000); // 2nd  → remaining 1
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks once the limit is exhausted", () => {
    const k = key("exhaust");
    checkRateLimit(k, 2, 60_000); // 1st
    checkRateLimit(k, 2, 60_000); // 2nd — hits limit
    const third = checkRateLimit(k, 2, 60_000); // 3rd — blocked
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("keeps blocking on every subsequent call once blocked", () => {
    const k = key("keep-blocking");
    checkRateLimit(k, 1, 60_000);
    checkRateLimit(k, 1, 60_000);
    const result = checkRateLimit(k, 1, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  // ─── Limit of exactly 1 ──────────────────────────────────────────────────

  it("allows exactly one request when limit is 1", () => {
    const k = key("limit-1");
    expect(checkRateLimit(k, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(k, 1, 60_000).allowed).toBe(false);
  });

  // ─── Key independence ────────────────────────────────────────────────────

  it("tracks different keys independently", () => {
    const k1 = key("ind-a");
    const k2 = key("ind-b");

    // Exhaust k1
    checkRateLimit(k1, 1, 60_000);
    expect(checkRateLimit(k1, 1, 60_000).allowed).toBe(false);

    // k2 should still be allowed
    expect(checkRateLimit(k2, 1, 60_000).allowed).toBe(true);
  });

  // ─── Return shape ────────────────────────────────────────────────────────

  it("always returns { allowed, remaining, resetInMs } shape", () => {
    const result = checkRateLimit(key("shape"), 10, 60_000);
    expect(typeof result.allowed).toBe("boolean");
    expect(typeof result.remaining).toBe("number");
    expect(typeof result.resetInMs).toBe("number");
  });

  it("remaining is never negative", () => {
    const k = key("non-neg");
    for (let i = 0; i < 20; i++) checkRateLimit(k, 3, 60_000);
    const result = checkRateLimit(k, 3, 60_000);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });
});
