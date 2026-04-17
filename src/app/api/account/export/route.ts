import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GDPR Article 15 & 20 — Right of access and data portability.
 * Returns all personal data held for the authenticated user as JSON.
 * GET /api/account/export
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [
    user,
    memberships,
    accounts,
    comments,
    assignedViolations,
    notifications,
    notificationPreferences,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.membership.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            createdAt: true,
            websites: {
              select: {
                id: true,
                name: true,
                url: true,
                currentScore: true,
                lastScanAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    db.account.findMany({
      where: { userId },
      select: {
        provider: true,
        providerAccountId: true,
        type: true,
      },
    }),
    db.issueComment.findMany({
      where: { userId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        violationFingerprint: true,
      },
    }),
    db.violation.findMany({
      where: { assignedToId: userId },
      select: {
        id: true,
        ruleId: true,
        description: true,
        severity: true,
        status: true,
        firstDetectedAt: true,
        website: { select: { name: true, url: true } },
      },
    }),
    db.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        read: true,
        createdAt: true,
      },
    }),
    db.notificationPreference.findMany({
      where: { userId },
      select: {
        type: true,
        email: true,
        inApp: true,
        organizationId: true,
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    linkedAccounts: accounts,
    memberships: memberships.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt,
      organization: m.organization,
    })),
    issueComments: comments,
    assignedIssues: assignedViolations.map((v) => ({
      id: v.id,
      ruleId: v.ruleId,
      description: v.description,
      severity: v.severity,
      status: v.status,
      firstDetectedAt: v.firstDetectedAt,
      website: v.website,
    })),
    notifications,
    notificationPreferences,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="accesskit-export-${userId}.json"`,
    },
  });
}
