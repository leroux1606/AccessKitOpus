import { checkCsrf, getAllowedOrigins } from "@/lib/csrf";

const SELF = "https://app.accesskit.example";

function run(opts: Partial<Parameters<typeof checkCsrf>[0]> = {}) {
  return checkCsrf({
    method: "POST",
    pathname: "/api/websites/abc",
    origin: null,
    referer: null,
    selfOrigin: SELF,
    ...opts,
  });
}

describe("checkCsrf", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("safe methods", () => {
    it.each(["GET", "HEAD", "OPTIONS"])("allows %s without origin", (method) => {
      expect(run({ method })).toEqual({ ok: true });
    });
  });

  describe("skip list", () => {
    const skipped = [
      "/api/auth/callback/google",
      "/api/auth/signout",
      "/api/webhooks/paystack",
      "/api/webhooks/stripe",
      "/api/inngest",
      "/api/v1/scans",
      "/api/v1/openapi.json",
      "/api/health",
    ];
    it.each(skipped)("skips CSRF check for %s", (pathname) => {
      expect(run({ method: "POST", pathname, origin: "https://evil.example" })).toEqual({ ok: true });
    });
  });

  describe("non-api routes", () => {
    it("does not block page POSTs (Next.js server actions handle those)", () => {
      expect(run({ pathname: "/dashboard", origin: "https://evil.example" })).toEqual({ ok: true });
    });
  });

  describe("same-origin requests", () => {
    it("allows requests with matching Origin", () => {
      expect(run({ origin: SELF })).toEqual({ ok: true });
    });

    it("allows requests with Referer matching self", () => {
      expect(run({ referer: `${SELF}/websites/abc` })).toEqual({ ok: true });
    });
  });

  describe("cross-origin requests", () => {
    it("blocks requests with a foreign Origin", () => {
      const result = run({ origin: "https://evil.example" });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("evil.example");
    });

    it("blocks requests with a foreign Referer when Origin is absent", () => {
      const result = run({ referer: "https://evil.example/attack" });
      expect(result.ok).toBe(false);
    });

    it("blocks requests with no Origin AND no Referer", () => {
      const result = run();
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("Missing");
    });

    it("blocks a malformed Referer", () => {
      const result = run({ referer: "not-a-url" });
      expect(result.ok).toBe(false);
    });
  });

  describe("multiple allowed origins via env", () => {
    it("honors NEXTAUTH_URL as an additional allowed origin", () => {
      process.env.NEXTAUTH_URL = "https://auth.accesskit.example";
      expect(
        run({ origin: "https://auth.accesskit.example" }),
      ).toEqual({ ok: true });
    });

    it("honors NEXT_PUBLIC_APP_URL as an additional allowed origin", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://www.accesskit.example";
      expect(
        run({ origin: "https://www.accesskit.example" }),
      ).toEqual({ ok: true });
    });

    it("ignores malformed env values without throwing", () => {
      process.env.NEXTAUTH_URL = "not a url";
      expect(() => getAllowedOrigins(SELF)).not.toThrow();
      expect(getAllowedOrigins(SELF).has(SELF)).toBe(true);
    });
  });

  describe("Origin preferred over Referer", () => {
    it("uses Origin when both are present and Origin matches", () => {
      const result = run({
        origin: SELF,
        referer: "https://evil.example/doesnt-matter",
      });
      expect(result.ok).toBe(true);
    });

    it("uses Origin when both are present and Origin is foreign", () => {
      const result = run({
        origin: "https://evil.example",
        referer: SELF,
      });
      expect(result.ok).toBe(false);
    });
  });
});
