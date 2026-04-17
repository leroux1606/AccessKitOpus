import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Tag,
  Shield,
  Code,
  Lightbulb,
  Gauge,
} from "lucide-react";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { getPlanLimits } from "@/lib/plans";
import { generateAiFixSuggestion } from "@/lib/ai";
import { StatusSelect } from "@/components/issues/status-select";
import { AssigneeSelect } from "@/components/issues/assignee-select";
import { CommentThread } from "@/components/issues/comment-thread";
import { HtmlDiff } from "@/components/issues/html-diff";

interface IssueDetailPageProps {
  params: Promise<{ websiteId: string; violationId: string }>;
}

export async function generateMetadata({ params }: IssueDetailPageProps) {
  const { violationId } = await params;
  const violation = await db.violation.findUnique({
    where: { id: violationId },
    select: { description: true, ruleId: true },
  });
  return { title: violation ? `${violation.ruleId} — Issue Detail` : "Issue Detail" };
}

const severityVariant = (s: string) =>
  s === "CRITICAL" ? "critical" : s === "SERIOUS" ? "serious" : s === "MODERATE" ? "moderate" : "minor";

const effortLabel = (e: string) =>
  e === "LOW" ? "Low effort" : e === "MEDIUM" ? "Medium effort" : "High effort";

const effortColor = (e: string) =>
  e === "LOW" ? "text-green-400" : e === "MEDIUM" ? "text-yellow-400" : "text-red-400";

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { websiteId, violationId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) notFound();

  const violation = await db.violation.findFirst({
    where: { id: violationId, websiteId },
    include: {
      page: true,
      assignedTo: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!violation) notFound();

  // Generate AI fix suggestion lazily on first view (Agency plan only)
  const limits = getPlanLimits(membership.organization.plan);
  if (!violation.aiFixSuggestion && limits.hasAiFixes) {
    const aiSuggestion = await generateAiFixSuggestion({
      ruleId: violation.ruleId,
      description: violation.description,
      htmlElement: violation.htmlElement ?? "",
      helpText: violation.helpText ?? "",
      templateFix: violation.fixSuggestion ?? undefined,
    });
    if (aiSuggestion) {
      await db.violation.update({
        where: { id: violation.id },
        data: { aiFixSuggestion: aiSuggestion },
      });
      violation.aiFixSuggestion = aiSuggestion;
    }
  }

  // Fetch team members for assignment dropdown
  const memberships = await db.membership.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const teamMembers = memberships.map((m) => m.user);

  const serializedComments = violation.comments.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    user: {
      id: c.user.id,
      name: c.user.name,
      email: c.user.email,
      image: c.user.image,
    },
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/websites/${websiteId}/issues`}>
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            {website.name} Issues
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl font-bold tracking-tight">{violation.description}</h1>
            <p className="text-sm text-muted-foreground font-mono">{violation.ruleId}</p>
          </div>
          <Badge variant={severityVariant(violation.severity)} className="text-xs flex-shrink-0">
            {violation.severity.toLowerCase()}
          </Badge>
        </div>

        {/* Status + Assignee controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <StatusSelect violationId={violation.id} currentStatus={violation.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Assignee:</span>
            <AssigneeSelect
              violationId={violation.id}
              currentAssigneeId={violation.assignedToId}
              teamMembers={teamMembers}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* HTML Diff */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code className="h-4 w-4" aria-hidden="true" />
                HTML Element
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HtmlDiff original={violation.htmlElement} fixed={violation.fixedHtml} />
            </CardContent>
          </Card>

          {/* Fix Suggestion */}
          {(violation.fixSuggestion || violation.aiFixSuggestion) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  How to Fix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {violation.fixSuggestion && (
                  <p className="text-sm text-muted-foreground">{violation.fixSuggestion}</p>
                )}
                {violation.aiFixSuggestion && (
                  <div className="rounded-md bg-[hsl(262,83%,68%)]/5 border border-[hsl(262,83%,68%)]/15 p-3">
                    <p className="text-xs font-medium text-[hsl(262,80%,80%)] mb-1">AI Suggestion</p>
                    <p className="text-sm text-muted-foreground">{violation.aiFixSuggestion}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Help text */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" aria-hidden="true" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{violation.helpText}</p>
              {violation.helpUrl && (
                <a
                  href={violation.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[hsl(262,80%,80%)] hover:underline"
                >
                  Learn more
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Discussion</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                violationId={violation.id}
                comments={serializedComments}
                currentUserId={session.user.id}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    Category
                  </span>
                  <span className="capitalize">{violation.category.toLowerCase().replace("_", " ")}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                    Effort
                  </span>
                  <span className={effortColor(violation.effortEstimate)}>
                    {effortLabel(violation.effortEstimate)}
                  </span>
                </div>

                <Separator />

                {violation.wcagCriterion && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">WCAG</span>
                      <span>
                        {violation.wcagCriterion}
                        {violation.wcagLevel && ` (${violation.wcagLevel})`}
                      </span>
                    </div>
                    <Separator />
                  </>
                )}

                {violation.standards.length > 0 && (
                  <>
                    <div>
                      <span className="text-muted-foreground block mb-1.5">Standards</span>
                      <div className="flex flex-wrap gap-1">
                        {violation.standards.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px]">
                            {s.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    First Detected
                  </span>
                  <span>{formatDate(violation.firstDetectedAt)}</span>
                </div>

                {violation.resolvedAt && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Resolved</span>
                      <span>{formatRelativeTime(violation.resolvedAt)}</span>
                    </div>
                  </>
                )}

                {violation.verifiedAt && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Verified</span>
                      <span>{formatRelativeTime(violation.verifiedAt)}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="text-sm font-semibold">Location</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Page</span>
                  <a
                    href={violation.page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[hsl(262,80%,80%)] hover:underline break-all text-xs"
                  >
                    {violation.page.url}
                  </a>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">CSS Selector</span>
                  <code className="text-xs font-mono text-muted-foreground break-all">
                    {violation.cssSelector}
                  </code>
                </div>
                {violation.xpath && (
                  <div>
                    <span className="text-xs text-muted-foreground block">XPath</span>
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {violation.xpath}
                    </code>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
