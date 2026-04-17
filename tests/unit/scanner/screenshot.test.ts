/**
 * Unit tests for src/scanner/screenshot.ts — the Cloudflare R2 upload
 * helper. We mock `@aws-sdk/client-s3` at the module boundary so no
 * network traffic happens; assertions cover the behavioural contract
 * documented in screenshot.ts:
 *
 *   1. Env-gating: missing any R2_* var → skip + return null.
 *   2. Size cap: 0-byte or >5 MB buffer → skip + return null.
 *   3. Happy path: calls PutObjectCommand with correct args, returns
 *      `{publicUrl}/{key}` with trailing slashes normalized.
 *   4. Error handling: SDK rejection is swallowed, returns null.
 *   5. Key builder: produces a safe, prefixed, timestamped slug.
 *   6. Enabled gate: respects SCANNER_CAPTURE_SCREENSHOTS=false opt-out.
 */

const sendMock = jest.fn();
const clientDestroyMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: sendMock,
    destroy: clientDestroyMock,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  buildScreenshotKey,
  screenshotsEnabled,
  uploadScreenshot,
} from "@/scanner/screenshot";

const originalEnv = { ...process.env };

const R2_ENV = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "AKIA...",
  R2_SECRET_ACCESS_KEY: "secret...",
  R2_BUCKET_NAME: "accesskit-screenshots",
  R2_PUBLIC_URL: "https://screenshots.example.com",
};

function setFullR2Env() {
  Object.assign(process.env, R2_ENV);
}

function clearR2Env() {
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.R2_PUBLIC_URL;
  delete process.env.SCANNER_CAPTURE_SCREENSHOTS;
}

beforeEach(() => {
  sendMock.mockReset();
  clientDestroyMock.mockReset();
  (S3Client as unknown as jest.Mock).mockClear();
  (PutObjectCommand as unknown as jest.Mock).mockClear();
  process.env = { ...originalEnv };
  clearR2Env();
});

afterAll(() => {
  process.env = originalEnv;
});

// ─── uploadScreenshot ────────────────────────────────────────────────────────

describe("uploadScreenshot", () => {
  it("returns null and does not call R2 when env is incomplete", async () => {
    setFullR2Env();
    delete process.env.R2_PUBLIC_URL;

    const result = await uploadScreenshot(Buffer.from("png-bytes"), "scans/s1/p.png");

    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
    expect(S3Client).not.toHaveBeenCalled();
  });

  it("returns null when none of the R2 vars are set", async () => {
    const result = await uploadScreenshot(Buffer.from("png-bytes"), "scans/s1/p.png");
    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns null for an empty buffer", async () => {
    setFullR2Env();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await uploadScreenshot(Buffer.alloc(0), "scans/s1/p.png");
    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for a buffer exceeding the 5 MB size cap", async () => {
    setFullR2Env();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const oversize = Buffer.alloc(5 * 1024 * 1024 + 1);
    const result = await uploadScreenshot(oversize, "scans/s1/p.png");
    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uploads with correct bucket/key/content-type and returns public URL", async () => {
    setFullR2Env();
    sendMock.mockResolvedValueOnce({ ETag: "\"abc\"" });

    const buffer = Buffer.from("fake-png");
    const key = "scans/scan_1/example-com-home-12345.png";
    const result = await uploadScreenshot(buffer, key);

    expect(result).toBe("https://screenshots.example.com/scans/scan_1/example-com-home-12345.png");

    expect(S3Client).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "AKIA...",
        secretAccessKey: "secret...",
      },
    });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "accesskit-screenshots",
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(clientDestroyMock).toHaveBeenCalledTimes(1);
  });

  it("strips a trailing slash from R2_PUBLIC_URL when assembling the object URL", async () => {
    setFullR2Env();
    process.env.R2_PUBLIC_URL = "https://screenshots.example.com/";
    sendMock.mockResolvedValueOnce({});

    const result = await uploadScreenshot(Buffer.from("png"), "scans/s/p.png");

    expect(result).toBe("https://screenshots.example.com/scans/s/p.png");
  });

  it("swallows SDK errors and returns null", async () => {
    setFullR2Env();
    sendMock.mockRejectedValueOnce(new Error("AccessDenied"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await uploadScreenshot(Buffer.from("png"), "scans/s/p.png");

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    // Client is still destroyed even on failure.
    expect(clientDestroyMock).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});

// ─── buildScreenshotKey ──────────────────────────────────────────────────────

describe("buildScreenshotKey", () => {
  it("prefixes with scans/{scanId} and ends in .png", () => {
    const key = buildScreenshotKey("scan_abc", "https://example.com/about");
    expect(key).toMatch(/^scans\/scan_abc\/.+\.png$/);
  });

  it("slugifies hostname + path and appends a numeric timestamp", () => {
    const before = Date.now();
    const key = buildScreenshotKey("s1", "https://Example.COM/Docs/Hello_World?x=1");
    const after = Date.now();

    const match = key.match(/^scans\/s1\/([a-z0-9-]+)-(\d+)\.png$/);
    expect(match).not.toBeNull();
    const [, slug, ts] = match!;
    expect(slug).toContain("example-com");
    expect(slug).toContain("docs");
    expect(slug).toContain("hello-world");
    expect(slug).not.toMatch(/_|\?|=/);
    const tsNum = Number(ts);
    expect(tsNum).toBeGreaterThanOrEqual(before);
    expect(tsNum).toBeLessThanOrEqual(after);
  });

  it("falls back to a non-empty slug for malformed URLs", () => {
    const key = buildScreenshotKey("s1", "not a url at all!!!");
    expect(key).toMatch(/^scans\/s1\/.+\.png$/);
    // The slug portion must be non-empty and contain only [a-z0-9-]
    const slugPart = key.replace(/^scans\/s1\//, "").replace(/-\d+\.png$/, "");
    expect(slugPart.length).toBeGreaterThan(0);
    expect(slugPart).toMatch(/^[a-z0-9-]+$/);
  });

  it("caps the slug length so keys stay reasonable", () => {
    const long = "https://example.com/" + "a".repeat(500);
    const key = buildScreenshotKey("s1", long);
    const slugPart = key.replace(/^scans\/s1\//, "").replace(/-\d+\.png$/, "");
    expect(slugPart.length).toBeLessThanOrEqual(80);
  });
});

// ─── screenshotsEnabled ──────────────────────────────────────────────────────

describe("screenshotsEnabled", () => {
  it("returns false when R2 is not configured", () => {
    expect(screenshotsEnabled()).toBe(false);
  });

  it("returns true when all R2 vars are set and opt-out is unset", () => {
    setFullR2Env();
    expect(screenshotsEnabled()).toBe(true);
  });

  it("returns false when SCANNER_CAPTURE_SCREENSHOTS is exactly 'false'", () => {
    setFullR2Env();
    process.env.SCANNER_CAPTURE_SCREENSHOTS = "false";
    expect(screenshotsEnabled()).toBe(false);
  });

  it("ignores SCANNER_CAPTURE_SCREENSHOTS values other than 'false'", () => {
    setFullR2Env();
    process.env.SCANNER_CAPTURE_SCREENSHOTS = "no";
    expect(screenshotsEnabled()).toBe(true);
  });
});
