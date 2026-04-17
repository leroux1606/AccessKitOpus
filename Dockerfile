# syntax=docker/dockerfile:1.7
#
# AccessKit scanner worker — runs the Playwright-heavy `scan-website`
# Inngest function on Fly.io Machines. See `worker/server.ts` and
# FIX_PLAN.md § H1 for the architectural context.
#
# Base image: Microsoft's official Playwright image pins an exact Chromium
# build plus every Linux library Chromium needs (libnss3, libgbm1, fonts,
# etc.). Keeping the tag pinned to the same Playwright version we depend on
# in `package.json` prevents browser-vs-driver drift on every deploy.

ARG PLAYWRIGHT_VERSION=1.58.2

# ────────────────────────────────────────────────────────────────────────
# Stage 1: deps — install production + build deps with pnpm
# ────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS deps

WORKDIR /app

# Use Corepack so we don't baked-in a pnpm version that drifts from the
# team's local install. `packageManager` field in package.json (if set)
# is honoured; otherwise corepack prepares the latest pnpm 9.x.
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

# `--frozen-lockfile` fails the build if pnpm-lock.yaml is out of date,
# catching accidental drift. `--prod=false` installs devDependencies too
# because we need `tsx` and `typescript` at runtime (the worker entry
# point is a TS file we execute via tsx — no separate build step).
RUN pnpm install --frozen-lockfile --prod=false

# Prisma client must be generated against the pinned schema. Doing it here
# (inside deps) keeps it cached separately from source-code changes.
RUN pnpm prisma generate

# ────────────────────────────────────────────────────────────────────────
# Stage 2: runtime
# ────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runtime

# pwuser ships with the base image and owns /ms-playwright. Using it avoids
# running Chromium as root, which some Linux kernels refuse to launch.
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    # Point Playwright at the pre-installed browsers in /ms-playwright so we
    # don't re-download Chromium at runtime.
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    # Inngest detects environment from NODE_ENV; no extra config needed here.
    # Force pnpm onto the PATH for Corepack-managed binaries.
    PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy the fully-installed node_modules (including the generated prisma
# client under node_modules/.prisma) and the source tree.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json pnpm-lock.yaml* tsconfig.json ./
COPY src ./src
COPY worker ./worker

# Fly's proxy sends a health probe before routing traffic. `worker/server.ts`
# responds 200 on `/health` without touching Inngest or Prisma, so the probe
# stays lightweight.
EXPOSE 8080

# `tsx` is already in devDependencies; running the TS entry directly means
# we skip a compile step and keep the image simpler. For a hot-path worker
# the startup cost is negligible (~300 ms).
CMD ["pnpm", "exec", "tsx", "worker/server.ts"]
