/**
 * Size-capped HTTP helpers.
 *
 * Every outbound fetch that reads a remote body into memory must go through
 * one of these helpers. A hostile (or accidentally gigantic) response will
 * otherwise OOM the worker, especially the scanner / crawler paths.
 *
 * - `readBodyCapped` streams a `Response` body and aborts after `maxBytes`.
 * - `fetchWithSizeLimit` combines `fetch` + `AbortSignal.timeout` + the
 *   capped reader into a single call with sensible defaults.
 * - `DEFAULT_LIMITS` exposes the per-caller budgets so sitemap / robots /
 *   verification / page-weight limits stay consistent across the codebase.
 */

export const DEFAULT_LIMITS = {
  /** robots.txt — plaintext file; Google enforces a 500 KB cap. */
  ROBOTS_TXT: 512 * 1024,
  /** sitemap.xml — real-world large sitemaps run ~10 MB; cap at 10 MB. */
  SITEMAP_XML: 10 * 1024 * 1024,
  /** Verification fetch (meta-tag / well-known file). 512 KB is plenty. */
  VERIFICATION: 512 * 1024,
  /** A single scanned page's total download weight (HTML + JS + CSS + media). */
  PAGE_WEIGHT: 15 * 1024 * 1024,
  /** Hard cap on any single subresource inside a scanned page. */
  PAGE_SUBRESOURCE: 10 * 1024 * 1024,
} as const;

export class ResponseTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Response exceeded ${maxBytes} byte cap`);
    this.name = "ResponseTooLargeError";
  }
}

export interface ReadBodyCappedResult {
  body: string;
  truncated: boolean;
  bytesRead: number;
}

/**
 * Streams a `Response` body into a string, aborting after `maxBytes`.
 *
 * Returns the decoded prefix plus a `truncated` flag. Honors `Content-Length`
 * as a fast-path when the server advertises a too-large body.
 */
export async function readBodyCapped(
  res: Response,
  maxBytes: number,
): Promise<ReadBodyCappedResult> {
  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      // Drain without buffering the whole thing.
      res.body?.cancel().catch(() => {});
      return { body: "", truncated: true, bytesRead: 0 };
    }
  }

  const reader = res.body?.getReader();
  if (!reader) return { body: "", truncated: false, bytesRead: 0 };

  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      const remaining = maxBytes - received;
      if (value.length > remaining) {
        // Keep the portion that still fits, then abort.
        if (remaining > 0) {
          chunks.push(value.subarray(0, remaining));
          received += remaining;
        }
        truncated = true;
        reader.cancel().catch(() => {});
        break;
      }

      received += value.length;
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // releaseLock throws if the reader was already canceled — harmless.
    }
  }

  const buf = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) {
    buf.set(c, pos);
    pos += c.length;
  }
  return { body: new TextDecoder().decode(buf), truncated, bytesRead: received };
}

export interface FetchWithSizeLimitOptions extends RequestInit {
  /** Max body size in bytes. Required. */
  maxBytes: number;
  /** Request timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
  /** Throw `ResponseTooLargeError` when body exceeds `maxBytes`. */
  throwOnOverflow?: boolean;
}

export interface FetchWithSizeLimitResult {
  response: Response;
  body: string;
  truncated: boolean;
  bytesRead: number;
}

/**
 * `fetch` wrapper that combines a timeout, a body-size cap, and a decoded
 * string result. Returns `null` on network / timeout failures so call sites
 * can `if (!result) continue;` without a separate try/catch.
 */
export async function fetchWithSizeLimit(
  url: string,
  opts: FetchWithSizeLimitOptions,
): Promise<FetchWithSizeLimitResult | null> {
  const { maxBytes, timeoutMs = 10_000, throwOnOverflow, ...init } = opts;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    response.body?.cancel().catch(() => {});
    return { response, body: "", truncated: false, bytesRead: 0 };
  }

  const { body, truncated, bytesRead } = await readBodyCapped(response, maxBytes);

  if (truncated && throwOnOverflow) {
    throw new ResponseTooLargeError(maxBytes);
  }

  return { response, body, truncated, bytesRead };
}
