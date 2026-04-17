/**
 * Integration tests for POST /api/switch-org
 *
 * Locks in the access-control guarantee behind the org switcher: a user
 * can only set the active-org cookie to an organization they actually
 * belong to. Anything else is a 403 with no cookie leakage.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

jest.mock("@/lib/db", () => ({
  db: {
    membership: { findFirst: jest.fn() },
  },
}));

type FakeCookieJar = {
  store: Map<string, { value: string; options: Record<string, unknown> }>;
  set: jest.Mock;
};

type FakeResponse = {
  status: number;
  body: unknown;
  cookies: FakeCookieJar;
  json: () => Promise<unknown>;
};

jest.mock("next/server", () => {
  class NextRequest {
    constructor(
      public url: string,
      private init: { method?: string; body?: string } = {},
    ) {}
    async json() {
      if (this.init.body === undefined) throw new Error("no body");
      return JSON.parse(this.init.body);
    }
  }

  const NextResponse = {
    json(body: unknown, init: { status?: number } = {}): FakeResponse {
      const cookies: FakeCookieJar = {
        store: new Map(),
        set: jest.fn((name: string, value: string, options: Record<string, unknown>) => {
          cookies.store.set(name, { value, options });
        }),
      };
      return {
        status: init.status ?? 200,
        body,
        cookies,
        json: () => Promise.resolve(body),
      };
    },
  };

  return { NextRequest, NextResponse };
});

// ─── Imports ──────────────────────────────────────────────────────────────

import { POST } from "@/app/api/switch-org/route";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/get-active-org";

const mockFindFirst = db.membership.findFirst as jest.MockedFunction<
  typeof db.membership.findFirst
>;

const USER_ID = "user-alice";
const ORG_ACME = "org-acme";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/switch-org", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/switch-org", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets the active-org cookie when the user belongs to the requested org", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: USER_ID } });
    mockFindFirst.mockResolvedValueOnce({
      id: "m1",
      userId: USER_ID,
      organizationId: ORG_ACME,
      role: "OWNER",
    } as never);

    const res = (await POST(buildRequest({ orgId: ORG_ACME }))) as unknown as FakeResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const cookie = res.cookies.store.get(ACTIVE_ORG_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(ORG_ACME);
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, organizationId: ORG_ACME },
    });
  });

  it("returns 401 when the caller is unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = (await POST(buildRequest({ orgId: ORG_ACME }))) as unknown as FakeResponse;

    expect(res.status).toBe(401);
    expect(res.cookies.set).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when the session has no user.id", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} });

    const res = (await POST(buildRequest({ orgId: ORG_ACME }))) as unknown as FakeResponse;

    expect(res.status).toBe(401);
  });

  it("returns 400 when orgId is missing from the body", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: USER_ID } });

    const res = (await POST(buildRequest({}))) as unknown as FakeResponse;

    expect(res.status).toBe(400);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  it("returns 403 when the user does not belong to the requested org", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: USER_ID } });
    mockFindFirst.mockResolvedValueOnce(null as never);

    const res = (await POST(buildRequest({ orgId: "org-someone-else" }))) as unknown as FakeResponse;

    expect(res.status).toBe(403);
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  it("never writes the cookie when membership check throws", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: USER_ID } });
    mockFindFirst.mockRejectedValueOnce(new Error("db down"));

    await expect(POST(buildRequest({ orgId: ORG_ACME }))).rejects.toThrow("db down");
  });
});
