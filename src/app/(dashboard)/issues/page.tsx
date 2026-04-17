import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { AlertTriangle, Grid3X3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrossWebsiteTable } from "@/components/issues/cross-website-table";

export const metadata = { title: "Issues" };

interface IssuesPageProps {
  searchParams: Promise<{ status?: string; severity?: string; website?: string }>;
}

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const filters = await searchParams;

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const statusFilter = filters.status as string | undefined;
  const severityFilter = filters.severity as string | undefined;
  const websiteFilter = filters.website as string | undefined;

  const violations = await db.violation.findMany({
    where: {
      website: {
        organizationId: membership.organizationId,
        ...(websiteFilter ? { id: websiteFilter } : {}),
      },
      ...(statusFilter
        ? { status: statusFilter as never }
        : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
      ...(severityFilter ? { severity: severityFilter as never } : {}),
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { website: true, page: true, assignedTo: true },
  });

  // Status counts for tabs
  const statusCounts = await db.violation.groupBy({
    by: ["status"],
    where: {
      website: { organizationId: membership.organizationId },
      ...(websiteFilter ? { websiteId: websiteFilter } : {}),
    },
    _count: { id: true },
  });
  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.id])
  );

  // Severity counts
  const severityCounts = await db.violation.groupBy({
    by: ["severity"],
    where: {
      website: { organizationId: membership.organizationId },
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    _count: { id: true },
  });
  const countBySeverity = Object.fromEntries(
    severityCounts.map((s) => [s.severity, s._count.id])
  );

  // Websites for filter
  const websites = await db.website.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const openCount = (countByStatus["OPEN"] ?? 0) + (countByStatus["IN_PROGRESS"] ?? 0);
  const fixedCount = (countByStatus["FIXED"] ?? 0) + (countByStatus["VERIFIED"] ?? 0);
  const dismissedCount = (countByStatus["WONT_FIX"] ?? 0) + (countByStatus["FALSE_POSITIVE"] ?? 0);

  const serializedViolations = violations.map((v) => ({
    id: v.id,
    description: v.description,
    ruleId: v.ruleId,
    severity: v.severity,
    status: v.status,
    category: v.category,
    firstDetectedAt: v.firstDetectedAt.toISOString(),
    websiteId: v.websiteId,
    website: { name: v.website.name },
    assignedTo: v.assignedTo
      ? { id: v.assignedTo.id, name: v.assignedTo.name, email: v.assignedTo.email, image: v.assignedTo.image }
      : null,
  }));

  // Build query param helper
  function tabHref(tab: string) {
    const p = new URLSearchParams();
    if (tab === "open") { /* default, no status param */ }
    else if (tab === "fixed") p.set("status", "FIXED");
    else if (tab === "dismissed") p.set("status", "WONT_FIX");
    else if (tab === "all") p.set("status", "all");
    if (websiteFilter) p.set("website", websiteFilter);
    const qs = p.toString();
    return `/issues${qs ? `?${qs}` : ""}`;
  }

  const activeTab = !statusFilter ? "open" : statusFilter === "FIXED" ? "fixed" : statusFilter === "WONT_FIX" ? "dismissed" : "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage accessibility issues across all websites
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/issues/matrix">
            <Grid3X3 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Priority Matrix
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b">
        {[
          { key: "open", label: "Open", count: openCount },
          { key: "fixed", label: "Fixed", count: fixedCount },
          { key: "dismissed", label: "Dismissed", count: dismissedCount },
          { key: "all", label: "All", count: Object.values(countByStatus).reduce((a, b) => a + b, 0) },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-[hsl(262,83%,68%)] text-[hsl(262,80%,80%)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
          </Link>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity pills */}
        <div className="flex flex-wrap gap-2">
          {(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"] as const).map((sev) => {
            const count = countBySeverity[sev] ?? 0;
            if (count === 0) return null;
            const isActive = severityFilter === sev;
            return (
              <Link
                key={sev}
                href={`/issues?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(websiteFilter ? { website: websiteFilter } : {}),
                  ...(isActive ? {} : { severity: sev }),
                }).toString()}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              >
                <Badge
                  variant={
                    sev === "CRITICAL"
                      ? "critical"
                      : sev === "SERIOUS"
                      ? "serious"
                      : sev === "MODERATE"
                      ? "moderate"
                      : "minor"
                  }
                  className={`cursor-pointer hover:opacity-80 ${isActive ? "ring-2 ring-ring" : ""}`}
                >
                  {count} {sev.toLowerCase()}
                </Badge>
              </Link>
            );
          })}
        </div>

        {/* Website filter */}
        {websites.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Website:</span>
            <div className="flex gap-1">
              <Link
                href={`/issues?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(severityFilter ? { severity: severityFilter } : {}),
                }).toString()}`}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  !websiteFilter ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </Link>
              {websites.map((w) => (
                <Link
                  key={w.id}
                  href={`/issues?${new URLSearchParams({
                    ...(statusFilter ? { status: statusFilter } : {}),
                    ...(severityFilter ? { severity: severityFilter } : {}),
                    website: w.id,
                  }).toString()}`}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    websiteFilter === w.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {(statusFilter || severityFilter || websiteFilter) && (
          <Link href="/issues" className="text-xs text-muted-foreground hover:underline ml-auto">
            Clear all filters
          </Link>
        )}
      </div>

      {violations.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/30 p-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold mb-1">No issues found</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {statusFilter || severityFilter || websiteFilter
              ? "No issues match your current filters. Try clearing the criteria."
              : "Run a scan on one of your websites to detect accessibility issues."}
          </p>
          {!statusFilter && !severityFilter && !websiteFilter && (
            <Button asChild size="sm" className="mt-4">
              <Link href="/websites">Go to Websites</Link>
            </Button>
          )}
        </div>
      ) : (
        <CrossWebsiteTable violations={serializedViolations} />
      )}
    </div>
  );
}
