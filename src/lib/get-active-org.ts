/**
 * Returns the active organization membership for the current user.
 *
 * For users in a single organization: returns that membership.
 * For users in multiple organizations: reads the `active-org` cookie set by
 * the org switcher, and returns the matching membership. Falls back to the
 * oldest membership (deterministic) if the cookie is absent or stale.
 *
 * Always use this instead of raw `db.membership.findFirst` in server
 * components and server actions to ensure consistent org resolution.
 */

import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const ACTIVE_ORG_COOKIE = "active-org";

export async function getActiveMembership(userId: string) {
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  // If we have a cookie, try to match it first
  if (activeOrgId) {
    const membership = await db.membership.findFirst({
      where: { userId, organizationId: activeOrgId },
      include: { organization: true },
    });
    if (membership) return membership;
  }

  // Fallback: oldest membership (deterministic for single-org and multi-org users)
  return db.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}
