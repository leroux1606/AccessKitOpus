import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLAN_NAMES, PLAN_PRICES, getPlanLimits } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BillingActions } from "@/components/dashboard/billing-actions";
import { PlanType } from "@prisma/client";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;
  const limits = getPlanLimits(org.plan);
  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN";
  const prices = PLAN_PRICES[org.plan as keyof typeof PLAN_PRICES];

  const [websiteCount, teamCount] = await Promise.all([
    db.website.count({ where: { organizationId: org.id, isCompetitor: false } }),
    db.membership.count({ where: { organizationId: org.id } }),
  ]);

  // Determine available upgrades
  const planOrder: PlanType[] = ["STARTER", "PROFESSIONAL", "AGENCY"];
  const currentIndex = planOrder.indexOf(org.plan as PlanType);
  const upgradePlans = planOrder.slice(currentIndex + 1);

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
        <h1 className="text-2xl font-bold tracking-tight">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and usage</p>
      </div>

      {/* Status alerts */}
      {org.subscriptionStatus === "PAST_DUE" && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Payment failed</p>
              <p className="text-sm text-muted-foreground">
                Your last payment failed. Please update your payment method to keep your account active.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {org.subscriptionStatus === "CANCELED" && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-400">Subscription canceled</p>
              <p className="text-sm text-muted-foreground">
                Your subscription has been canceled. You&apos;re on the free Starter plan with limited features.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Current plan</CardTitle>
              <CardDescription>
                {org.subscriptionStatus === "TRIALING"
                  ? `Free trial — ends ${org.trialEndsAt ? formatDate(org.trialEndsAt) : "soon"}`
                  : org.subscriptionStatus === "ACTIVE"
                    ? `$${prices?.monthly ?? 0}/month`
                    : org.subscriptionStatus}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {org.subscriptionStatus === "ACTIVE" && (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              )}
              <Badge variant="default" className="text-sm px-3 py-1">
                {PLAN_NAMES[org.plan]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              {
                label: "Websites",
                used: websiteCount,
                limit: limits.websites === Infinity ? "∞" : limits.websites,
              },
              {
                label: "Team seats",
                used: teamCount,
                limit: limits.teamSeats === Infinity ? "∞" : limits.teamSeats,
              },
              {
                label: "Pages/scan",
                used: null,
                limit: limits.pagesPerScan === Infinity ? "∞" : limits.pagesPerScan,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold">
                  {stat.used !== null ? `${stat.used} / ` : "Up to "}
                  {stat.limit}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing actions (client component for checkout/portal redirects) */}
      {isAdmin && (
        <BillingActions
          currentPlan={org.plan}
          subscriptionStatus={org.subscriptionStatus}
          hasStripeCustomer={!!org.stripeCustomerId}
          hasPaystackSubscription={!!org.paystackSubscriptionCode}
          upgradePlans={upgradePlans}
        />
      )}

      {/* Plan comparison link */}
      <div className="text-center">
        <Link
          href="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          View full plan comparison
        </Link>
      </div>
    </div>
  );
}
