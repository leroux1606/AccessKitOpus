import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, scoreToColor } from "@/lib/utils";
import { ScanPoller } from "./scan-poller";

interface ScanDetailPageProps {
  params: Promise<{ websiteId: string; scanId: string }>;
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { websiteId, scanId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) notFound();

  const scan = await db.scan.findUnique({
    where: { id: scanId, websiteId },
    include: {
      pages: {
        include: {
          violations: {
            orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: { violationCount: "desc" },
      },
    },
  });
  if (!scan) notFound();

  const isActive = scan.status === "QUEUED" || scan.status === "RUNNING";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/websites/${websiteId}`}>
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          {website.name}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Results</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(scan.createdAt)} · Triggered manually
          </p>
        </div>
        <ScanStatusBadge status={scan.status} />
      </div>

      {/* Live poller — replaces itself with results when scan completes */}
      {isActive && (
        <ScanPoller
          scanId={scanId}
          websiteId={websiteId}
          initialStatus={scan.status}
        />
      )}

      {/* Results */}
      {scan.status === "COMPLETED" && (
        <>
          {/* Score summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card className="sm:col-span-1">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Score</CardDescription>
                <CardTitle
                  className={`text-4xl font-bold ${scoreToColor(scan.score)}`}
                  aria-label={`Accessibility score: ${scan.score ?? "—"} out of 100`}
                >
                  {scan.score ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>

            {(
              [
                { label: "Critical", value: scan.criticalCount, color: "text-red-400" },
                { label: "Serious", value: scan.seriousCount, color: "text-orange-400" },
                { label: "Moderate", value: scan.moderateCount, color: "text-yellow-400" },
                { label: "Minor", value: scan.minorCount, color: "text-blue-400" },
              ] as const
            ).map(({ label, value, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">{label}</CardDescription>
                  <CardTitle
                    className={`text-3xl font-bold ${(value ?? 0) > 0 ? color : "text-muted-foreground"}`}
                  >
                    {value ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{scan.pagesScanned} page{scan.pagesScanned !== 1 ? "s" : ""} scanned</span>
            {scan.duration && (
              <span>Duration: {(scan.duration / 1000).toFixed(1)}s</span>
            )}
            <span>Total issues: {scan.totalViolations ?? 0}</span>
          </div>

          {/* Page-by-page breakdown */}
          {scan.pages.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Issues by page</h2>
              {scan.pages.map((page) => (
                <Card key={page.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-medium truncate">
                          {page.title || page.url}
                        </CardTitle>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground truncate block"
                        >
                          {page.url}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`font-bold ${scoreToColor(page.score)}`}>
                          {page.score ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {page.violationCount} issue{page.violationCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  {page.violations.length > 0 && (
                    <CardContent className="p-0">
                      <ul role="list" className="divide-y border-t">
                        {page.violations.map((v) => (
                          <li key={v.id} className="px-6 py-4 space-y-2">
                            <div className="flex items-start gap-3">
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
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-sm font-medium">{v.description}</p>
                                <p className="text-xs text-muted-foreground">{v.helpText}</p>
                                {v.wcagCriterion && (
                                  <p className="text-xs text-muted-foreground">
                                    WCAG {v.wcagCriterion} (Level {v.wcagLevel})
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Offending element */}
                            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                              <code>{v.htmlElement}</code>
                            </pre>
                            {/* Fix suggestion */}
                            {v.fixSuggestion && (
                              <details className="group">
                                <summary className="text-xs font-medium text-primary cursor-pointer hover:underline">
                                  How to fix
                                </summary>
                                <pre className="mt-2 text-xs bg-green-500/10 border border-green-500/20 text-green-300 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                                  {v.fixSuggestion}
                                </pre>
                              </details>
                            )}
                            {v.helpUrl && (
                              <a
                                href={v.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                Learn more →
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" aria-hidden="true" />
                <p className="font-medium">No issues found</p>
                <p className="text-sm">All pages passed the accessibility checks.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Failed state */}
      {scan.status === "FAILED" && (
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="h-10 w-10 mx-auto mb-3 text-destructive" aria-hidden="true" />
            <p className="font-medium text-destructive">Scan failed</p>
            {scan.errorMessage && (
              <p className="text-sm text-muted-foreground mt-1">{scan.errorMessage}</p>
            )}
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/websites/${websiteId}`}>Back to website</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancelled state */}
      {scan.status === "CANCELLED" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Ban className="h-10 w-10 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Scan cancelled</p>
            <p className="text-sm text-muted-foreground mt-1">
              This scan was cancelled before it completed. No results were recorded.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/websites/${websiteId}`}>Back to website</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED")
    return (
      <Badge variant="success" className="gap-1.5">
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Completed
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="destructive" className="gap-1.5">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Failed
      </Badge>
    );
  if (status === "RUNNING")
    return (
      <Badge variant="secondary" className="gap-1.5 animate-pulse">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Running
      </Badge>
    );
  if (status === "CANCELLED")
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
        Cancelled
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1.5">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      Queued
    </Badge>
  );
}
