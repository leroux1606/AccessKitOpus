"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_NAMES, PLAN_PRICES } from "@/lib/plans";
import { PlanType } from "@prisma/client";
import { CreditCard, ExternalLink, ArrowRight, Loader2 } from "lucide-react";

interface BillingActionsProps {
  currentPlan: PlanType;
  subscriptionStatus: string;
  hasStripeCustomer: boolean;
  hasPaystackSubscription: boolean;
  upgradePlans: PlanType[];
}

export function BillingActions({
  currentPlan,
  subscriptionStatus,
  hasStripeCustomer,
  hasPaystackSubscription,
  upgradePlans,
}: BillingActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStripePortal() {
    setLoading("stripe-portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  async function handlePaystackPortal() {
    setLoading("paystack-portal");
    try {
      const res = await fetch("/api/billing/paystack-portal", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  async function handlePaystackCheckout(plan: PlanType, interval: "monthly" | "annual" = "monthly") {
    setLoading(`paystack-${plan}-${interval}`);
    try {
      const res = await fetch("/api/billing/paystack-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Manage PayStack subscription */}
      {hasPaystackSubscription && subscriptionStatus !== "CANCELED" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-sm">Manage billing</h3>
                  <p className="text-xs text-muted-foreground">
                    Update payment method, view invoices, or cancel subscription
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePaystackPortal}
                disabled={loading === "paystack-portal"}
              >
                {loading === "paystack-portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Open billing portal
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manage Stripe subscription (legacy / international) */}
      {hasStripeCustomer && !hasPaystackSubscription && subscriptionStatus !== "CANCELED" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-sm">Manage billing</h3>
                  <p className="text-xs text-muted-foreground">
                    Update payment method, view invoices, or cancel subscription
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStripePortal}
                disabled={loading === "stripe-portal"}
              >
                {loading === "stripe-portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Open billing portal
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade options */}
      {upgradePlans.length > 0 && currentPlan !== "ENTERPRISE" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Upgrade your plan</h3>
              <p className="text-sm text-muted-foreground">
                Get more websites, faster scans, and premium features.
              </p>
            </div>

            <div className="grid gap-3">
              {upgradePlans.map((plan) => {
                const prices = PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
                return (
                  <div
                    key={plan}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{PLAN_NAMES[plan]}</span>
                        <Badge variant="secondary" className="text-xs">
                          ${prices.monthly}/mo
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        or ${prices.annual}/mo billed annually
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePaystackCheckout(plan)}
                        disabled={!!loading}
                        className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0"
                      >
                        {loading === `paystack-${plan}-monthly` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Upgrade
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* First-time subscription (trial or canceled, no active subscription) */}
      {!hasPaystackSubscription && !hasStripeCustomer && (subscriptionStatus === "TRIALING" || subscriptionStatus === "CANCELED") && upgradePlans.length === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-1">Subscribe to keep scanning</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your trial will end soon. Subscribe to a plan to continue using AccessKit.
            </p>
            <Button
              onClick={() => handlePaystackCheckout(currentPlan)}
              disabled={!!loading}
              className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0"
            >
              {loading === `paystack-${currentPlan}-monthly` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Subscribe to {PLAN_NAMES[currentPlan]}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
