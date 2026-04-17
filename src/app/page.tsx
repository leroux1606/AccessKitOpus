import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Globe, BarChart3, Shield, ArrowRight, Sparkles } from "lucide-react";
import { DemoScan } from "@/components/demo-scan";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,68%)] opacity-[0.07] blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full bg-[hsl(220,70%,50%)] opacity-[0.05] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[40%] w-[400px] h-[400px] rounded-full bg-[hsl(262,83%,68%)] opacity-[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-lg flex items-center justify-center shadow-lg shadow-[hsl(262,83%,68%)]/20">
            <span className="text-white font-bold text-sm" aria-hidden="true">AK</span>
          </div>
          <span className="font-bold text-lg text-foreground">AccessKit</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/docs">Docs</Link>
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white shadow-lg shadow-[hsl(262,83%,68%)]/25 border-0" asChild>
            <Link href="/login">Start free trial</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10">
        <section className="text-center py-24 px-6 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(262,83%,68%)]/20 bg-[hsl(262,83%,68%)]/10 px-4 py-1.5 text-sm text-[hsl(262,80%,80%)] font-medium mb-8">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            EU Accessibility Act enforcement started June 2025
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            <span className="text-foreground">The accessibility platform</span>
            <br />
            <span className="bg-gradient-to-r from-[hsl(262,83%,68%)] via-[hsl(280,80%,65%)] to-[hsl(220,70%,60%)] bg-clip-text text-transparent">built for agencies</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Scan, fix, prove compliance, and resell web accessibility to your clients.
            Powered by axe-core. Priced for agencies at <strong className="text-foreground">$349/month</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white shadow-lg shadow-[hsl(262,83%,68%)]/25 border-0 text-base px-8 h-12" asChild>
              <Link href="/login">
                Start 14-day free trial
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-border/50 bg-card/50 backdrop-blur-sm text-foreground hover:bg-card hover:border-[hsl(262,83%,68%)]/30 text-base px-8 h-12" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">No credit card required. Cancel anytime.</p>
        </section>

        {/* Live Demo */}
        <section className="py-16 px-6 max-w-5xl mx-auto" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-2xl font-bold text-center mb-3 text-foreground">
            Try it now — scan any website
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-md mx-auto text-sm">
            Enter a URL to get an instant accessibility score and top issues. No signup required.
          </p>
          <DemoScan />
        </section>

        {/* Features */}
        <section className="py-20 px-6 max-w-5xl mx-auto" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-3xl font-bold text-center mb-4 text-foreground">
            Everything agencies need
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-lg mx-auto">
            One platform to scan, remediate, report, and resell accessibility — so you can focus on your clients.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Globe,
                title: "Guided remediation",
                desc: "Every violation gets a copy-paste code fix — not generic guidance. AI-powered suggestions understand the context of your HTML.",
                gradient: "from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)]",
              },
              {
                icon: BarChart3,
                title: "Issue workflow",
                desc: "Turn violations into trackable tasks. Assign to team members, track status, and comment. Accessibility as project management.",
                gradient: "from-[hsl(220,70%,50%)] to-[hsl(190,70%,50%)]",
              },
              {
                icon: Shield,
                title: "Compliance evidence",
                desc: "Generate VPAT-style reports with timestamped evidence. Legal protection you can show clients and auditors.",
                gradient: "from-[hsl(280,80%,55%)] to-[hsl(340,65%,55%)]",
              },
              {
                icon: CheckCircle2,
                title: "Client portals",
                desc: "Create branded portals for each client. They see their score, issues, and progress. You look professional.",
                gradient: "from-[hsl(190,70%,50%)] to-[hsl(160,60%,45%)]",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-[hsl(262,83%,68%)]/30 hover:bg-card/80"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg opacity-90`}>
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-20 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(262,83%,68%)]/5 to-transparent pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              AccessKit is a monitoring and baseline assessment tool — not a compliance guarantee.
              Find, track, and fix accessibility issues systematically.
            </p>
            <Button size="lg" className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white shadow-lg shadow-[hsl(262,83%,68%)]/25 border-0 text-base px-8 h-12" asChild>
              <Link href="/login">
                Start your free trial
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} AccessKit. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
