import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddWebsiteForm } from "./add-website-form";
import { getPlanLimits } from "@/lib/plans";

export const metadata = { title: "Add Website" };

export default async function NewWebsitePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;
  const limits = getPlanLimits(org.plan);
  const websiteCount = await db.website.count({
    where: { organizationId: org.id, isCompetitor: false },
  });

  const atLimit = websiteCount >= limits.websites;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/websites">
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Websites
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add website</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add a website to start scanning for accessibility issues.
        </p>
      </div>

      {atLimit ? (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-6 text-center space-y-3">
          <p className="font-medium">Website limit reached</p>
          <p className="text-sm text-muted-foreground">
            Your {org.plan} plan allows up to {limits.websites} website
            {limits.websites !== 1 ? "s" : ""}. Upgrade to add more.
          </p>
          <Button asChild>
            <Link href="/settings/billing">Upgrade plan</Link>
          </Button>
        </div>
      ) : (
        <AddWebsiteForm organizationId={org.id} />
      )}
    </div>
  );
}
