/**
 * Unit tests for GET /api/health
 *
 * We mock both @/lib/db (Prisma) and next/server (NextResponse) so the
 * route handler can run in a plain Node.js Jest environment without a
 * real database or Next.js runtime.
 */

// ─── Mocks (must be defined before the route import) ────────────────────────

jest.mock("@/lib/db", () => ({
  db: { $queryRaw: jest.fn() },
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: () => Promise.resolve(body),
    }),
  },
}));

// ─── Imports (hoisted mocks apply before these run) ─────────────────────────

import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

const mockQueryRaw = db.$queryRaw as jest.MockedFunction<typeof db.$queryRaw>;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with status 'ok' when the database is reachable", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    // Timestamp should be a valid ISO-8601 date
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it("calls db.$queryRaw once per request", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    await GET();
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 503 with status 'error' when the database throws", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(typeof body.timestamp).toBe("string");
  });

  it("includes a timestamp in the error response too", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("timeout"));
    const response = await GET();
    const body = await response.json();
    expect(body.timestamp).toBeTruthy();
  });
});
