/**
 * Screenshot capture — uploads to Cloudflare R2.
 * Skipped during Phase 3 if R2 env vars are not set.
 * Returns null when R2 is not configured.
 */
export async function captureScreenshot(
  _pageUrl: string,
  _screenshotBuffer: Buffer,
  _filename: string,
): Promise<string | null> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretKey || !bucket) {
    return null; // R2 not configured yet
  }

  // TODO Phase 3+: implement S3-compatible upload to Cloudflare R2
  // using the @aws-sdk/client-s3 package
  return null;
}
