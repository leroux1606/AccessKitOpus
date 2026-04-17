"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initPostHog, optOutPostHog, CONSENT_KEY } from "@/components/posthog-provider";

/**
 * GDPR / PECR cookie consent banner.
 * Shown on first visit; choice is persisted in localStorage.
 * Analytics (PostHog) must not fire until "accepted" is stored.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    initPostHog();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    optOutPostHog();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-xl border border-border/50 bg-card/95 backdrop-blur-md p-5 shadow-2xl shadow-black/30"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          We use essential cookies to operate AccessKit and optional analytics
          cookies to improve the product.{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-border/50 bg-secondary/50 hover:bg-secondary text-foreground"
            onClick={decline}
          >
            Essential only
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0"
            onClick={accept}
          >
            Accept all
          </Button>
          <button
            onClick={decline}
            aria-label="Dismiss cookie notice (decline optional cookies)"
            className="ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
