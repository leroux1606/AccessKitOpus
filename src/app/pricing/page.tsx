"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";

const plans = [
  {
    key: "STARTER",
    name: "Starter",
    description: "For freelancers and small websites",
    monthly: 49,
    annual: 39,
    features: [
      { text: "3 websites", included: true },
      { text: "50 pages per scan", included: true },
      { text: "1 team seat", included: true },
      { text: "Monthly scans", included: true },
      { text: "WCAG 2.1 AA scanning", included: true },
      { text: "Basic PDF reports", included: true },
      { text: "Generic remediation tips", included: true },
      { text: "Email support", included: true },
      { text: "CI/CD integration", included: false },
      { text: "Client portal", included: false },
      { text: "White-label", included: false },
      { text: "API access", included: false },
    ],
  },
  {
    key: "PROFESSIONAL",
    name: "Professional",
    description: "For growing agencies and teams",
    monthly: 149,
    annual: 119,
    popular: true,
    features: [
      { text: "25 websites", included: true },
      { text: "250 pages per scan", included: true },
      { text: "3 team seats", included: true },
      { text: "Weekly scans", included: true },
      { text: "All accessibility standards", included: true },
      { text: "PDF + CSV + shareable reports", included: true },
      { text: "Code-level fix suggestions", included: true },
      { text: "Priority email support", included: true },
      { text: "GitHub Actions CI/CD", included: true },
      { text: "Issue assignment & workflow", included: true },
      { text: "Client portal", included: false },
      { text: "White-label", included: false },
    ],
  },
  {
    key: "AGENCY",
    name: "Agency",
    description: "For agencies managing client sites",
    monthly: 349,
    annual: 279,
    features: [
      { text: "150 websites", included: true },
      { text: "1,000 pages per scan", included: true },
      { text: "10 team seats", included: true },
      { text: "Daily scans", included: true },
      { text: "All accessibility standards", included: true },
      { text: "White-label compliance reports", included: true },
      { text: "AI-powered fix suggestions", included: true },
      { text: "Slack + onboarding support", included: true },
      { text: "All CI/CD + REST API", included: true },
      { text: "Full issue workflow + client view", included: true },
      { text: "Branded client portal", included: true },
      { text: "Competitor benchmarking (5)", included: true },
    ],
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");

  async function handleCheckout(plan: string) {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval, type: "subscription" }),
    });

    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    } else {
      // Not logged in or error — redirect to login
      window.location.href = "/login";
    }
  }

  async function handleAuditCheckout() {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "one-time-audit" }),
    });

    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,68%)] opacity-[0.07] blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full bg-[hsl(220,70%,50%)] opacity-[0.05] blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-lg flex items-center justify-center shadow-lg shadow-[hsl(262,83%,68%)]/20">
            <span className="text-white font-bold text-sm" aria-hidden="true">AK</span>
          </div>
          <span className="font-bold text-lg text-foreground">AccessKit</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white shadow-lg shadow-[hsl(262,83%,68%)]/25 border-0" asChild>
            <Link href="/login">Start free trial</Link>
          </Button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Upgrade when you&apos;re ready.
          </p>

          {/* Interval toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                interval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                interval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <Badge variant="secondary" className="ml-2 text-xs">Save 20%</Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={`relative flex flex-col ${
                plan.popular
                  ? "border-[hsl(262,83%,68%)]/50 shadow-lg shadow-[hsl(262,83%,68%)]/10"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] text-white border-0 px-3">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${interval === "annual" ? plan.annual : plan.monthly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {interval === "annual" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Billed annually (${plan.annual * 12}/year)
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground/60"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCheckout(plan.key)}
                  className={
                    plan.popular
                      ? "bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0 w-full"
                      : "w-full"
                  }
                  variant={plan.popular ? "default" : "outline"}
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise CTA */}
        <Card className="mb-16">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-8">
            <div>
              <h3 className="text-xl font-bold mb-1">Enterprise</h3>
              <p className="text-muted-foreground">
                Unlimited websites, custom integrations, dedicated support, SLA tracking, and SSO.
                For large organizations with complex compliance requirements.
              </p>
            </div>
            <Button variant="outline" size="lg" className="shrink-0" asChild>
              <Link href="mailto:sales@accesskit.app">Contact sales</Link>
            </Button>
          </CardContent>
        </Card>

        {/* One-time audit */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold">One-Time Accessibility Audit</h3>
                <Badge variant="secondary">$499</Badge>
              </div>
              <p className="text-muted-foreground">
                Full audit of one website (up to 500 pages), comprehensive compliance report,
                remediation guide, and one free re-scan after 30 days. No subscription required.
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="shrink-0"
              onClick={handleAuditCheckout}
            >
              Purchase audit
            </Button>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "What happens after my free trial?",
                a: "After 14 days, you'll be prompted to select a plan. If you don't subscribe, your account stays active in read-only mode — you can still view past reports but won't be able to run new scans.",
              },
              {
                q: "Can I change plans anytime?",
                a: "Yes. Upgrade or downgrade at any time from your billing settings. When upgrading, you're charged the prorated difference. When downgrading, the new rate takes effect at the next billing cycle.",
              },
              {
                q: "What standards do you support?",
                a: "All plans include WCAG 2.1 Level AA scanning. Professional and Agency plans add WCAG 2.2, Section 508, EN 301 549, and ADA compliance mapping.",
              },
              {
                q: "Do you offer refunds?",
                a: "Yes, we offer full refunds within 14 days of purchase for any unused subscription time. Contact support to request a refund.",
              },
              {
                q: "What's included in the one-time audit?",
                a: "A comprehensive scan of up to 500 pages, a detailed compliance report with specific code-level fixes, priority-ranked by impact, plus a follow-up re-scan after 30 days to verify your fixes.",
              },
            ].map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold mb-1">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 mt-16 py-8 text-center text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} AccessKit. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
