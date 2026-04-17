import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Users } from "lucide-react";
import { AcceptInviteButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export const metadata = { title: "Team Invitation — AccessKit" };

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true, plan: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) notFound();

  // Already accepted
  if (invitation.accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
            <h1 className="text-xl font-bold">Invitation already accepted</h1>
            <p className="text-sm text-muted-foreground">
              This invitation has already been used. You&apos;re already a member of{" "}
              <strong>{invitation.organization.name}</strong>.
            </p>
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (new Date() > invitation.expiresAt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">
              This invitation expired. Ask{" "}
              <strong>{invitation.invitedBy.name ?? invitation.invitedBy.email}</strong> to send a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await auth();

  // Not logged in — redirect to login with callbackUrl
  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  // Check if already a member
  const existingMembership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: invitation.organizationId },
  });

  if (existingMembership) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
            <h1 className="text-xl font-bold">Already a member</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re already a member of <strong>{invitation.organization.name}</strong>.
            </p>
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inviterName = invitation.invitedBy.name ?? invitation.invitedBy.email;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-[hsl(262,83%,68%)] opacity-[0.06] blur-[120px]" />
      </div>

      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-lg flex items-center justify-center shadow-lg shadow-[hsl(262,83%,68%)]/20">
                <span className="text-white font-bold text-sm" aria-hidden="true">AK</span>
              </div>
              <span className="font-bold text-lg text-foreground">AccessKit</span>
            </div>
          </div>

          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>

          <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
          <CardDescription className="mt-1">
            <strong>{inviterName}</strong> has invited you to join{" "}
            <strong>{invitation.organization.name}</strong> on AccessKit
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Details */}
          <div className="rounded-lg border border-border/50 bg-muted/30 divide-y">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{invitation.organization.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Your role</span>
              <Badge variant="secondary" className="capitalize">
                {invitation.role.toLowerCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium">{inviterName}</span>
            </div>
          </div>

          <AcceptInviteButton token={token} invitationId={invitation.id} />

          <p className="text-xs text-center text-muted-foreground">
            Signed in as <strong>{session.user.email}</strong>.{" "}
            <Link href="/api/auth/signout" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Sign out
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
