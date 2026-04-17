"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function acceptInvitation(invitationId: string, token: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthenticated" };

  const invitation = await db.invitation.findUnique({
    where: { id: invitationId, token },
  });

  if (!invitation) return { error: "Invitation not found." };
  if (invitation.accepted) return { error: "Invitation already accepted." };
  if (new Date() > invitation.expiresAt) return { error: "Invitation has expired." };

  // Check not already a member
  const existing = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: invitation.organizationId },
  });
  if (existing) return { error: "You are already a member of this organization." };

  await db.$transaction([
    db.membership.create({
      data: {
        userId: session.user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    }),
    db.invitation.update({
      where: { id: invitationId },
      data: { accepted: true },
    }),
  ]);

  return { success: true };
}
