import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  // Modern Reporting API endpoint — browsers POST CSP violations here.
  {
    key: "Reporting-Endpoints",
    value: `csp-endpoint="/api/csp-report"`,
  },
  // Content Security Policy — restricts resource loading to trusted origins.
  // Enforced (not report-only) and pipes violations to /api/csp-report via
  // both the legacy `report-uri` and modern `report-to` directives so we
  // can observe what gets blocked in production.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-eval only in dev (Next.js HMR needs it); unsafe-inline kept for inline scripts
      `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://app.posthog.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://app.posthog.com https://us.i.posthog.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; "),
  },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer information sent cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict unnecessary browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Force HTTPS for 2 years (browsers will reject HTTP after first visit)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Enable DNS prefetch for performance
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
