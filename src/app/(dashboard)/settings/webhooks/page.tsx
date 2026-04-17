import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { WebhookManager } from "@/components/dashboard/webhook-manager";

export const metadata = { title: "Webhooks" };

export default async function WebhooksSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const webhooks = await db.webhook.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      deliveries: {
        orderBy: { deliveredAt: "desc" },
        take: 5,
        select: { id: true, event: true, success: true, statusCode: true, deliveredAt: true },
      },
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Strip secret from response
  const sanitized = webhooks.map(({ secret: _s, ...w }) => w);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Send real-time event notifications to external services
        </p>
      </div>

      <WebhookManager initialWebhooks={sanitized as Parameters<typeof WebhookManager>[0]["initialWebhooks"]} />
    </div>
  );
}
