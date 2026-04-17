import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Key } from "lucide-react";
import { ApiKeyManager } from "@/components/dashboard/api-key-manager";

export const metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const isAgencyOrHigher = ["AGENCY", "ENTERPRISE"].includes(membership.organization.plan);

  const apiKeys = isAgencyOrHigher
    ? await db.apiKey.findMany({
        where: { organizationId: membership.organizationId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      })
    : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Authenticate with the AccessKit REST API and CI/CD integrations
        </p>
      </div>

      {!isAgencyOrHigher ? (
        <Card className="border-orange-500/20 bg-orange-500/10">
          <CardContent className="p-6 text-center space-y-3">
            <Key className="h-8 w-8 mx-auto text-orange-400" aria-hidden="true" />
            <p className="font-medium">API access requires Agency plan or higher</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to use the REST API, CI/CD integrations, and webhooks.
            </p>
            <Button asChild>
              <Link href="/settings/billing">Upgrade plan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ApiKeyManager
          keys={apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      )}
    </div>
  );
}
