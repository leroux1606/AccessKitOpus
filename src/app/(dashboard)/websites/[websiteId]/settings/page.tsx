import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { canManageWebsites, canConfigureOrg } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import { VerificationPanel } from "./verification-panel";
import { WebsiteSettingsForm } from "./website-settings-form";
import { DeleteWebsiteButton } from "./delete-website-button";
import { BadgePanel } from "./badge-panel";
import { ScanButton } from "@/components/dashboard/scan-button";
import { buildEmbedSnippets } from "@/lib/badges";

export const metadata = { title: "Website Settings" };

interface SettingsPageProps {
  params: Promise<{ websiteId: string }>;
}

export default async function WebsiteSettingsPage({ params }: SettingsPageProps) {
  const { websiteId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
    include: { scanSchedule: true },
  });

  if (!website) notFound();

  const canManage = canManageWebsites(membership.role);
  // Delete is a destructive, non-recoverable action — restrict to OWNER/ADMIN
  const canDelete = canConfigureOrg(membership.role);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/websites/${websiteId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Back to website
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website settings</h1>
          <p className="text-sm text-muted-foreground">{website.name}</p>
        </div>
        <ScanButton
          websiteId={websiteId}
          disabled={!website.verified}
          disabledReason={!website.verified ? "Verify website ownership before scanning" : undefined}
        />
      </div>

      {/* Verification */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ownership verification</CardTitle>
            {website.verified ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                Not verified
              </Badge>
            )}
          </div>
          <CardDescription>
            Verify that you own this website before scanning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerificationPanel
            websiteId={website.id}
            websiteUrl={website.url}
            verificationToken={website.verificationToken}
            isVerified={website.verified}
            verificationMethod={website.verificationMethod}
          />
        </CardContent>
      </Card>

      {/* Scan settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan configuration</CardTitle>
          <CardDescription>
            Configure how and when this website is scanned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebsiteSettingsForm
            websiteId={website.id}
            currentName={website.name}
            currentFrequency={website.scanFrequency}
            currentStandards={website.standards as string[]}
            currentScheduledHour={website.scanSchedule?.scheduledHour ?? 9}
            currentScheduledDay={website.scanSchedule?.scheduledDay ?? null}
            orgPlan={membership.organization.plan}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      {/* Public badge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public badge</CardTitle>
          <CardDescription>
            Embed your accessibility score in a README or on your live site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BadgePanel
            websiteId={website.id}
            initialEnabled={website.publicBadgeEnabled}
            snippets={buildEmbedSnippets(
              process.env.NEXT_PUBLIC_APP_URL ??
                process.env.NEXTAUTH_URL ??
                "https://app.accesskit.io",
              website.id,
            )}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      {/* Danger zone — only OWNER/ADMIN can delete a website */}
      {canDelete && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete website</p>
                <p className="text-xs text-muted-foreground">
                  Permanently deletes this website and all its scans, pages, and violations. This cannot be undone.
                </p>
              </div>
              <DeleteWebsiteButton websiteId={website.id} websiteName={website.name} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
