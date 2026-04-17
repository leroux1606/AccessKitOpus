"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { getPlanLimits } from "@/lib/plans";
import { Role } from "@prisma/client";

async function getOrgAndRole() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) throw new Error("No organization found");

  return { membership, org: membership.organization, userId: session.user.id };
}

export async function inviteTeamMember(formData: FormData) {
  const { membership, org, userId } = await getOrgAndRole();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can invite team members." };
  }

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const role = (formData.get("role") as Role) ?? "MEMBER";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (!["ADMIN", "MEMBER"].includes(role)) {
    return { error: "Invalid role." };
  }

  // Plan seat limit check
  const limits = getPlanLimits(org.plan);
  const [memberCount, pendingCount] = await Promise.all([
    db.membership.count({ where: { organizationId: org.id } }),
    db.invitation.count({
      where: { organizationId: org.id, accepted: false, expiresAt: { gt: new Date() } },
    }),
  ]);

  if (limits.teamSeats !== Infinity && memberCount + pendingCount >= limits.teamSeats) {
    return {
      error: `Your ${org.plan.charAt(0) + org.plan.slice(1).toLowerCase()} plan allows ${limits.teamSeats} seat${limits.teamSeats === 1 ? "" : "s"}. Upgrade to add more team members.`,
      upgradeRequired: true,
    };
  }

  // Check if already a member
  const existingMember = await db.membership.findFirst({
    where: { organizationId: org.id, user: { email } },
  });
  if (existingMember) {
    return { error: "This person is already a member of your organization." };
  }

  // Check for existing pending invite
  const existingInvite = await db.invitation.findFirst({
    where: {
      organizationId: org.id,
      email,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    return { error: "An invitation has already been sent to this email address." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await db.invitation.create({
    data: {
      organizationId: org.id,
      email,
      role,
      invitedById: userId,
      expiresAt,
    },
    include: { invitedBy: { select: { name: true, email: true } } },
  });

  // Send invitation email
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
      const inviteUrl = `${baseUrl}/invite/${invitation.token}`;
      const inviterName = invitation.invitedBy.name ?? invitation.invitedBy.email;

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
        to: email,
        subject: `You've been invited to join ${org.name} on AccessKit`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
            <div style="margin-bottom:24px">
              <span style="font-weight:700;font-size:18px">AccessKit</span>
            </div>
            <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">
              You've been invited to ${org.name}
            </h1>
            <p style="color:#6b7280;margin-bottom:24px">
              ${inviterName} has invited you to join <strong>${org.name}</strong> on AccessKit
              as a <strong>${role.toLowerCase()}</strong>.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Accept invitation
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">
              This invitation expires in 7 days. If you weren't expecting this invitation, you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch {
      // Email failed — invitation still created, user can be told to check
    }
  }

  revalidatePath("/team");
  return { success: true };
}

export async function revokeInvitation(invitationId: string) {
  const { membership, org } = await getOrgAndRole();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can revoke invitations." };
  }

  await db.invitation.delete({
    where: { id: invitationId, organizationId: org.id },
  });

  revalidatePath("/team");
  return { success: true };
}

export async function removeMember(membershipId: string) {
  const { membership, org, userId } = await getOrgAndRole();

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can remove team members." };
  }

  const target = await db.membership.findFirst({
    where: { id: membershipId, organizationId: org.id },
  });

  if (!target) return { error: "Member not found." };
  if (target.userId === userId) return { error: "You cannot remove yourself." };
  if (target.role === "OWNER") return { error: "The organization owner cannot be removed." };

  await db.membership.delete({ where: { id: membershipId } });

  revalidatePath("/team");
  return { success: true };
}
