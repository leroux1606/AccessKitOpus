import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Globe, Plus, ShieldCheck } from "lucide-react";
import { ScanButton } from "@/components/dashboard/scan-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, scoreToColor } from "@/lib/utils";
import { getActiveMembership } from "@/lib/get-active-org";

export const metadata = { title: "Websites" };

export default async function WebsitesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const websites = await db.website.findMany({
    where: { organizationId: membership.organizationId, isCompetitor: false },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Websites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {websites.length > 0
              ? `${websites.length} website${websites.length !== 1 ? "s" : ""} monitored`
              : "Add websites to start scanning"}
          </p>
        </div>
        {websites.length > 0 && (
          <Button asChild>
            <Link href="/websites/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add website
            </Link>
          </Button>
        )}
      </div>

      {websites.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          {/* CTA */}
          <div className="lg:col-span-3 rounded-xl border border-border/50 bg-card/40 p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] flex items-center justify-center mb-5 shadow-lg shadow-[hsl(262,83%,68%)]/20">
              <Globe className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Add your first website</h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-7 leading-relaxed">
              Enter a URL and AccessKit will verify ownership, then scan every page for accessibility violations.
            </p>
            <Button asChild size="lg" className="w-full sm:w-auto px-10">
              <Link href="/websites/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add website
              </Link>
            </Button>
          </div>

          {/* Steps */}
          <div className="lg:col-span-2 space-y-3">
            {[
              { step: "1", title: "Add your URL", desc: "Paste any public website URL — your domain or a client's." },
              { step: "2", title: "Verify ownership", desc: "Add a meta tag or DNS record to prove you control the site." },
              { step: "3", title: "Run a scan", desc: "AccessKit crawls every page and detects accessibility violations." },
              { step: "4", title: "Fix and track", desc: "Get code-level fixes for each issue and watch your score improve." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3 rounded-lg border border-border/40 bg-card/30 p-4">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{step}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {websites.map((website) => (
            <Card key={website.id} className="hover:border-border transition-colors group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/websites/${website.id}`}
                      className="font-semibold text-sm hover:text-primary transition-colors block truncate"
                    >
                      {website.name}
                    </Link>
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline truncate block mt-0.5"
                    >
                      {website.url}
                    </a>
                  </div>
                  {website.currentScore !== null && (
                    <span
                      className={`text-2xl font-bold ml-4 flex-shrink-0 ${scoreToColor(website.currentScore)}`}
                      aria-label={`Score: ${website.currentScore}`}
                    >
                      {website.currentScore}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {website.verified ? (
                      <Badge variant="success" className="text-[10px] gap-1">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Link href={`/websites/${website.id}/settings`}>
                        <Badge variant="warning" className="text-[10px] cursor-pointer hover:opacity-80">Unverified</Badge>
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(website.lastScanAt)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <ScanButton
                      websiteId={website.id}
                      disabled={!website.verified}
                      disabledReason={!website.verified ? "Verify website first" : undefined}
                    />
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/websites/${website.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        </div>
      )}
    </div>
  );
}
