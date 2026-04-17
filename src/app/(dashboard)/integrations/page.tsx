import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Github, Webhook, Key, Terminal, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActiveMembership } from "@/lib/get-active-org";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const plan = membership.organization.plan;
  const hasCI = ["PROFESSIONAL", "AGENCY", "ENTERPRISE"].includes(plan);
  const hasWebhooks = ["AGENCY", "ENTERPRISE"].includes(plan);
  const hasApi = ["AGENCY", "ENTERPRISE"].includes(plan);

  const integrations = [
    {
      icon: Github,
      title: "GitHub Actions",
      description: "Scan staging URLs on every pull request. Block merges if new critical issues are introduced.",
      available: hasCI,
      requiredPlan: "Professional",
      href: hasCI ? null : "/settings/billing",
      cta: hasCI ? "Coming soon" : "Upgrade to Professional",
      code: hasCI
        ? '- name: AccessKit scan\n  run: |\n    curl -s -X POST \\\n      -H "Authorization: Bearer ${{ secrets.ACCESSKIT_KEY }}" \\\n      -d \'{"websiteId":"YOUR_ID"}\' \\\n      https://app.accesskit.io/api/v1/scans'
        : null,
    },
    {
      icon: Webhook,
      title: "Webhooks",
      description: "Receive real-time events when scans complete, scores drop, or critical issues are found.",
      available: hasWebhooks,
      requiredPlan: "Agency",
      href: hasWebhooks ? "/settings/webhooks" : "/settings/billing",
      cta: hasWebhooks ? "Configure webhooks" : "Upgrade to Agency",
      code: null,
    },
    {
      icon: Key,
      title: "REST API",
      description: "Trigger scans, fetch results, and manage websites programmatically via API keys.",
      available: hasApi,
      requiredPlan: "Agency",
      href: hasApi ? "/settings/api-keys" : "/settings/billing",
      cta: hasApi ? "Manage API keys" : "Upgrade to Agency",
      code: null,
    },
    {
      icon: Terminal,
      title: "GitLab / Bitbucket",
      description: "Use the REST API and a shell script to integrate AccessKit into any CI/CD pipeline.",
      available: hasApi,
      requiredPlan: "Agency",
      href: "/docs#cicd",
      cta: hasApi ? "View docs" : "Upgrade to Agency",
      code: null,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect AccessKit to your development workflow
        </p>
      </div>

      <div className="space-y-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.title} className={!integration.available ? "opacity-70" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {integration.title}
                        {!integration.available && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                  {integration.available ? (
                    <Badge variant="success" className="flex-shrink-0">Available</Badge>
                  ) : (
                    <Badge variant="secondary" className="flex-shrink-0">{integration.requiredPlan}+</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {integration.code && (
                  <pre className="bg-muted/40 rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                    {integration.code}
                  </pre>
                )}
                {integration.href ? (
                  <Button
                    size="sm"
                    variant={integration.available ? "outline" : "default"}
                    asChild
                  >
                    <Link href={integration.href}>{integration.cta}</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    {integration.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
