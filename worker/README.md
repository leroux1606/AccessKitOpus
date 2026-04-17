# AccessKit scanner worker

Standalone Node process that serves the Playwright-heavy `scan-website`
Inngest function on its own machine, separated from the Next.js web tier.

## Why it exists

The scanner launches Chromium via Playwright. Each concurrent scan holds
roughly **700 MB – 1 GB** of resident RAM, which OOMs on Vercel/AWS Lambda's
1 GB Node function ceiling and chokes Vercel Fluid under load. Running the
function in a dedicated container with 2 GB+ RAM and scale-to-zero keeps
the web tier lean and scans fast.

## Architecture

```
 ┌──────────────────┐     scan/website.requested        ┌────────────────────┐
 │ Next.js on       │────────────────────────────────▶ │ Inngest Cloud       │
 │ Vercel / Fly     │                                    │                    │
 │ (web tier)       │◀─── /api/inngest (non-scan fns) ──│  Function registry │
 └──────────────────┘                                    └─────────┬──────────┘
                                                                   │
                                      /api/inngest (scanWebsiteJob)│
                                                                   ▼
                                                    ┌───────────────────────────┐
                                                    │ Fly.io Machine            │
                                                    │ accesskit-scanner         │
                                                    │ worker/server.ts          │
                                                    │ Playwright + Chromium     │
                                                    └───────────────────────────┘
```

Both processes share:

- The same Inngest app id (`accesskit`) — so events flow through one
  project in the Inngest dashboard.
- The same Postgres (Supabase) — worker reads/writes via the same Prisma
  schema.

They **differ** in which functions they advertise:

- Next.js `/api/inngest` serves every function except `scan-website`
  (controlled by `RUN_SCANS_IN_NEXT` — see
  [`src/app/api/inngest/route.ts`](../src/app/api/inngest/route.ts)).
- The worker serves only `scan-website`.

When Inngest receives a `scan/website.requested` event, it POSTs to
whichever endpoint is registered for that function id — i.e. the worker.

## Local development

```bash
# Default: Next.js runs the scanner in-process (dev RAM is plentiful).
pnpm dev

# Or run the split topology locally (matches production):
pnpm dev                 # terminal 1 — web tier
RUN_SCANS_IN_NEXT=false pnpm dev       # optional override
pnpm worker:dev          # terminal 2 — worker on :8080
npx inngest-cli@latest dev               # terminal 3 — Inngest dev server
```

## Production deploy (Fly.io)

One-time setup:

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --name accesskit-scanner --no-deploy --copy-config

# Worker secrets — these never leave Fly's vault
fly secrets set \
  DATABASE_URL="postgres://…" \
  INNGEST_EVENT_KEY="…" \
  INNGEST_SIGNING_KEY="signkey-…" \
  ANTHROPIC_API_KEY="sk-ant-…"        # optional; only if AI fixes enabled

fly deploy
```

After first deploy, set `RUN_SCANS_IN_NEXT=false` (or simply leave unset) in
the web tier's production env so only the worker advertises `scan-website`
to Inngest. If both endpoints register the same function id, Inngest picks
one arbitrarily and you could still hit the 1 GB OOM path.

## Tuning

- **Memory.** Default Machine is `shared-cpu-1x` with 2 GB RAM — enough for
  the Inngest-enforced 3-way concurrency without pa11y. If you enable
  `SCANNER_ENABLE_PA11Y=true`, bump `memory_mb` in `fly.toml` to 4096 and
  revisit `cpus`.
- **Regions.** `primary_region = "iad"` matches Supabase US-East. For EU
  customers, run a second Machine group in `cdg` or `ams`.
- **Cold start.** Fly Machines wake from `auto_stop_machines=stop` in
  ~1–3 s. Inngest retries failed deliveries, so cold-start timeouts are
  transparent to the user. For sub-second cold starts, set
  `min_machines_running = 1` (trades ~$2/mo of always-on cost).

## Health check

The worker answers `GET /health` with `{ "status": "ok" }` and
`Content-Type: application/json`. The endpoint does not touch Inngest,
Prisma, or Playwright — it's meant as a liveness signal for the Fly proxy.

## Shutdown semantics

Fly sends `SIGINT` when stopping a Machine (e.g. during `fly deploy`).
`worker/server.ts` stops accepting new connections immediately and gives
open HTTP requests up to 25 s to finish before force-exit. Inngest step
guarantees mean any scan interrupted mid-write is safe to retry thanks
to `save-results` idempotency (see FIX_PLAN § C1).
