# @accesskit/cli

Run AccessKit accessibility scans from your terminal or CI pipeline.

- **Zero runtime dependencies.** A single `accesskit.mjs` file using
  Node 20's built-in `fetch` — no `node_modules` required, no install
  step in CI.
- **CI-friendly exit codes.** `0` pass, `1` threshold breach, `2` usage,
  `3` API error, `4` polling timeout. Drop it into any runner.
- **JSON mode.** `--json` on any command emits a parseable payload.

## Installation

### Option A — `npx` (once published to npm)

```bash
npx @accesskit/cli scan wst_abc123 --fail-on-critical 0
```

### Option B — curl (anywhere, zero install)

```bash
curl -fsSL https://raw.githubusercontent.com/leroux1606/AccessKitOpus/main/cli/accesskit.mjs \
  -o /usr/local/bin/accesskit
chmod +x /usr/local/bin/accesskit
accesskit --version
```

### Option C — GitHub Actions

Use the [AccessKit GitHub Action](../github-action/README.md) which
bundles this CLI.

## Configuration

Both an API key and the base URL of your AccessKit deployment are
required.

| Source              | API key              | Base URL              |
|---------------------|----------------------|-----------------------|
| CLI flag            | `--api-key <key>`    | `--api-url <url>`     |
| Environment         | `ACCESSKIT_API_KEY`  | `ACCESSKIT_API_URL`   |
| Default             | —                    | `https://app.accesskit.dev` |

API keys are created from **Settings → API Keys** and require an
Agency plan or higher.

## Commands

### `accesskit scan <websiteId>`

Triggers a scan, polls until it completes, and gates the exit code on
thresholds.

**Threshold flags** (any combination — all must pass for exit 0):

- `--fail-on-critical <N>` — fail when `critical > N`
- `--fail-on-serious <N>`  — fail when `serious > N`
- `--fail-on-moderate <N>` — fail when `moderate > N`
- `--fail-on-minor <N>`    — fail when `minor > N`
- `--fail-on-any <N>`      — fail when `totalViolations > N`
- `--min-score <0..100>`   — fail when `score < value`

**Polling flags:**

- `--no-wait` — return immediately after queuing (useful for fire-and-forget)
- `--timeout <seconds>` (default `600`) — overall deadline
- `--poll-interval <seconds>` (default `10`, min `2`)

**Output flags:**

- `--json` — emit only the final scan JSON on stdout (status logs go to stderr)

**Behaviour on 409 (scan already in progress):** the CLI attaches to
the existing scan rather than erroring, so re-runs of the same CI job
are idempotent.

### `accesskit status <scanId>`

One-shot status lookup. Useful in workflows that run a long scan in
one job and poll it in another.

### `accesskit list`

Lists recent scans. Flags: `--website <id>`, `--limit <N>`.

## CI Recipes

### GitHub Actions

See [`docs/examples/accessibility-ci.yml`](../docs/examples/accessibility-ci.yml)
or the [Action README](../github-action/README.md).

### GitLab CI

```yaml
accessibility:
  image: node:20-alpine
  variables:
    ACCESSKIT_API_KEY: $ACCESSKIT_API_KEY
    ACCESSKIT_API_URL: https://app.accesskit.example
  script:
    - wget -qO accesskit https://raw.githubusercontent.com/leroux1606/AccessKitOpus/main/cli/accesskit.mjs
    - chmod +x accesskit
    - ./accesskit scan $ACCESSKIT_WEBSITE_ID --fail-on-critical 0 --min-score 85
  only: [merge_requests, main]
```

### CircleCI

```yaml
version: 2.1
jobs:
  a11y-scan:
    docker: [{ image: cimg/node:20.11 }]
    steps:
      - run:
          name: Run AccessKit scan
          command: |
            curl -fsSL https://raw.githubusercontent.com/leroux1606/AccessKitOpus/main/cli/accesskit.mjs \
              -o /tmp/accesskit && chmod +x /tmp/accesskit
            /tmp/accesskit scan $ACCESSKIT_WEBSITE_ID \
              --fail-on-critical 0 \
              --min-score 85
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | Scan completed and all thresholds passed |
| `1`  | Scan completed but a threshold was breached |
| `2`  | CLI usage error (missing args, bad flags) |
| `3`  | API/network error or scan `FAILED` |
| `4`  | Polling deadline reached |

## Standalone Distribution

This folder is self-contained and safe to extract to its own repo via
`git subtree split --prefix=cli -b cli`, then publish to npm as
`@accesskit/cli`. The in-tree copy remains the canonical source until
then.
