"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  AlertTriangle,
  Users,
  Settings,
  ExternalLink,
  Plug,
  BarChart3,
  Swords,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Websites",
    href: "/websites",
    icon: Globe,
  },
  {
    label: "Issues",
    href: "/issues",
    icon: AlertTriangle,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    comingSoon: false,
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
  },
  {
    label: "Client Portals",
    href: "/clients",
    icon: ExternalLink,
  },
  {
    label: "Benchmarking",
    href: "/benchmarking",
    icon: Swords,
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-64 border-r border-border/50 bg-sidebar min-h-screen"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border/50">
        <div className="w-7 h-7 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-md flex items-center justify-center flex-shrink-0 shadow-md shadow-[hsl(262,83%,68%)]/15">
          <span className="text-white font-bold text-xs">AK</span>
        </div>
        <span className="font-bold text-foreground">AccessKit</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Primary">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-[hsl(262,83%,68%)]/10 text-[hsl(262,80%,80%)] border border-[hsl(262,83%,68%)]/15"
                  : "text-sidebar-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-[hsl(262,83%,68%)]" : ""
                )}
                aria-hidden="true"
              />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon && (
                <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-normal">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-6 pt-3 border-t border-border/50">
        <Link
          href="/docs"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-150"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Documentation
        </Link>
      </div>
    </aside>
  );
}
