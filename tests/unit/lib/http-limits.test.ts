import {
  DEFAULT_LIMITS,
  ResponseTooLargeError,
  fetchWithSizeLimit,
  readBodyCapped,
} from "@/lib/http-limits";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeResponse(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

// ─── readBodyCapped ─────────────────────────────────────────────────────────

describe("readBodyCapped", () => {
  it("returns the full body when it's under the cap", async () => {
    const res = makeResponse("hello world");
    const result = await readBodyCapped(res, 1024);
    expect(result.body).toBe("hello world");
    expect(result.truncated).toBe(false);
    expect(result.bytesRead).toBe(11);
  });

  it("truncates the body when it exceeds the cap", async () => {
    const res = makeResponse("abcdefghij"); // 10 bytes
    const result = await readBodyCapped(res, 4);
    expect(result.truncated).toBe(true);
    expect(result.bytesRead).toBe(4);
    expect(result.body).toBe("abcd");
  });

  it("fast-paths when Content-Length already exceeds the cap", async () => {
    const res = makeResponse("x".repeat(2000), {
      headers: { "content-length": "2000" },
    });
    const result = await readBodyCapped(res, 500);
    expect(result.truncated).toBe(true);
    expect(result.body).toBe("");
    expect(result.bytesRead).toBe(0);
  });

  it("handles an empty body", async () => {
    const res = new Response(null);
    const result = await readBodyCapped(res, 1024);
    expect(result.body).toBe("");
    expect(result.truncated).toBe(false);
    expect(result.bytesRead).toBe(0);
  });

  it("decodes UTF-8 content correctly when truncated on a byte boundary", async () => {
    // Chunk cleanly inside an ASCII prefix so decode doesn't produce replacements.
    const res = makeResponse("AccessKit scanner");
    const result = await readBodyCapped(res, 10);
    expect(result.body).toBe("AccessKit ");
    expect(result.truncated).toBe(true);
  });
});

// ─── fetchWithSizeLimit ─────────────────────────────────────────────────────

describe("fetchWithSizeLimit", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null on network failure", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("econnrefused"));
    const result = await fetchWithSizeLimit("https://example.com", {
      maxBytes: 1024,
    });
    expect(result).toBeNull();
  });

  it("returns the body when the response is small enough", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(makeResponse("hello"));
    const result = await fetchWithSizeLimit("https://example.com", {
      maxBytes: 1024,
    });
    expect(result?.body).toBe("hello");
    expect(result?.truncated).toBe(false);
  });

  it("marks the result as truncated when over the cap", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse("x".repeat(2000)));
    const result = await fetchWithSizeLimit("https://example.com", {
      maxBytes: 100,
    });
    expect(result?.truncated).toBe(true);
    expect(result?.body.length).toBe(100);
  });

  it("throws ResponseTooLargeError when throwOnOverflow is set", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse("x".repeat(2000)));
    await expect(
      fetchWithSizeLimit("https://example.com", {
        maxBytes: 100,
        throwOnOverflow: true,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("returns empty body but does not throw for non-2xx responses", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse("not found", { status: 404 }));
    const result = await fetchWithSizeLimit("https://example.com", {
      maxBytes: 1024,
    });
    expect(result?.response.status).toBe(404);
    expect(result?.body).toBe("");
    expect(result?.truncated).toBe(false);
  });

  it("uses Content-Length fast-path before buffering", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeResponse("y".repeat(2000), {
        headers: { "content-length": "2000" },
      }),
    );
    const result = await fetchWithSizeLimit("https://example.com", {
      maxBytes: 100,
    });
    expect(result?.truncated).toBe(true);
    expect(result?.body).toBe("");
  });
});

// ─── DEFAULT_LIMITS sanity ──────────────────────────────────────────────────

describe("DEFAULT_LIMITS", () => {
  it("uses reasonable byte budgets (never Infinity, never zero)", () => {
    for (const [name, value] of Object.entries(DEFAULT_LIMITS)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      // Nothing over 50 MB — we don't want to accidentally allow a DoS.
      expect(value).toBeLessThanOrEqual(50 * 1024 * 1024);
      expect(typeof name).toBe("string");
    }
  });
});
