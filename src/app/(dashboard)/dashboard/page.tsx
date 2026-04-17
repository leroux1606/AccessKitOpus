import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Globe, Plus, AlertTriangle,
  Clock, ArrowRight, Zap, ShieldCheck, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, scoreToColor } from "@/lib/utils";
import { getActiveMembership } from "@/lib/get-active-org";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;
  // Derive display name: prefer real name, fall back to email prefix (jan.leroux0 → Jan)
  const rawName =
    session.user.name?.split(" ")[0] ??
    session.user.email?.split("@")[0]?.split(".")[0]?.replace(/\d+/g, "") ??
    "there";
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const [websites, recentScans, openViolationsCount] = await Promise.all([
    db.website.findMany({
      where: { organizationId: org.id, isCompetitor: false },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, url: true, currentScore: true, lastScanAt: true, verified: true },
    }),
    db.scan.findMany({
      where: { website: { organizationId: org.id }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, score: true, createdAt: true, website: { select: { name: true } } },
    }),
    db.violation.count({
      where: { website: { organizationId: org.id }, status: "OPEN" },
    }),
  ]);

  const hasWebsites = websites.length > 0;

  const trialDaysLeft = org.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {hasWebsites ? "Dashboard" : `Welcome, ${userName}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasWebsites ? org.name : "Let's get your first website set up"}
          </p>
        </div>
        {hasWebsites && (
          <Button asChild>
            <Link href="/websites/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add website
            </Link>
          </Button>
        )}
      </div>

      {/* Trial banner */}
      {org.subscriptionStatus === "TRIALING" && trialDaysLeft !== null && (
        <div
          role="status"
          className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5 flex items-center gap-3"
        >
          <Clock className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
          <p className="text-sm flex-1">
            Free trial —{" "}
            <strong className="text-foreground">
              {trialDaysLeft === 0 ? "ends today" : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`}
            </strong>
            . All features unlocked.
          </p>
          <Button size="sm" variant="ghost" className="flex-shrink-0 text-primary hover:text-primary hover:bg-primary/10 h-7 px-3 text-xs" asChild>
            <Link href="/settings/billing">Upgrade</Link>
          </Button>
        </div>
      )}

      {hasWebsites ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Websites monitored</CardDescription>
                <CardTitle className="text-3xl">{websites.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open issues</CardDescription>
                <CardTitle className={`text-3xl ${openViolationsCount > 0 ? "text-destructive" : "text-green-400"}`}>
                  {openViolationsCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recent scans</CardDescription>
                <CardTitle className="text-3xl">{recentScans.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Website list */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Your websites</CardTitle>
                  <CardDescription>Latest scan scores</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/websites">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul role="list" className="divide-y">
                {websites.map((website) => (
                  <li key={website.id}>
                    <Link
                      href={`/websites/${website.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{website.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{website.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        {website.currentScore !== null ? (
                          <span className={`text-lg font-bold ${scoreToColor(website.currentScore)}`}>
                            {website.currentScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No scan yet</span>
                        )}
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {formatRelativeTime(website.lastScanAt)}
                        </span>
                        {!website.verified && (
                          <Badge variant="warning" className="text-[10px]">Unverified</Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        /* ── Empty / onboarding state ── */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* Left: main CTA card */}
          <div className="lg:col-span-3 rounded-xl border border-border/50 bg-card/40 p-8 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] flex items-center justify-center mb-5 shadow-lg shadow-[hsl(262,83%,68%)]/20"
              aria-hidden="true"
            >
              <Globe className="h-7 w-7 text-white" />
            </div>

            <h2 className="text-xl font-semibold mb-2">Add your first website</h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-7 leading-relaxed">
              Enter your website URL and AccessKit will scan every page for accessibility violations — then show you exactly how to fix them.
            </p>

            <Button asChild size="lg" className="w-full sm:w-auto px-10">
              <Link href="/websites/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add website
              </Link>
            </Button>

            <Link
              href="/docs"
              className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Read the documentation
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Right: feature list */}
          <div className="lg:col-span-2 space-y-3">
            {[
              {
                icon: AlertTriangle,
                color: "text-orange-400",
                bg: "bg-orange-400/10",
                title: "Detect violations",
                desc: "WCAG 2.1/2.2, Section 508, and EN 301 549 — scanned automatically across every page.",
              },
              {
                icon: Zap,
                color: "text-primary",
                bg: "bg-primary/10",
                title: "Get code-level fixes",
                desc: "Every issue comes with copy-paste HTML fixes, not generic tips.",
              },
              {
                icon: BarChart3,
                color: "text-blue-400",
                bg: "bg-blue-400/10",
                title: "Track your score",
                desc: "See your accessibility score improve scan by scan with a trend chart.",
              },
              {
                icon: ShieldCheck,
                color: "text-green-400",
                bg: "bg-green-400/10",
                title: "Prove compliance",
                desc: "Generate VPAT-style reports and shareable compliance evidence for clients.",
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="flex gap-3 rounded-lg border border-border/40 bg-card/30 p-4">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
