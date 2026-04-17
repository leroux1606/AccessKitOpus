/**
 * Integration tests for GET /api/badges/[websiteId]/score.svg
 *
 * Locks in:
 *   - Opt-in default: publicBadgeEnabled must be explicitly true before the
 *     endpoint responds with a score (prevents accidental leak of a low score).
 *   - Unknown/disabled websites return 404 indistinguishably — no enumeration.
 *   - Happy path serves valid image/svg+xml with cache headers suitable for
 *     README / footer embedding.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────

jest.mock("@/lib/db", () => ({
  db: {
    website: { findUnique: jest.fn() },
  },
}));

jest.mock("next/server", () => {
  class FakeResponse {
    constructor(
      public readonly body: string,
      public readonly init: { status?: number; headers?: Record<string, string> } = {},
    ) {}
    get status() {
      return this.init.status ?? 200;
    }
    get headers() {
      return new Map<string, string>(Object.entries(this.init.headers ?? {}));
    }
    async text() {
      return this.body;
    }
  }
  return { NextResponse: FakeResponse };
});

import { GET } from "@/app/api/badges/[websiteId]/score.svg/route";
import { db } from "@/lib/db";

const mockFindUnique = db.website.findUnique as jest.MockedFunction<typeof db.website.findUnique>;

type FakeResponseShape = {
  body: string;
  status: number;
  headers: Map<string, string>;
  text: () => Promise<string>;
};

function buildParams(id: string) {
  return Promise.resolve({ websiteId: id });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("GET /api/badges/[websiteId]/score.svg", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 when the website does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null as never);

    const res = (await GET(new Request("http://localhost/"), {
      params: buildParams("missing"),
    })) as unknown as FakeResponseShape;

    expect(res.status).toBe(404);
  });

  it("returns 404 when the badge is disabled (even if the website exists)", async () => {
    mockFindUnique.mockResolvedValueOnce({
      publicBadgeEnabled: false,
      currentScore: 80,
    } as never);

    const res = (await GET(new Request("http://localhost/"), {
      params: buildParams("w_1"),
    })) as unknown as FakeResponseShape;

    expect(res.status).toBe(404);
  });

  it("serves an SVG badge when enabled", async () => {
    mockFindUnique.mockResolvedValueOnce({
      publicBadgeEnabled: true,
      currentScore: 87,
    } as never);

    const res = (await GET(new Request("http://localhost/"), {
      params: buildParams("w_1"),
    })) as unknown as FakeResponseShape;

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");

    expect(res.body).toMatch(/^<svg /);
    expect(res.body).toContain(">accessibility<");
    expect(res.body).toContain(">87/100<");
  });

  it("renders 'no data' when the website has no score yet", async () => {
    mockFindUnique.mockResolvedValueOnce({
      publicBadgeEnabled: true,
      currentScore: null,
    } as never);

    const res = (await GET(new Request("http://localhost/"), {
      params: buildParams("w_1"),
    })) as unknown as FakeResponseShape;

    expect(res.status).toBe(200);
    expect(res.body).toContain(">no data<");
  });
});
