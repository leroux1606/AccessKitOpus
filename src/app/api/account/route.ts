import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GDPR Article 17 — Right to erasure ("right to be forgotten").
 * Deletes the authenticated user's account and all associated personal data.
 *
 * If the user is the sole OWNER of an organisation with no other members,
 * that organisation (and all its websites, scans, violations) is also deleted.
 *
 * DELETE /api/account
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Find all memberships for this user
  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: { memberships: true },
      },
    },
  });

  // Collect org IDs where this user is the sole OWNER with no other members
  const orgsToDelete: string[] = [];
  for (const m of memberships) {
    const org = m.organization;
    const isSoleOwner =
      m.role === "OWNER" &&
      org.memberships.length === 1 &&
      org.memberships[0]?.userId === userId;
    if (isSoleOwner) {
      orgsToDelete.push(org.id);
    }
  }

  // Delete solo-owned orgs (cascade removes websites, scans, violations via Prisma relations)
  if (orgsToDelete.length > 0) {
    await db.organization.deleteMany({ where: { id: { in: orgsToDelete } } });
  }

  // Delete the user record (cascade removes memberships, accounts, sessions, verification tokens)
  await db.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true }, { status: 200 });
}
