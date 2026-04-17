/**
 * SSRF (Server-Side Request Forgery) protection.
 * Blocks server-initiated requests to private/internal IP ranges, localhost,
 * and cloud metadata services before any outbound fetch is made.
 *
 * The async variant also resolves the hostname via DNS and checks each
 * returned IP against the same blocklist, defeating DNS-rebinding attacks
 * where a public-looking domain resolves to a private IP.
 */

import * as dns from "dns";

const PRIVATE_IP_PATTERNS = [
  /^127\./,                                        // 127.0.0.0/8 loopback
  /^10\./,                                         // 10.0.0.0/8 private
  /^172\.(1[6-9]|2\d|3[01])\./,                   // 172.16.0.0/12 private
  /^192\.168\./,                                   // 192.168.0.0/16 private
  /^169\.254\./,                                   // 169.254.0.0/16 link-local
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d|12[0-7])\./,   // 100.64.0.0/10 shared
  /^0\./,                                          // 0.0.0.0/8 current-network
  /^::1$/,                                         // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                             // IPv6 unique local fc00::/7
  /^fe[89ab][0-9a-f]:/i,                          // IPv6 link-local fe80::/10
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "169.254.169.254",           // AWS / GCP / Azure / DigitalOcean metadata
  "metadata.google.internal",  // GCP metadata
  "100.100.100.200",           // Alibaba Cloud metadata
  "192.0.0.192",               // Oracle Cloud metadata
]);

export class SsrfError extends Error {
  constructor(hostname: string) {
    super(`Blocked request to private/internal host: ${hostname}`);
    this.name = "SsrfError";
  }
}

/** Returns true if the given IP string matches any private/internal range. */
function isPrivateAddress(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

/**
 * Validates that a URL is safe to fetch server-side.
 *
 * 1. Checks the hostname string against the blocklist (fast, synchronous).
 * 2. Resolves the hostname via DNS and re-checks every returned IP to defend
 *    against DNS-rebinding attacks.
 *
 * Returns the parsed URL if safe; throws SsrfError otherwise.
 */
export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const { hostname, protocol } = parsed;

  // Only allow HTTP/HTTPS — block file://, ftp://, etc.
  if (protocol !== "http:" && protocol !== "https:") {
    throw new SsrfError(hostname);
  }

  // Synchronous hostname check (catches literal IPs and known bad hostnames)
  if (isPrivateAddress(hostname)) {
    throw new SsrfError(hostname);
  }

  // DNS resolution check — defeats DNS rebinding
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        throw new SsrfError(hostname);
      }
    }
  } catch (err) {
    if (err instanceof SsrfError) throw err;
    // DNS resolution failure — fail safe
    throw new SsrfError(hostname);
  }

  return parsed;
}
