import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  title?: string;
}

export async function Header({ title }: HeaderProps) {
  const session = await auth();
  if (!session?.user) return null;

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    plan: m.organization.plan,
    role: m.role,
  }));

  return (
    <header className="flex items-center justify-between border-b border-border/50 px-6 py-3 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <OrgSwitcher organizations={organizations} />
        {title && (
          <h1 className="text-lg font-semibold text-foreground hidden md:block">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu
          user={{
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? "",
            image: session.user.image ?? null,
          }}
        />
      </div>
    </header>
  );
}
