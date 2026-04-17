import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Palette } from "lucide-react";
import { WhiteLabelForm } from "@/components/dashboard/white-label-form";

export const metadata = { title: "White Label" };

export default async function WhiteLabelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const isAgencyOrHigher = ["AGENCY", "ENTERPRISE"].includes(membership.organization.plan);

  const whiteLabel = (membership.organization.whiteLabel as {
    companyName?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
  }) ?? {};

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">White Label</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Custom branding for client-facing reports and portals
        </p>
      </div>

      {!isAgencyOrHigher ? (
        <Card className="border-orange-500/20 bg-orange-500/10">
          <CardContent className="p-6 text-center space-y-3">
            <Palette className="h-8 w-8 mx-auto text-orange-400" aria-hidden="true" />
            <p className="font-medium">White label requires Agency plan or higher</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to remove AccessKit branding from reports and client portals.
            </p>
            <Button asChild>
              <Link href="/settings/billing">Upgrade plan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <WhiteLabelForm
          initial={{
            companyName: whiteLabel.companyName ?? null,
            primaryColor: whiteLabel.primaryColor ?? null,
            secondaryColor: whiteLabel.secondaryColor ?? null,
            logoUrl: whiteLabel.logoUrl ?? null,
          }}
        />
      )}
    </div>
  );
}
