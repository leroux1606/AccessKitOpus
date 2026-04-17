import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalManager } from "@/components/dashboard/portal-manager";

export const metadata = { title: "Client Portals" };

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const isAgencyOrHigher = ["AGENCY", "ENTERPRISE"].includes(membership.organization.plan);

  if (!isAgencyOrHigher) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Portals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            White-label portals for your clients to view their accessibility progress
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 rounded-xl border border-border/50 bg-card/40 p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] flex items-center justify-center mb-5 shadow-lg shadow-[hsl(262,83%,68%)]/20">
              <ExternalLink className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Agency plan required</h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-7 leading-relaxed">
              Create white-label portals for each client. They log in with their own link and see their score, issues, and progress — branded as you.
            </p>
            <Button asChild size="lg" className="w-full sm:w-auto px-8">
              <Link href="/settings/billing">Upgrade to Agency</Link>
            </Button>
          </div>
          <div className="lg:col-span-2 space-y-3">
            {[
              { title: "Branded portals", desc: "Your logo, your colours, your domain — clients never see AccessKit." },
              { title: "Per-client access", desc: "Each client only sees their own websites. Fully isolated." },
              { title: "Score & issue tracking", desc: "Clients can see their score trend and open issues in real time." },
              { title: "Password protection", desc: "Optionally lock portals with a password for extra privacy." },
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

  const [portals, websites] = await Promise.all([
    db.clientPortal.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        website: { select: { name: true, url: true, currentScore: true, lastScanAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.website.findMany({
      where: { organizationId: membership.organizationId, isCompetitor: false },
      select: { id: true, name: true, url: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client Portals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Branded portals for clients to view their accessibility progress
        </p>
      </div>

      <PortalManager
        portals={portals.map((p) => ({
          id: p.id,
          slug: p.slug,
          companyName: p.companyName,
          enabled: p.enabled,
          website: {
            name: p.website.name,
            url: p.website.url,
            currentScore: p.website.currentScore,
            lastScanAt: p.website.lastScanAt?.toISOString() ?? null,
          },
        }))}
        websites={websites}
        baseUrl={baseUrl}
      />
    </div>
  );
}
