/**
 * Scanner worker — serves the Playwright-heavy `scan-website` Inngest function
 * on its own long-running process, separated from the Next.js app.
 *
 * Why this exists
 * ───────────────
 * `scanWebsiteJob` launches Chromium via Playwright. A single scan with the
 * default 3-way concurrency holds ~700 MB – 1 GB of resident RAM, which OOMs
 * on Vercel/Lambda Node functions (1 GB ceiling) and saturates Vercel Fluid.
 * By moving the function to a dedicated Node process on Fly.io Machines
 * (2 GB RAM, scale-to-zero), the Next.js web tier stays lean and scans run
 * with plenty of headroom.
 *
 * Wiring
 * ──────
 * - The worker registers itself with Inngest Cloud using the shared client
 *   (same app id: `accesskit`) and advertises only `scanWebsiteJob`.
 * - Inngest Cloud routes every `scan/website.requested` event to whichever
 *   endpoint currently serves that function id. With `RUN_SCANS_IN_NEXT`
 *   unset in production, the worker is the sole provider.
 * - The Next.js `/api/inngest` route conditionally excludes the scan job
 *   (see `src/app/api/inngest/route.ts`) so the two tiers don't double-register.
 *
 * Deploy
 * ──────
 * See `Dockerfile`, `fly.toml`, and FIX_PLAN.md § H1 for the Fly.io topology.
 * Required env vars: DATABASE_URL, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY,
 * plus any scanner toggles (`SCANNER_ENABLE_PA11Y`).
 */

import http from "node:http";
import { serve } from "inngest/node";
import { inngest } from "../src/inngest/client";
import { scanWebsiteJob } from "../src/inngest/scan-website";

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";
const INNGEST_PATH = "/api/inngest";
const HEALTH_PATH = "/health";

const inngestHandler = serve({
  client: inngest,
  functions: [scanWebsiteJob],
  // Fly.io Machines sit behind the Fly Proxy, which presents HTTPS to Inngest
  // Cloud. `serveHost` isn't needed because Inngest auto-detects the public
  // URL from incoming signed requests once registered.
});

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400).end();
    return;
  }

  // Strip query string before path comparison
  const path = req.url.split("?")[0];

  // Fly Proxy health check — must respond ≤2 s without touching Inngest/DB.
  // Returning 200 signals the Machine is ready to receive traffic.
  if (path === HEALTH_PATH || path === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "accesskit-scanner" }));
    return;
  }

  if (path?.startsWith(INNGEST_PATH)) {
    return inngestHandler(req, res);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Graceful shutdown: Fly sends SIGINT before stopping a Machine. Draining
// in-flight requests prevents partial scan writes mid-step.
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[scanner] received ${signal}, draining HTTP server…`);
  server.close((err) => {
    if (err) {
      console.error("[scanner] server.close error:", err);
      process.exit(1);
    }
    console.log("[scanner] shutdown complete");
    process.exit(0);
  });
  // Hard-kill if drain takes too long (Fly's default grace is 30 s).
  setTimeout(() => {
    console.warn("[scanner] force exit after 25s drain timeout");
    process.exit(1);
  }, 25_000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, HOST, () => {
  console.log(`[scanner] listening on http://${HOST}:${PORT}${INNGEST_PATH}`);
});
