/**
 * Screenshot upload to Cloudflare R2 (S3-compatible).
 *
 * Why R2:
 *   - R2 has zero egress fees, which matters because screenshot URLs are
 *     embedded in reports and viewed many times per scan.
 *   - It speaks the S3 wire protocol, so `@aws-sdk/client-s3` works as-is
 *     with a custom `endpoint` — no R2-specific client library needed.
 *
 * Design guarantees:
 *   1. A scan must NEVER fail because of a screenshot issue. Every upload
 *      path returns `null` on any error (missing config, size cap breach,
 *      network failure, 4xx/5xx from R2) instead of throwing.
 *   2. The feature is env-gated. Without the five R2_* vars + a public URL,
 *      uploads are skipped and `null` is returned. This keeps local dev
 *      and staging deployments cost-free.
 *   3. Uploads are size-capped at 5 MB. Viewport PNG screenshots are
 *      typically 100–500 KB, so the cap only trips on anomalies (e.g. a
 *      page that somehow produced a massive full-page screenshot).
 *   4. The S3 client is constructed lazily per-call. Construction is a
 *      few-ms no-op (no network), and not caching avoids a hidden global
 *      that would have to be reset between tests.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/** Hard cap on upload size. Viewport PNGs are ~100–500 KB typically. */
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

/** `image/png` — Playwright's default when `type` is unspecified or `png`. */
const SCREENSHOT_CONTENT_TYPE = "image/png";

/**
 * R2 connection config. All five fields are required for uploads to work:
 * a missing field means uploads are silently skipped.
 *
 * `publicUrl` is the base URL the uploaded objects are publicly reachable
 * on — either a custom domain bound to the bucket (e.g.
 * `https://screenshots.accesskit.app`) or R2's dev subdomain
 * (`https://pub-<hash>.r2.dev`). Without it, the uploaded object would
 * live behind the S3 API endpoint, which requires signed requests to
 * read and is therefore useless for embedding in reports.
 */
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

/**
 * Build a stable, filesystem-safe object key for a page screenshot.
 *
 * Format: `scans/{scanId}/{slug}-{timestamp}.png`
 *
 * - `scanId` prefix lets us bulk-delete all screenshots when a scan is
 *   purged (data retention), and makes Cloudflare's per-prefix cache
 *   invalidation useful.
 * - Slug from the URL (path + hostname, non-alphanumerics stripped) makes
 *   keys humanly identifiable when browsing the bucket.
 * - Timestamp avoids collisions on re-scans of the same page.
 */
export function buildScreenshotKey(scanId: string, pageUrl: string): string {
  let slug = pageUrl;
  try {
    const parsed = new URL(pageUrl);
    slug = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // Non-URL input — fall through with the raw string.
  }
  const safeSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "page";
  return `scans/${scanId}/${safeSlug}-${Date.now()}.png`;
}

/**
 * Indicates whether the scanner is allowed to capture screenshots at all.
 * Captures are skipped when:
 *   - R2 isn't configured (no public URL to return), OR
 *   - The operator has explicitly opted out via `SCANNER_CAPTURE_SCREENSHOTS=false`.
 *
 * This is checked by the scanner before paying the ~1–2 s Playwright cost
 * to produce a buffer we'd only discard.
 */
export function screenshotsEnabled(): boolean {
  if (process.env.SCANNER_CAPTURE_SCREENSHOTS === "false") return false;
  return getR2Config() !== null;
}

/**
 * Upload a PNG screenshot buffer to Cloudflare R2 and return its public URL.
 * Returns `null` (never throws) on any failure so the caller can proceed
 * with a screenshot-less Page record.
 */
export async function uploadScreenshot(
  buffer: Buffer,
  key: string,
): Promise<string | null> {
  const config = getR2Config();
  if (!config) return null;

  if (buffer.length === 0 || buffer.length > MAX_SCREENSHOT_BYTES) {
    console.warn(
      `[screenshot] skipping upload for ${key}: buffer size ${buffer.length} outside [1, ${MAX_SCREENSHOT_BYTES}]`,
    );
    return null;
  }

  const client = new S3Client({
    // R2 is region-agnostic but the SDK requires a non-empty region string.
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: SCREENSHOT_CONTENT_TYPE,
        // Screenshots are immutable (each scan produces a new timestamped
        // key), so we can aggressively cache them at the Cloudflare edge.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    console.warn(
      `[screenshot] R2 upload failed for ${key}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    client.destroy();
  }

  return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
}
