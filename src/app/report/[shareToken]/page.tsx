import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { formatDate, scoreToColor } from "@/lib/utils";
import { buildScanReportData } from "@/lib/report-data";

interface SharedReportPageProps {
  params: Promise<{ shareToken: string }>;
}

export async function generateMetadata({ params }: SharedReportPageProps) {
  const { shareToken } = await params;
  const report = await db.report.findUnique({
    where: { shareToken },
    include: { website: true },
  });
  if (!report) return { title: "Report Not Found" };
  return { title: `Accessibility Report — ${report.website.name}` };
}

export default async function SharedReportPage({ params }: SharedReportPageProps) {
  const { shareToken } = await params;

  const report = await db.report.findUnique({
    where: { shareToken },
    include: {
      website: { include: { organization: true } },
      scan: true,
    },
  });

  if (!report || !report.isPublic) notFound();

  // Check expiry
  if (report.expiresAt && new Date() > report.expiresAt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <p className="text-lg font-semibold mb-2">Report expired</p>
            <p className="text-sm text-muted-foreground">
              This shared report link has expired. Contact the report owner for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await buildScanReportData(report.scanId);
  if (!data) notFound();

  const scan = report.scan;
  const org = report.website.organization;

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-md flex items-center justify-center shadow-md shadow-[hsl(262,83%,68%)]/15">
              <span className="text-white font-bold text-xs">AK</span>
            </div>
            <span className="font-bold text-foreground">AccessKit</span>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Shared Report
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{report.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.websiteUrl} · Scanned {formatDate(scan.createdAt)}
            {org.whiteLabel ? "" : ` · ${org.name}`}
          </p>
        </div>

        {/* Score + severity summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Score</CardDescription>
              <CardTitle className={`text-4xl font-bold ${scoreToColor(scan.score)}`}>
                {scan.score ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          {([
            { label: "Critical", value: scan.criticalCount, color: "text-red-400" },
            { label: "Serious", value: scan.seriousCount, color: "text-orange-400" },
            { label: "Moderate", value: scan.moderateCount, color: "text-yellow-400" },
            { label: "Minor", value: scan.minorCount, color: "text-blue-400" },
          ] as const).map(({ label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{label}</CardDescription>
                <CardTitle className={`text-3xl font-bold ${(value ?? 0) > 0 ? color : "text-muted-foreground"}`}>
                  {value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{scan.pagesScanned} page{scan.pagesScanned !== 1 ? "s" : ""} scanned</span>
          {scan.duration && <span>Duration: {(scan.duration / 1000).toFixed(1)}s</span>}
          <span>Standards: {data.standards.join(", ")}</span>
        </div>

        {/* Issues by page */}
        <h2 className="text-lg font-semibold">Issues by Page</h2>

        {data.pages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="font-medium">No issues found</p>
              <p className="text-sm">All pages passed the accessibility checks.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.pages.map((page, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-medium truncate">
                        {page.title || page.url}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{page.url}</p>
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
                      {page.violations.map((v, vi) => (
                        <li key={vi} className="px-6 py-4 space-y-2">
                          <div className="flex items-start gap-3">
                            <Badge
                              variant={
                                v.severity === "CRITICAL" ? "critical"
                                  : v.severity === "SERIOUS" ? "serious"
                                  : v.severity === "MODERATE" ? "moderate"
                                  : "minor"
                              }
                              className="flex-shrink-0 mt-0.5"
                            >
                              {v.severity.toLowerCase()}
                            </Badge>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-medium">{v.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {v.ruleId}
                                {v.wcagCriterion ? ` · WCAG ${v.wcagCriterion}` : ""}
                                {v.wcagLevel ? ` (Level ${v.wcagLevel})` : ""}
                              </p>
                            </div>
                          </div>
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
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          <p>
            Generated by{" "}
            <a href="https://accesskit.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              AccessKit
            </a>
            {" "}· The accessibility platform for agencies
          </p>
        </div>
      </main>
    </div>
  );
}
