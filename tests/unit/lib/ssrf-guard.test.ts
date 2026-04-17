/**
 * Unit tests for assertSafeFetchUrl.
 *
 * The function is now async because it resolves the hostname via DNS to defend
 * against DNS-rebinding attacks. `dns` is mocked here so tests are fast and
 * don't require network access.
 *
 * Default mock behaviour: DNS always resolves to a public IP (93.184.216.34).
 * Individual tests override this when they need to test DNS-rebinding scenarios.
 */

import * as dns from "dns";

jest.mock("dns", () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

import { assertSafeFetchUrl, SsrfError } from "@/lib/ssrf-guard";

const mockLookup = (dns.promises.lookup as jest.Mock);

beforeEach(() => {
  // Default: DNS resolves to a benign public IP
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Allowed URLs ─────────────────────────────────────────────────────────────

it("allows public HTTPS URLs", async () => {
  await expect(assertSafeFetchUrl("https://example.com")).resolves.toBeDefined();
});

it("allows public HTTP URLs", async () => {
  await expect(assertSafeFetchUrl("http://example.com")).resolves.toBeDefined();
});

it("allows HTTPS URLs with paths and query strings", async () => {
  await expect(
    assertSafeFetchUrl("https://mysite.com/page?foo=bar"),
  ).resolves.toBeDefined();
});

it("returns the parsed URL for valid addresses", async () => {
  const url = await assertSafeFetchUrl("https://example.com/path");
  expect(url.hostname).toBe("example.com");
  expect(url.pathname).toBe("/path");
});

// ─── Localhost / loopback ─────────────────────────────────────────────────────

it("blocks localhost hostname", async () => {
  await expect(assertSafeFetchUrl("http://localhost")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://localhost:8080")).rejects.toThrow(SsrfError);
});

it("blocks 127.0.0.1 loopback", async () => {
  await expect(assertSafeFetchUrl("http://127.0.0.1")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://127.0.0.1:3000")).rejects.toThrow(SsrfError);
});

it("blocks other 127.x.x.x loopback addresses", async () => {
  await expect(assertSafeFetchUrl("http://127.1.2.3")).rejects.toThrow(SsrfError);
});

// ─── Private ranges ───────────────────────────────────────────────────────────

it("blocks 10.x.x.x private range", async () => {
  await expect(assertSafeFetchUrl("http://10.0.0.1")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://10.255.255.255")).rejects.toThrow(SsrfError);
});

it("blocks 192.168.x.x private range", async () => {
  await expect(assertSafeFetchUrl("http://192.168.0.1")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://192.168.1.100")).rejects.toThrow(SsrfError);
});

it("blocks 172.16-31 private range", async () => {
  await expect(assertSafeFetchUrl("http://172.16.0.1")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://172.20.1.1")).rejects.toThrow(SsrfError);
  await expect(assertSafeFetchUrl("http://172.31.255.255")).rejects.toThrow(SsrfError);
});

it("allows 172.32.x.x (just outside the private range)", async () => {
  await expect(assertSafeFetchUrl("http://172.32.0.1")).resolves.toBeDefined();
});

it("allows 172.15.x.x (below the private range)", async () => {
  await expect(assertSafeFetchUrl("http://172.15.0.1")).resolves.toBeDefined();
});

// ─── Link-local and metadata ──────────────────────────────────────────────────

it("blocks 169.254.x.x link-local range", async () => {
  await expect(assertSafeFetchUrl("http://169.254.0.1")).rejects.toThrow(SsrfError);
});

it("blocks the AWS/GCP/Azure metadata endpoint (169.254.169.254)", async () => {
  await expect(
    assertSafeFetchUrl("http://169.254.169.254/latest/meta-data/"),
  ).rejects.toThrow(SsrfError);
});

it("blocks by hostname (metadata.google.internal)", async () => {
  await expect(
    assertSafeFetchUrl("http://metadata.google.internal/computeMetadata/v1/"),
  ).rejects.toThrow(SsrfError);
});

// ─── DNS rebinding ────────────────────────────────────────────────────────────

it("blocks DNS rebinding — public hostname resolves to private IP", async () => {
  // Attacker's domain looks public but DNS resolves to 192.168.1.1
  mockLookup.mockResolvedValueOnce([{ address: "192.168.1.1", family: 4 }]);
  await expect(
    assertSafeFetchUrl("https://evil.attacker.example.com"),
  ).rejects.toThrow(SsrfError);
});

it("blocks DNS rebinding — hostname resolves to loopback", async () => {
  mockLookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
  await expect(
    assertSafeFetchUrl("https://rebind.example.com"),
  ).rejects.toThrow(SsrfError);
});

it("blocks when DNS resolution fails (fail-safe)", async () => {
  mockLookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
  await expect(
    assertSafeFetchUrl("https://nonexistent.example.com"),
  ).rejects.toThrow(SsrfError);
});

// ─── Protocol blocking ────────────────────────────────────────────────────────

it("blocks file:// protocol", async () => {
  await expect(assertSafeFetchUrl("file:///etc/passwd")).rejects.toThrow();
});

it("blocks ftp:// protocol", async () => {
  await expect(assertSafeFetchUrl("ftp://example.com")).rejects.toThrow(SsrfError);
});

it("blocks javascript: protocol", async () => {
  await expect(assertSafeFetchUrl("javascript:alert(1)")).rejects.toThrow();
});

// ─── Invalid URLs ─────────────────────────────────────────────────────────────

it("throws for completely invalid URLs", async () => {
  await expect(assertSafeFetchUrl("not-a-url")).rejects.toThrow();
  await expect(assertSafeFetchUrl("")).rejects.toThrow();
});

it("throws for relative URLs", async () => {
  await expect(assertSafeFetchUrl("/relative/path")).rejects.toThrow();
});

// ─── Error type ───────────────────────────────────────────────────────────────

it("throws SsrfError (not a generic Error) for blocked hosts", async () => {
  let caughtError: unknown;
  try {
    await assertSafeFetchUrl("http://10.0.0.1");
  } catch (e) {
    caughtError = e;
  }
  expect(caughtError).toBeInstanceOf(SsrfError);
  expect((caughtError as SsrfError).name).toBe("SsrfError");
});
