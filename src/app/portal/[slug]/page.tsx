import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, scoreToColor } from "@/lib/utils";
import { PortalPasswordGate } from "@/components/portal/password-gate";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const portal = await db.clientPortal.findUnique({
    where: { slug },
    select: { companyName: true },
  });
  return { title: portal?.companyName ? `${portal.companyName} — Accessibility Dashboard` : "Portal" };
}

export default async function PortalPage({ params }: Props) {
  const { slug } = await params;

  const portal = await db.clientPortal.findUnique({
    where: { slug },
    include: {
      website: {
        include: {
          scans: {
            where: { status: "COMPLETED" },
            orderBy: { completedAt: "desc" },
            take: 10,
            select: {
              id: true,
              score: true,
              totalViolations: true,
              criticalCount: true,
              seriousCount: true,
              moderateCount: true,
              minorCount: true,
              pagesScanned: true,
              completedAt: true,
            },
          },
        },
      },
      organization: { select: { whiteLabel: true } },
    },
  });

  if (!portal || !portal.enabled) notFound();

  // Password check — compares an httpOnly cookie set by /api/portal/[slug]/auth.
  // Never accept the password via query string (leaks into logs/history).
  if (portal.passwordHash) {
    const cookieStore = await cookies();
    const cookieHash = cookieStore.get(`portal_${slug}`)?.value;
    if (cookieHash !== portal.passwordHash) {
      return <PortalPasswordGate slug={slug} />;
    }
  }

  const website = portal.website;
  const latestScan = website.scans[0];
  const whiteLabel = portal.organization.whiteLabel as {
    companyName?: string;
    primaryColor?: string;
  } | null;

  const brandName = portal.companyName || whiteLabel?.companyName || "Accessibility Dashboard";
  const brandColor = portal.primaryColor || whiteLabel?.primaryColor || "#8B5CF6";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {portal.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portal.logoUrl} alt="" className="w-8 h-8 rounded object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {brandName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-lg">{brandName}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accessibility Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {website.name} — {website.url}
          </p>
        </div>

        {/* Current Score */}
        {latestScan ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Score</p>
                  <p className={`text-3xl font-bold ${scoreToColor(latestScan.score)}`}>
                    {latestScan.score ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Issues</p>
                  <p className="text-3xl font-bold">{latestScan.totalViolations ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {latestScan.pagesScanned} pages scanned
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Critical</p>
                  <p className="text-3xl font-bold text-red-400">
                    {latestScan.criticalCount ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Last Scan</p>
                  <p className="text-sm font-medium mt-2">
                    {formatDate(latestScan.completedAt)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Severity breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Critical", count: latestScan.criticalCount ?? 0, color: "bg-red-500" },
                    { label: "Serious", count: latestScan.seriousCount ?? 0, color: "bg-orange-500" },
                    { label: "Moderate", count: latestScan.moderateCount ?? 0, color: "bg-yellow-500" },
                    { label: "Minor", count: latestScan.minorCount ?? 0, color: "bg-blue-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-lg bg-muted p-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-lg font-bold">{item.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scan History */}
            {website.scans.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scan History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {website.scans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between rounded-lg bg-muted px-4 py-2.5"
                      >
                        <span className="text-sm">{formatDate(scan.completedAt)}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {scan.totalViolations ?? 0} issues
                          </Badge>
                          <span className={`font-bold ${scoreToColor(scan.score)}`}>
                            {scan.score ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-10">
              <p className="text-muted-foreground">No scan results yet. The first scan is being processed.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        Powered by AccessKit
      </footer>
    </div>
  );
}
