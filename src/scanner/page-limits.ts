import type { Page, Route } from "playwright";
import { DEFAULT_LIMITS } from "@/lib/http-limits";

export interface PageResourceCapOptions {
  /** Hard cap on cumulative bytes downloaded across the whole page load. */
  maxPageBytes?: number;
  /** Hard cap on any single subresource. */
  maxResourceBytes?: number;
  /** Request timeout in ms for each individual subresource fetch. */
  perRequestTimeoutMs?: number;
}

export interface PageResourceCapHandle {
  /** Total bytes downloaded so far. */
  getBytes(): number;
  /** True once `maxPageBytes` was exceeded; further requests are aborted. */
  isExceeded(): boolean;
  /** Stops intercepting requests on the page. */
  dispose(): Promise<void>;
}

/**
 * Intercepts every network request issued by a Playwright `Page` and enforces
 * two size caps:
 *
 *   1. **Per-resource cap** — a single response advertising a
 *      `Content-Length` over `maxResourceBytes` is aborted before its body
 *      is transferred.
 *   2. **Per-page cap** — cumulative bytes across all resources fetched
 *      during the page load; once exceeded, every subsequent request is
 *      aborted immediately.
 *
 * The handle returned from this function lets the caller observe totals
 * (for logging) and must eventually be disposed to unregister the route.
 *
 * Callers should install the cap **before** calling `page.goto`. Any
 * requests already in flight are not retroactively intercepted.
 */
export async function applyPageResourceCap(
  page: Page,
  opts: PageResourceCapOptions = {},
): Promise<PageResourceCapHandle> {
  const maxPageBytes = opts.maxPageBytes ?? DEFAULT_LIMITS.PAGE_WEIGHT;
  const maxResourceBytes = opts.maxResourceBytes ?? DEFAULT_LIMITS.PAGE_SUBRESOURCE;
  const perRequestTimeoutMs = opts.perRequestTimeoutMs ?? 30_000;

  let totalBytes = 0;
  let exceeded = false;

  async function handler(route: Route) {
    if (exceeded) {
      return route.abort("failed").catch(() => {});
    }

    // Use route.fetch to honor cookies / redirects / auth, then inspect the
    // response headers before committing to downloading the body.
    let response;
    try {
      response = await route.fetch({ timeout: perRequestTimeoutMs });
    } catch {
      return route.abort("failed").catch(() => {});
    }

    const headers = response.headers();
    const contentLengthRaw = headers["content-length"];
    if (contentLengthRaw) {
      const parsed = Number.parseInt(contentLengthRaw, 10);
      if (Number.isFinite(parsed)) {
        if (parsed > maxResourceBytes) {
          return route.abort("failed").catch(() => {});
        }
        if (totalBytes + parsed > maxPageBytes) {
          exceeded = true;
          return route.abort("failed").catch(() => {});
        }
      }
    }

    // Content-Length is advisory; still measure the actual body.
    let body: Buffer;
    try {
      body = await response.body();
    } catch {
      return route.abort("failed").catch(() => {});
    }

    if (body.length > maxResourceBytes) {
      return route.abort("failed").catch(() => {});
    }

    if (totalBytes + body.length > maxPageBytes) {
      exceeded = true;
      return route.abort("failed").catch(() => {});
    }

    totalBytes += body.length;

    try {
      await route.fulfill({ response, body });
    } catch {
      // Page may have navigated away before fulfill landed — ignore.
    }
  }

  await page.route("**/*", handler);

  return {
    getBytes: () => totalBytes,
    isExceeded: () => exceeded,
    async dispose() {
      try {
        await page.unroute("**/*", handler);
      } catch {
        // page already closed — nothing to clean up
      }
    },
  };
}
