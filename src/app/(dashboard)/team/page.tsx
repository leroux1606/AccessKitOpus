import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InviteForm } from "@/components/dashboard/invite-form";
import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { MemberList } from "@/components/dashboard/member-list";
import { getPlanLimits, PLAN_NAMES } from "@/lib/plans";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";
  const limits = getPlanLimits(org.plan);

  const [members, pendingInvitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: org.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: {
        organizationId: org.id,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
      include: { invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalOccupied = members.length + pendingInvitations.length;
  const seatLimitReached =
    limits.teamSeats !== Infinity && totalOccupied >= limits.teamSeats;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {limits.teamSeats !== Infinity && (
              <span> · {limits.teamSeats} seat{limits.teamSeats !== 1 ? "s" : ""} on {PLAN_NAMES[org.plan]}</span>
            )}
          </p>
        </div>
      </div>

      {/* Invite section */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a team member</CardTitle>
            <CardDescription>
              They&apos;ll receive an email with a link to join your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm
              seatLimitReached={seatLimitReached}
              plan={PLAN_NAMES[org.plan]}
            />
          </CardContent>
        </Card>
      )}

      {/* Members + pending invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            People with access to {org.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul role="list" className="divide-y">
            <MemberList
              members={members}
              currentUserId={session.user.id}
              canManage={canManage}
            />
            <PendingInvitations
              invitations={pendingInvitations}
              canManage={canManage}
            />
          </ul>
        </CardContent>
      </Card>

      {/* Role guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {[
              { role: "Owner", desc: "Full access. Can manage billing, team, settings, and all data." },
              { role: "Admin", desc: "Can invite and remove members. Full access to websites, scans, and issues." },
              { role: "Member", desc: "Can view and manage websites, scans, and issues. Cannot manage team or billing." },
            ].map(({ role, desc }) => (
              <div key={role} className="flex gap-3">
                <span className="font-medium w-16 flex-shrink-0">{role}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
