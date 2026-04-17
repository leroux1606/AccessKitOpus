import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Priority Matrix" };

const SEVERITIES = ["CRITICAL", "SERIOUS", "MODERATE", "MINOR"] as const;
const EFFORTS = ["LOW", "MEDIUM", "HIGH"] as const;

const severityLabel: Record<string, string> = {
  CRITICAL: "Critical",
  SERIOUS: "Serious",
  MODERATE: "Moderate",
  MINOR: "Minor",
};

const effortLabel: Record<string, string> = {
  LOW: "Low Effort",
  MEDIUM: "Medium Effort",
  HIGH: "High Effort",
};

const cellColor = (severity: string, effort: string): string => {
  // High severity + low effort = highest priority (red)
  // Low severity + high effort = lowest priority (blue)
  if (severity === "CRITICAL" && effort === "LOW") return "bg-red-500/20 border-red-500/30 hover:bg-red-500/30";
  if (severity === "CRITICAL" && effort === "MEDIUM") return "bg-red-500/15 border-red-500/20 hover:bg-red-500/25";
  if (severity === "CRITICAL" && effort === "HIGH") return "bg-orange-500/15 border-orange-500/20 hover:bg-orange-500/25";
  if (severity === "SERIOUS" && effort === "LOW") return "bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30";
  if (severity === "SERIOUS" && effort === "MEDIUM") return "bg-yellow-500/15 border-yellow-500/20 hover:bg-yellow-500/25";
  if (severity === "SERIOUS" && effort === "HIGH") return "bg-yellow-500/10 border-yellow-500/15 hover:bg-yellow-500/20";
  if (severity === "MODERATE" && effort === "LOW") return "bg-yellow-500/15 border-yellow-500/20 hover:bg-yellow-500/25";
  if (severity === "MODERATE" && effort === "MEDIUM") return "bg-blue-500/10 border-blue-500/15 hover:bg-blue-500/20";
  if (severity === "MODERATE" && effort === "HIGH") return "bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/15";
  if (severity === "MINOR" && effort === "LOW") return "bg-blue-500/10 border-blue-500/15 hover:bg-blue-500/20";
  return "bg-muted/30 border-border hover:bg-muted/50";
};

export default async function PriorityMatrixPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  // Get counts grouped by severity + effort
  const violations = await db.violation.groupBy({
    by: ["severity", "effortEstimate"],
    where: {
      website: { organizationId: membership.organizationId },
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const v of violations) {
    countMap.set(`${v.severity}:${v.effortEstimate}`, v._count.id);
  }

  const totalOpen = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/issues">
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Issues
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Priority Matrix</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {totalOpen} open issue{totalOpen !== 1 ? "s" : ""} organized by severity and effort
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Severity vs. Effort</CardTitle>
          <CardDescription>
            Fix high-severity, low-effort issues first for maximum impact
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="Priority matrix: severity vs effort">
              <thead>
                <tr>
                  <th scope="col" className="text-left p-3 text-xs text-muted-foreground font-medium w-28">
                    Severity / Effort
                  </th>
                  {EFFORTS.map((effort) => (
                    <th
                      key={effort}
                      scope="col"
                      className="text-center p-3 text-xs text-muted-foreground font-medium"
                    >
                      {effortLabel[effort]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEVERITIES.map((severity) => (
                  <tr key={severity}>
                    <th scope="row" className="text-left p-3 text-sm font-medium">
                      {severityLabel[severity]}
                    </th>
                    {EFFORTS.map((effort) => {
                      const count = countMap.get(`${severity}:${effort}`) ?? 0;
                      return (
                        <td key={effort} className="p-2">
                          <Link
                            href={`/issues?severity=${severity}&effort=${effort}`}
                            className={`flex flex-col items-center justify-center rounded-lg border p-6 transition-colors ${cellColor(severity, effort)}`}
                          >
                            <span className="text-2xl font-bold">{count}</span>
                            <span className="text-xs text-muted-foreground mt-1">
                              issue{count !== 1 ? "s" : ""}
                            </span>
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-6 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" aria-hidden="true" />
              Fix first
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500/15 border border-orange-500/20" aria-hidden="true" />
              High priority
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500/10 border border-yellow-500/15" aria-hidden="true" />
              Medium priority
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/10 border border-blue-500/15" aria-hidden="true" />
              Low priority
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
