import { checkWebhookRequest } from "@/lib/webhook-guard";

describe("checkWebhookRequest", () => {
  const baseline = {
    method: "POST",
    origin: null,
    contentLength: null,
  };

  describe("method", () => {
    it("rejects GET requests with 405", () => {
      const result = checkWebhookRequest({ ...baseline, method: "GET" });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(405);
    });

    it("rejects OPTIONS requests with 405", () => {
      const result = checkWebhookRequest({ ...baseline, method: "OPTIONS" });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(405);
    });

    it("accepts POST requests", () => {
      const result = checkWebhookRequest(baseline);
      expect(result.ok).toBe(true);
    });
  });

  describe("content-length", () => {
    it("rejects payloads larger than the cap", () => {
      const result = checkWebhookRequest({
        ...baseline,
        contentLength: String(2 * 1024 * 1024),
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(413);
    });

    it("accepts payloads under the cap", () => {
      const result = checkWebhookRequest({
        ...baseline,
        contentLength: "500000",
      });
      expect(result.ok).toBe(true);
    });

    it("accepts requests without Content-Length (chunked)", () => {
      const result = checkWebhookRequest(baseline);
      expect(result.ok).toBe(true);
    });

    it("ignores malformed Content-Length values", () => {
      const result = checkWebhookRequest({
        ...baseline,
        contentLength: "not-a-number",
      });
      expect(result.ok).toBe(true);
    });

    it("honors a custom maxBodyBytes override", () => {
      const result = checkWebhookRequest(
        { ...baseline, contentLength: "2048" },
        { maxBodyBytes: 1024 },
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe(413);
    });
  });

  describe("origin", () => {
    it("accepts requests with no Origin header (server-to-server)", () => {
      const result = checkWebhookRequest(baseline);
      expect(result.ok).toBe(true);
    });

    it("rejects requests with a browser Origin header by default", () => {
      const result = checkWebhookRequest({
        ...baseline,
        origin: "https://evil.example",
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
      expect(result.reason).toContain("evil.example");
    });

    it("accepts allowlisted origins", () => {
      const result = checkWebhookRequest(
        { ...baseline, origin: "https://app.accesskit.example" },
        { allowedOrigins: ["https://app.accesskit.example"] },
      );
      expect(result.ok).toBe(true);
    });

    it("rejects origins not in the allowlist", () => {
      const result = checkWebhookRequest(
        { ...baseline, origin: "https://attacker.example" },
        { allowedOrigins: ["https://app.accesskit.example"] },
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
    });
  });
});
