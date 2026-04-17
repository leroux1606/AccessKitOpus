import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Download } from "lucide-react";
import { IssuesTable } from "@/components/issues/issues-table";

interface IssuesPageProps {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ status?: string; severity?: string }>;
}

export async function generateMetadata({ params }: IssuesPageProps) {
  const { websiteId } = await params;
  const website = await db.website.findUnique({ where: { id: websiteId } });
  return { title: `Issues — ${website?.name ?? "Website"}` };
}

export default async function WebsiteIssuesPage({ params, searchParams }: IssuesPageProps) {
  const { websiteId } = await params;
  const filters = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) notFound();

  const statusFilter = filters.status as string | undefined;
  const severityFilter = filters.severity as string | undefined;

  const violations = await db.violation.findMany({
    where: {
      websiteId,
      ...(statusFilter ? { status: statusFilter as never } : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
      ...(severityFilter ? { severity: severityFilter as never } : {}),
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { page: true, assignedTo: true },
  });

  const severityCounts = await db.violation.groupBy({
    by: ["severity"],
    where: { websiteId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    _count: { id: true },
  });

  const countBySeverity = Object.fromEntries(
    severityCounts.map((s) => [s.severity, s._count.id])
  );

  // Fetch team members for bulk assign
  const memberships = await db.membership.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const teamMembers = memberships.map((m) => m.user);

  // Serialize dates for client component
  const serializedViolations = violations.map((v) => ({
    id: v.id,
    description: v.description,
    ruleId: v.ruleId,
    severity: v.severity,
    status: v.status,
    category: v.category,
    firstDetectedAt: v.firstDetectedAt.toISOString(),
    assignedTo: v.assignedTo
      ? { id: v.assignedTo.id, name: v.assignedTo.name, email: v.assignedTo.email, image: v.assignedTo.image }
      : null,
    page: { url: v.page.url },
    websiteId: v.websiteId,
  }));

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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">{violations.length} issue{violations.length !== 1 ? "s" : ""}</p>
        </div>
        {violations.length > 0 && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/websites/${websiteId}/violations/export`} download>
              <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        )}
      </div>

      {/* Severity summary */}
      <div className="flex flex-wrap gap-2">
        {(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"] as const).map((sev) => {
          const count = countBySeverity[sev] ?? 0;
          if (count === 0) return null;
          return (
            <Link
              key={sev}
              href={`/websites/${websiteId}/issues?severity=${sev}`}
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
                className="cursor-pointer hover:opacity-80"
              >
                {count} {sev.toLowerCase()}
              </Badge>
            </Link>
          );
        })}
        {(statusFilter || severityFilter) && (
          <Link
            href={`/websites/${websiteId}/issues`}
            className="text-xs text-muted-foreground hover:underline self-center"
          >
            Clear filters
          </Link>
        )}
      </div>

      {violations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p className="text-sm">
            {statusFilter || severityFilter ? "No issues match your filters." : "No open issues. Great work!"}
          </p>
        </div>
      ) : (
        <IssuesTable
          violations={serializedViolations}
          teamMembers={teamMembers}
          websiteId={websiteId}
        />
      )}
    </div>
  );
}
