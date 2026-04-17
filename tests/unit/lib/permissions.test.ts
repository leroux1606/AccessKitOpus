import {
  hasRole,
  canManageTeam,
  canManageBilling,
  canRunScans,
  canManageWebsites,
  canAssignIssues,
  canConfigureOrg,
  canDeleteOrg,
  canViewClientPortal,
} from "@/lib/permissions";
import type { Role } from "@prisma/client";

// ─── hasRole ─────────────────────────────────────────────────────────────────

describe("hasRole", () => {
  it("OWNER satisfies every role level", () => {
    const roles: Role[] = ["OWNER", "ADMIN", "MEMBER", "CLIENT_VIEWER"];
    for (const required of roles) {
      expect(hasRole("OWNER", required)).toBe(true);
    }
  });

  it("ADMIN satisfies ADMIN, MEMBER, CLIENT_VIEWER but not OWNER", () => {
    expect(hasRole("ADMIN", "OWNER")).toBe(false);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasRole("ADMIN", "CLIENT_VIEWER")).toBe(true);
  });

  it("MEMBER satisfies MEMBER and CLIENT_VIEWER but not ADMIN/OWNER", () => {
    expect(hasRole("MEMBER", "OWNER")).toBe(false);
    expect(hasRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasRole("MEMBER", "MEMBER")).toBe(true);
    expect(hasRole("MEMBER", "CLIENT_VIEWER")).toBe(true);
  });

  it("CLIENT_VIEWER only satisfies CLIENT_VIEWER", () => {
    expect(hasRole("CLIENT_VIEWER", "OWNER")).toBe(false);
    expect(hasRole("CLIENT_VIEWER", "ADMIN")).toBe(false);
    expect(hasRole("CLIENT_VIEWER", "MEMBER")).toBe(false);
    expect(hasRole("CLIENT_VIEWER", "CLIENT_VIEWER")).toBe(true);
  });
});

// ─── canManageTeam ────────────────────────────────────────────────────────────

describe("canManageTeam", () => {
  it("allows OWNER and ADMIN", () => {
    expect(canManageTeam("OWNER")).toBe(true);
    expect(canManageTeam("ADMIN")).toBe(true);
  });

  it("denies MEMBER and CLIENT_VIEWER", () => {
    expect(canManageTeam("MEMBER")).toBe(false);
    expect(canManageTeam("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canManageBilling ─────────────────────────────────────────────────────────

describe("canManageBilling", () => {
  it("allows only OWNER", () => {
    expect(canManageBilling("OWNER")).toBe(true);
    expect(canManageBilling("ADMIN")).toBe(false);
    expect(canManageBilling("MEMBER")).toBe(false);
    expect(canManageBilling("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canRunScans ──────────────────────────────────────────────────────────────

describe("canRunScans", () => {
  it("allows OWNER, ADMIN, and MEMBER", () => {
    expect(canRunScans("OWNER")).toBe(true);
    expect(canRunScans("ADMIN")).toBe(true);
    expect(canRunScans("MEMBER")).toBe(true);
  });

  it("denies CLIENT_VIEWER", () => {
    expect(canRunScans("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canManageWebsites ────────────────────────────────────────────────────────

describe("canManageWebsites", () => {
  it("allows OWNER, ADMIN, and MEMBER", () => {
    expect(canManageWebsites("OWNER")).toBe(true);
    expect(canManageWebsites("ADMIN")).toBe(true);
    expect(canManageWebsites("MEMBER")).toBe(true);
  });

  it("denies CLIENT_VIEWER", () => {
    expect(canManageWebsites("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canAssignIssues ──────────────────────────────────────────────────────────

describe("canAssignIssues", () => {
  it("allows OWNER, ADMIN, and MEMBER", () => {
    expect(canAssignIssues("OWNER")).toBe(true);
    expect(canAssignIssues("ADMIN")).toBe(true);
    expect(canAssignIssues("MEMBER")).toBe(true);
  });

  it("denies CLIENT_VIEWER", () => {
    expect(canAssignIssues("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canConfigureOrg ──────────────────────────────────────────────────────────

describe("canConfigureOrg", () => {
  it("allows OWNER and ADMIN", () => {
    expect(canConfigureOrg("OWNER")).toBe(true);
    expect(canConfigureOrg("ADMIN")).toBe(true);
  });

  it("denies MEMBER and CLIENT_VIEWER", () => {
    expect(canConfigureOrg("MEMBER")).toBe(false);
    expect(canConfigureOrg("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canDeleteOrg ─────────────────────────────────────────────────────────────

describe("canDeleteOrg", () => {
  it("allows only OWNER", () => {
    expect(canDeleteOrg("OWNER")).toBe(true);
    expect(canDeleteOrg("ADMIN")).toBe(false);
    expect(canDeleteOrg("MEMBER")).toBe(false);
    expect(canDeleteOrg("CLIENT_VIEWER")).toBe(false);
  });
});

// ─── canViewClientPortal ──────────────────────────────────────────────────────

describe("canViewClientPortal", () => {
  it("allows all roles including CLIENT_VIEWER", () => {
    expect(canViewClientPortal("OWNER")).toBe(true);
    expect(canViewClientPortal("ADMIN")).toBe(true);
    expect(canViewClientPortal("MEMBER")).toBe(true);
    expect(canViewClientPortal("CLIENT_VIEWER")).toBe(true);
  });
});
