import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { getPlanLimits } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CompetitorManager } from "@/components/dashboard/competitor-manager";
import { ComparisonChart } from "@/components/dashboard/comparison-chart";

export const metadata = { title: "Competitive Benchmarking" };

export default async function BenchmarkingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;
  const limits = getPlanLimits(org.plan);

  if (!limits.hasBenchmarking) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competitive Benchmarking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare your accessibility scores against competitors
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 rounded-xl border border-border/50 bg-card/40 p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Lock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Agency plan required</h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-7 leading-relaxed">
              Scan competitor websites and compare accessibility scores side-by-side. A powerful sales tool — &ldquo;your site scores 72, their top competitor scores 41.&rdquo;
            </p>
            <Button asChild size="lg" className="w-full sm:w-auto px-8">
              <Link href="/settings/billing">Upgrade to Agency</Link>
            </Button>
          </div>
          <div className="lg:col-span-2 space-y-3">
            {[
              { title: "Scan competitors", desc: "Add any public website URL and scan it for accessibility issues." },
              { title: "Side-by-side scores", desc: "See your average score vs. competitors on a single chart." },
              { title: "Sales ammunition", desc: "Show clients exactly how they compare to their competition." },
              { title: "Up to 5 competitors", desc: "Track up to 5 competitor websites on the Agency plan." },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-lg border border-border/40 bg-card/30 p-4">
                <p className="font-medium text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fetch own websites and competitors
  const [ownWebsites, competitors] = await Promise.all([
    db.website.findMany({
      where: { organizationId: org.id, isCompetitor: false },
      select: { id: true, name: true, url: true, currentScore: true, lastScanAt: true },
      orderBy: { name: "asc" },
    }),
    db.website.findMany({
      where: { organizationId: org.id, isCompetitor: true },
      select: { id: true, name: true, url: true, currentScore: true, lastScanAt: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const competitorLimit = limits.competitorScans;
  const canAddMore = competitors.length < competitorLimit;

  // Average scores
  const ownScores = ownWebsites.filter((w) => w.currentScore !== null).map((w) => w.currentScore!);
  const compScores = competitors.filter((w) => w.currentScore !== null).map((w) => w.currentScore!);
  const avgOwn = ownScores.length > 0 ? Math.round(ownScores.reduce((a, b) => a + b, 0) / ownScores.length) : null;
  const avgComp = compScores.length > 0 ? Math.round(compScores.reduce((a, b) => a + b, 0) / compScores.length) : null;
  const scoreDiff = avgOwn !== null && avgComp !== null ? avgOwn - avgComp : null;

  // Prepare chart data
  const chartData = [
    ...ownWebsites
      .filter((w) => w.currentScore !== null)
      .map((w) => ({ name: w.name, score: w.currentScore!, type: "own" as const })),
    ...competitors
      .filter((w) => w.currentScore !== null)
      .map((w) => ({ name: w.name, score: w.currentScore!, type: "competitor" as const })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Competitive Benchmarking</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compare your accessibility scores against competitors
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Your Average Score</p>
            <p className="text-3xl font-bold mt-1">
              {avgOwn !== null ? `${avgOwn}/100` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {ownScores.length} website{ownScores.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Competitor Average</p>
            <p className="text-3xl font-bold mt-1">
              {avgComp !== null ? `${avgComp}/100` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {compScores.length} competitor{compScores.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Your Advantage</p>
            <div className="flex items-center gap-2 mt-1">
              {scoreDiff !== null ? (
                <>
                  {scoreDiff > 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  ) : scoreDiff < 0 ? (
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p className={`text-3xl font-bold ${
                    scoreDiff > 0 ? "text-green-400" : scoreDiff < 0 ? "text-red-400" : ""
                  }`}>
                    {scoreDiff > 0 ? "+" : ""}{scoreDiff}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold">—</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Points vs competitors</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ComparisonChart data={chartData} />
          </CardContent>
        </Card>
      )}

      {/* Website scores table */}
      {(ownWebsites.length > 0 || competitors.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Website</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ownWebsites, ...competitors]
                    .sort((a, b) => (b.currentScore ?? 0) - (a.currentScore ?? 0))
                    .map((w) => {
                      const isCompetitor = competitors.some((c) => c.id === w.id);
                      return (
                        <tr key={w.id} className="border-b border-border/30 last:border-0">
                          <td className="py-2.5 px-3">
                            <p className="font-medium">{w.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{w.url}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={isCompetitor ? "secondary" : "default"}>
                              {isCompetitor ? "Competitor" : "Your site"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {w.currentScore !== null ? (
                              <span className={`font-bold ${
                                w.currentScore >= 90
                                  ? "text-green-400"
                                  : w.currentScore >= 70
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }`}>
                                {w.currentScore}/100
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not scanned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitor management */}
      <CompetitorManager
        organizationId={org.id}
        competitors={competitors}
        competitorLimit={competitorLimit}
        canAddMore={canAddMore}
      />
    </div>
  );
}
