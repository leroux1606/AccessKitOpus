import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { formatDate, scoreToColor } from "@/lib/utils";
import { generateReport } from "./actions";
import { ReportActions } from "./report-actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const orgId = membership.organizationId;

  const [reports, completedScans] = await Promise.all([
    db.report.findMany({
      where: { organizationId: orgId },
      include: {
        website: true,
        scan: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.scan.findMany({
      where: {
        website: { organizationId: orgId },
        status: "COMPLETED",
      },
      include: { website: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate and share accessibility compliance reports
        </p>
      </div>

      {/* Generate new report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate report</CardTitle>
          <CardDescription>
            Create a PDF accessibility report from a completed scan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completedScans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed scans yet. Run a scan on one of your websites first.
            </p>
          ) : (
            <form action={generateReport} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="scanId" className="sr-only">Select a scan</label>
                <select
                  id="scanId"
                  name="scanId"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {completedScans.map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {scan.website.name} — {formatDate(scan.createdAt)} — Score: {scan.score ?? "—"}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="isPublic"
                  className="h-4 w-4 rounded accent-primary"
                />
                Shareable link
              </label>
              <Button type="submit">
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Generate PDF
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Report list */}
      {reports.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/30 p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <FileBarChart className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold mb-1">No reports yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {completedScans.length === 0
              ? "Run a scan on one of your websites first, then come back to generate a report."
              : "Select a completed scan above and click Generate PDF to create your first report."}
          </p>
          {completedScans.length === 0 && (
            <Button asChild size="sm" className="mt-4">
              <Link href="/websites">Go to Websites</Link>
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated reports</CardTitle>
            <CardDescription>{reports.length} report{reports.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul role="list" className="divide-y">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{report.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(report.createdAt)}</span>
                      <span>Score: <span className={scoreToColor(report.scan.score)}>{report.scan.score ?? "—"}</span></span>
                      <span>{report.scan.totalViolations ?? 0} issues</span>
                      {report.isPublic && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Link2 className="h-2.5 w-2.5 mr-1" aria-hidden="true" />
                          Shared
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ReportActions
                    reportId={report.id}
                    shareToken={report.shareToken}
                    isPublic={report.isPublic}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
