import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock } from "lucide-react";
import { formatDate, formatRelativeTime, scoreToColor } from "@/lib/utils";

interface ScansPageProps {
  params: Promise<{ websiteId: string }>;
}

export async function generateMetadata({ params }: ScansPageProps) {
  const { websiteId } = await params;
  const website = await db.website.findUnique({ where: { id: websiteId } });
  return { title: `Scan History — ${website?.name ?? "Website"}` };
}

export default async function ScansPage({ params }: ScansPageProps) {
  const { websiteId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) notFound();

  const scans = await db.scan.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/websites/${websiteId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            {website.name}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan history</h1>
        <p className="text-sm text-muted-foreground">
          {scans.length} scan{scans.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {scans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p className="text-sm">No scans yet.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm" aria-label="Scan history">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th scope="col" className="text-left px-6 py-3 font-medium">Date</th>
                  <th scope="col" className="text-left px-6 py-3 font-medium">Score</th>
                  <th scope="col" className="text-left px-6 py-3 font-medium hidden md:table-cell">Pages</th>
                  <th scope="col" className="text-left px-6 py-3 font-medium hidden lg:table-cell">Issues</th>
                  <th scope="col" className="text-left px-6 py-3 font-medium">Status</th>
                  <th scope="col" className="text-left px-6 py-3 font-medium hidden md:table-cell">Triggered by</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium">{formatDate(scan.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(scan.createdAt)}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-bold ${scoreToColor(scan.score)}`}>
                        {scan.score ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3 hidden md:table-cell text-muted-foreground">
                      {scan.pagesScanned}
                    </td>
                    <td className="px-6 py-3 hidden lg:table-cell">
                      {scan.totalViolations !== null ? (
                        <span className="text-destructive font-medium">{scan.totalViolations}</span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          scan.status === "COMPLETED"
                            ? "success"
                            : scan.status === "FAILED"
                            ? "destructive"
                            : scan.status === "RUNNING"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {scan.status === "CANCELLED" ? "cancelled" : scan.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 hidden md:table-cell text-xs text-muted-foreground capitalize">
                      {scan.triggeredBy.toLowerCase().replace("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
