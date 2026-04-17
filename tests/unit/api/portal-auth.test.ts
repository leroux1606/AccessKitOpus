/**
 * Integration tests for POST /api/portal/[slug]/auth
 *
 * Covers the full request path: rate limit → body parse → password hash
 * comparison → cookie set. Database and rate limiter are mocked at the
 * module boundary so the route handler runs in a plain Node/Jest env
 * with no real Postgres or shared state.
 */

import { createHash } from "crypto";

// ─── Mocks (must be declared before the route import) ──────────────────────

jest.mock("@/lib/db", () => ({
  db: {
    clientPortal: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

type FakeCookieJar = {
  store: Map<string, { value: string; options: Record<string, unknown> }>;
  set: jest.Mock;
};

type FakeResponse = {
  status: number;
  body: unknown;
  headers: Map<string, string>;
  cookies: FakeCookieJar;
  json: () => Promise<unknown>;
};

jest.mock("next/server", () => {
  class NextRequest {
    constructor(
      public url: string,
      private init: { method?: string; headers?: Record<string, string>; body?: string } = {},
    ) {}
    get headers() {
      const entries = Object.entries(this.init.headers ?? {});
      return {
        get: (name: string) =>
          entries.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null,
      };
    }
    async json() {
      if (this.init.body === undefined) throw new Error("no body");
      return JSON.parse(this.init.body);
    }
  }

  const NextResponse = {
    json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): FakeResponse {
      const cookies: FakeCookieJar = {
        store: new Map(),
        set: jest.fn((name: string, value: string, options: Record<string, unknown>) => {
          cookies.store.set(name, { value, options });
        }),
      };
      const headers = new Map<string, string>();
      for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v);
      return {
        status: init.status ?? 200,
        body,
        headers,
        cookies,
        json: () => Promise.resolve(body),
      };
    },
  };

  return { NextRequest, NextResponse };
});

// ─── Imports (hoisted mocks apply before these run) ────────────────────────

import { POST } from "@/app/api/portal/[slug]/auth/route";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limiter";
import { NextRequest } from "next/server";

const mockFindUnique = db.clientPortal.findUnique as jest.MockedFunction<
  typeof db.clientPortal.findUnique
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const SLUG = "acme-client";
const PW = "correct-horse-battery-staple";
const PW_HASH = createHash("sha256").update(PW).digest("hex");

function buildRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost/api/portal/${SLUG}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/portal/[slug]/auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetInMs: 600_000 });
  });

  it("returns 200 and sets an httpOnly cookie on correct password", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

    const req = buildRequest({ password: PW });
    const res = (await POST(req, { params: Promise.resolve({ slug: SLUG }) })) as unknown as FakeResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const cookie = res.cookies.store.get(`portal_${SLUG}`);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(PW_HASH);
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: `/portal/${SLUG}`,
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  it("returns 401 on wrong password (never reveals whether portal exists)", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

    const res = (await POST(
      buildRequest({ password: "wrong" }),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toMatch(/incorrect/i);
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  it("returns 404 when the portal is disabled", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: false } as never);

    const res = (await POST(
      buildRequest({ password: PW }),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(404);
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  it("returns 404 when the portal does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null as never);

    const res = (await POST(
      buildRequest({ password: PW }),
      { params: Promise.resolve({ slug: "does-not-exist" }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(404);
  });

  it("returns 404 when the portal has no password hash set", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: null, enabled: true } as never);

    const res = (await POST(
      buildRequest({ password: PW }),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(404);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = (await POST(
      buildRequest("not-json"),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when password is missing", async () => {
    const res = (await POST(
      buildRequest({}),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when password is not a string", async () => {
    const res = (await POST(
      buildRequest({ password: 123 }),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(400);
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 300_000 });

    const res = (await POST(
      buildRequest({ password: PW }),
      { params: Promise.resolve({ slug: SLUG }) },
    )) as unknown as FakeResponse;

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rate-limit key incorporates slug + IP so portals throttle independently", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

    await POST(
      buildRequest({ password: PW }, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }),
      { params: Promise.resolve({ slug: SLUG }) },
    );

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      `portal-auth:${SLUG}:1.2.3.4`,
      10,
      10 * 60_000,
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

    await POST(
      buildRequest({ password: PW }, { "x-real-ip": "9.9.9.9" }),
      { params: Promise.resolve({ slug: SLUG }) },
    );

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      `portal-auth:${SLUG}:9.9.9.9`,
      10,
      10 * 60_000,
    );
  });

  it("uses 'unknown' as the IP bucket when no IP headers are present", async () => {
    mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

    await POST(
      buildRequest({ password: PW }),
      { params: Promise.resolve({ slug: SLUG }) },
    );

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      `portal-auth:${SLUG}:unknown`,
      10,
      10 * 60_000,
    );
  });

  it("cookie secure flag follows NODE_ENV (production only)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // Cast through unknown to bypass NodeJS's readonly NODE_ENV typing.
      (process.env as unknown as Record<string, string>).NODE_ENV = "production";
      mockFindUnique.mockResolvedValueOnce({ passwordHash: PW_HASH, enabled: true } as never);

      const res = (await POST(
        buildRequest({ password: PW }),
        { params: Promise.resolve({ slug: SLUG }) },
      )) as unknown as FakeResponse;

      const cookie = res.cookies.store.get(`portal_${SLUG}`);
      expect(cookie?.options.secure).toBe(true);
    } finally {
      (process.env as unknown as Record<string, string>).NODE_ENV = originalEnv ?? "test";
    }
  });
});
