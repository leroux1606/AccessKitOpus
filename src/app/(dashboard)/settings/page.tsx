import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getActiveMembership } from "@/lib/get-active-org";
import { CreditCard, Key, Palette, Bell, Webhook, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_NAMES } from "@/lib/plans";
import { OrgRenameForm } from "@/components/dashboard/org-rename-form";

export const metadata = { title: "Settings" };

const settingsSections = [
  {
    href: "/settings/billing",
    icon: CreditCard,
    title: "Billing & Plan",
    description: "Manage your subscription, view invoices, and upgrade your plan.",
  },
  {
    href: "/settings/api-keys",
    icon: Key,
    title: "API Keys",
    description: "Create and manage API keys for CI/CD integration and the public API.",
  },
  {
    href: "/settings/white-label",
    icon: Palette,
    title: "White Label",
    description: "Customize branding for client-facing reports and portals.",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Configure email and in-app notification preferences.",
  },
  {
    href: "/settings/webhooks",
    icon: Webhook,
    title: "Webhooks",
    description: "Send real-time events to external services with HMAC signing.",
  },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const org = membership.organization;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your organization settings and integrations
        </p>
      </div>

      {/* Org info + rename */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="text-xs text-muted-foreground">/{org.slug}</p>
            </div>
            <Badge variant="default">{PLAN_NAMES[org.plan]}</Badge>
          </div>
          <OrgRenameForm
            currentName={org.name}
            canEdit={membership.role === "OWNER" || membership.role === "ADMIN"}
          />
        </CardContent>
      </Card>

      {/* Settings links */}
      <div className="space-y-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="hover:border-border transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{section.title}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
