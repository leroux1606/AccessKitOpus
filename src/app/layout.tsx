import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/cookie-consent";
import { PostHogProvider } from "@/components/posthog-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "AccessKit — Web Accessibility Platform",
    template: "%s | AccessKit",
  },
  description:
    "The most actionable web accessibility platform for agencies. Scan, fix, prove compliance, and resell to clients.",
  keywords: ["accessibility", "WCAG", "ADA", "web compliance", "a11y", "agency"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <PostHogProvider>
          {children}
          <CookieConsent />
        </PostHogProvider>
      </body>
    </html>
  );
}
