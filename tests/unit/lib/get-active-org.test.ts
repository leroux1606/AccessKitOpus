/**
 * Unit tests for the cookie-respecting active-membership resolver.
 *
 * The whole point of this helper is to route a user to the right org when
 * they belong to several — the "arbitrary findFirst" bug that Phase B1
 * eradicated across 29 files. These tests lock in the behaviour so any
 * future regression shows up immediately.
 */

// ─── Mocks (hoisted before imports) ───────────────────────────────────────

const mockCookieGet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: mockCookieGet })),
}));

jest.mock("@/lib/db", () => ({
  db: {
    membership: { findFirst: jest.fn() },
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────

import { getActiveMembership, ACTIVE_ORG_COOKIE } from "@/lib/get-active-org";
import { db } from "@/lib/db";

const mockFindFirst = db.membership.findFirst as jest.MockedFunction<
  typeof db.membership.findFirst
>;

const USER_ID = "user-alice";
const ORG_ACME = "org-acme";
const ORG_INITECH = "org-initech";

function membershipFor(orgId: string, role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER") {
  return {
    id: `mem-${orgId}`,
    userId: USER_ID,
    organizationId: orgId,
    role,
    createdAt: new Date(),
    organization: {
      id: orgId,
      name: orgId.toUpperCase(),
      slug: orgId,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("getActiveMembership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the membership matching the active-org cookie", async () => {
    mockCookieGet.mockReturnValue({ value: ORG_INITECH });
    mockFindFirst.mockResolvedValueOnce(membershipFor(ORG_INITECH) as never);

    const result = await getActiveMembership(USER_ID);

    expect(mockCookieGet).toHaveBeenCalledWith(ACTIVE_ORG_COOKIE);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, organizationId: ORG_INITECH },
      include: { organization: true },
    });
    expect(result?.organizationId).toBe(ORG_INITECH);
  });

  it("falls back to the oldest membership when no cookie is set", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockFindFirst.mockResolvedValueOnce(membershipFor(ORG_ACME) as never);

    const result = await getActiveMembership(USER_ID);

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    expect(result?.organizationId).toBe(ORG_ACME);
  });

  it("falls back to the oldest membership when the cookie points to a stale / foreign org", async () => {
    mockCookieGet.mockReturnValue({ value: "org-that-user-no-longer-belongs-to" });
    mockFindFirst
      .mockResolvedValueOnce(null as never) // cookie lookup misses
      .mockResolvedValueOnce(membershipFor(ORG_ACME) as never); // fallback hits

    const result = await getActiveMembership(USER_ID);

    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(result?.organizationId).toBe(ORG_ACME);
    // Second call is the ordered-by-createdAt fallback
    expect(mockFindFirst.mock.calls[1]?.[0]).toMatchObject({
      where: { userId: USER_ID },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns null when the user belongs to zero organizations", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockFindFirst.mockResolvedValueOnce(null as never);

    const result = await getActiveMembership(USER_ID);

    expect(result).toBeNull();
  });

  it("is deterministic for single-org users (single call, no cookie dependency)", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockFindFirst.mockResolvedValueOnce(membershipFor(ORG_ACME) as never);

    await getActiveMembership(USER_ID);

    // No cookie means only the fallback query runs — no extra round-trip
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it("includes the organization relation on every lookup path", async () => {
    // Cookie path
    mockCookieGet.mockReturnValue({ value: ORG_ACME });
    mockFindFirst.mockResolvedValueOnce(membershipFor(ORG_ACME) as never);
    await getActiveMembership(USER_ID);
    expect(mockFindFirst.mock.calls[0]?.[0]?.include).toEqual({ organization: true });

    jest.clearAllMocks();

    // Fallback path
    mockCookieGet.mockReturnValue(undefined);
    mockFindFirst.mockResolvedValueOnce(membershipFor(ORG_ACME) as never);
    await getActiveMembership(USER_ID);
    expect(mockFindFirst.mock.calls[0]?.[0]?.include).toEqual({ organization: true });
  });
});
