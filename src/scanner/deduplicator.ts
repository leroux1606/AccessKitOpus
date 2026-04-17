import { createHash } from "crypto";

/**
 * Generates a stable fingerprint for a violation.
 * Same rule + same selector on the same website = same issue across scans.
 */
export function generateFingerprint(
  ruleId: string,
  cssSelector: string,
  websiteUrl: string,
): string {
  const origin = new URL(websiteUrl).origin;
  const input = `${ruleId}:${cssSelector}:${origin}`;
  return createHash("sha256").update(input).digest("hex");
}
