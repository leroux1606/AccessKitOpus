import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  History,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/dashboard/scan-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreTrendChart } from "@/components/dashboard/score-trend-chart";
import { formatDate, formatRelativeTime, scoreToColor } from "@/lib/utils";

interface WebsitePageProps {
  params: Promise<{ websiteId: string }>;
}

export async function generateMetadata({ params }: WebsitePageProps) {
  const { websiteId } = await params;
  const website = await db.website.findUnique({ where: { id: websiteId } });
  return { title: website?.name ?? "Website" };
}

export default async function WebsitePage({ params }: WebsitePageProps) {
  const { websiteId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          score: true,
          pagesScanned: true,
          totalViolations: true,
          createdAt: true,
        },
      },
    },
  });

  if (!website) notFound();

  const [openIssues, criticalIssues, recentViolations] = await Promise.all([
    db.violation.count({ where: { websiteId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.violation.count({ where: { websiteId, status: { in: ["OPEN", "IN_PROGRESS"] }, severity: "CRITICAL" } }),
    db.violation.findMany({
      where: { websiteId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ severity: "asc" }, { firstDetectedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        severity: true,
        description: true,
        cssSelector: true,
      },
    }),
  ]);

  // Build score trend data for chart (oldest → newest, completed scans only)
  const scoreTrendData = website.scans
    .filter((s) => s.status === "COMPLETED" && s.score !== null)
    .slice()
    .reverse()
    .map((s) => ({
      date: formatDate(s.createdAt),
      score: s.score as number,
    }));

  const subNavLinks = [
    { href: `/websites/${websiteId}`, label: "Overview" },
    { href: `/websites/${websiteId}/issues`, label: `Issues (${openIssues})` },
    { href: `/websites/${websiteId}/scans`, label: "History" },
    { href: `/websites/${websiteId}/settings`, label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/websites">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Websites
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{website.name}</h1>
            {website.verified ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Link href={`/websites/${websiteId}/settings`}>
                <Badge variant="warning" className="cursor-pointer hover:opacity-80">Unverified</Badge>
              </Link>
            )}
          </div>
          <a
            href={website.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {website.url}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/websites/${websiteId}/settings`}>
              <Settings className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Settings
            </Link>
          </Button>
          <ScanButton
            websiteId={websiteId}
            disabled={!website.verified}
            disabledReason={!website.verified ? "Verify website ownership before scanning" : undefined}
          />
        </div>
      </div>

      {/* Sub-nav */}
      <nav aria-label="Website sections" className="flex gap-1 border-b">
        {subNavLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-muted-foreground -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Verification alert */}
      {!website.verified && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-sm">Verify website ownership</p>
              <p className="text-xs text-muted-foreground">
                Add a meta tag, DNS record, or file to enable scanning.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/websites/${websiteId}/settings`}>Verify</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Accessibility score</CardDescription>
            <CardTitle
              className={`text-3xl font-bold ${scoreToColor(website.currentScore)}`}
              aria-label={
                website.currentScore !== null
                  ? `Score: ${website.currentScore} / 100`
                  : "No score yet"
              }
            >
              {website.currentScore ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Open issues</CardDescription>
            <CardTitle className={`text-3xl font-bold ${openIssues > 0 ? "text-destructive" : "text-green-400"}`}>
              {openIssues}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Critical issues</CardDescription>
            <CardTitle className={`text-3xl font-bold ${criticalIssues > 0 ? "text-red-400" : "text-green-400"}`}>
              {criticalIssues}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Last scan</CardDescription>
            <CardTitle className="text-lg font-semibold">
              {website.lastScanAt ? formatRelativeTime(website.lastScanAt) : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Score trend chart */}
      {scoreTrendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score over time</CardTitle>
            <CardDescription>Accessibility score across the last {scoreTrendData.length} completed scans</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={scoreTrendData} />
          </CardContent>
        </Card>
      )}

      {/* Top issues */}
      {recentViolations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Top issues to fix</CardTitle>
                <CardDescription>Highest severity open issues</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/websites/${websiteId}/issues`}>
                  View all {openIssues}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul role="list" className="divide-y">
              {recentViolations.map((v) => (
                <li key={v.id} className="flex items-start gap-3 px-6 py-3">
                  <Badge
                    variant={
                      v.severity === "CRITICAL"
                        ? "critical"
                        : v.severity === "SERIOUS"
                        ? "serious"
                        : v.severity === "MODERATE"
                        ? "moderate"
                        : "minor"
                    }
                    className="flex-shrink-0 mt-0.5"
                  >
                    {v.severity.toLowerCase()}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.description}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{v.cssSelector}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Scan history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent scans</CardTitle>
              <CardDescription>
                {website.scans.length > 0
                  ? `Showing ${website.scans.slice(0, 5).length} most recent scan${website.scans.slice(0, 5).length !== 1 ? "s" : ""}`
                  : "No scans yet"}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/websites/${websiteId}/scans`}>
                <History className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Full history
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {website.scans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm">No scans yet. Run your first scan to see results.</p>
            </div>
          ) : (
            <ul role="list" className="divide-y -mx-6">
              {website.scans.slice(0, 5).map((scan) => (
                <li key={scan.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      Score: <span className={scoreToColor(scan.score)}>{scan.score ?? "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(scan.createdAt)} · {scan.pagesScanned} pages
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan.totalViolations !== null && (
                      <span className="text-sm text-destructive font-medium">
                        {scan.totalViolations} issues
                      </span>
                    )}
                    <Badge
                      variant={
                        scan.status === "COMPLETED"
                          ? "success"
                          : scan.status === "FAILED"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {scan.status.toLowerCase()}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
