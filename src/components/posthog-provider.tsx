"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

export const CONSENT_KEY = "accesskit_cookie_consent";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/**
 * Initialises PostHog only if:
 * 1. NEXT_PUBLIC_POSTHOG_KEY is set
 * 2. The user has explicitly accepted analytics cookies
 *
 * Called from the cookie consent banner (on accept) and on page load
 * (to restore analytics for returning users who already consented).
 */
export function initPostHog() {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (posthog.__loaded) {
    posthog.opt_in_capturing();
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Start opted-out; opt_in_capturing() below enables tracking
    opt_out_capturing_by_default: true,
    persistence: "localStorage+cookie",
    capture_pageview: false, // Handled by PostHogPageView below
    loaded: (ph) => {
      ph.opt_in_capturing();
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export function optOutPostHog() {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (posthog.__loaded) posthog.opt_out_capturing();
}

/**
 * Wraps the app with the PostHog React provider.
 * Restores analytics on mount if the user previously consented.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "accepted") initPostHog();
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
