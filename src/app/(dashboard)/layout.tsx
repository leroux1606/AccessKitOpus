import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveMembership } from "@/lib/get-active-org";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verify user has at least one organization (respects active-org cookie for multi-org users)
  const membership = await getActiveMembership(session.user.id);

  if (!membership) {
    // Edge case: user exists but has no org (shouldn't happen with our createUser event)
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip-to-content link — WCAG 2.4.1 Bypass Blocks (Level A) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile logo bar — shown only when sidebar is hidden */}
        <div className="flex md:hidden items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-sidebar">
          <div className="w-7 h-7 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-md flex items-center justify-center shadow-md shadow-[hsl(262,83%,68%)]/15">
            <span className="text-white font-bold text-xs">AK</span>
          </div>
          <span className="font-bold text-foreground">AccessKit</span>
        </div>
        <Header />
        <main
          id="main-content"
          className="flex-1 p-4 md:p-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
