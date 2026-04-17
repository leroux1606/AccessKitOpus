#!/usr/bin/env node
/**
 * AccessKit CLI — zero-dependency Node 20+ script that wraps the
 * `/api/v1/scans` REST surface so CI systems (GitHub Actions, GitLab,
 * CircleCI, Jenkins, …) can run accessibility scans on every build and
 * fail the pipeline when thresholds are breached.
 *
 * Design goals
 * ────────────
 * 1. **Zero install cost.** Pure Node built-ins (`fetch` is native in
 *    20+). No npm install in CI — just `curl` this file and `node` it.
 * 2. **Scriptable.** Every command supports `--json` for parsing; exit
 *    codes follow Unix conventions (0 ok, 1 threshold breach, 2 usage,
 *    3 API error, 4 timeout).
 * 3. **Extraction-ready.** This file is safe to `git subtree split`
 *    into its own public repo (`accesskit/cli`) so customers can
 *    `npm install -g @accesskit/cli` once we publish. Until then the
 *    in-tree version is canonical.
 *
 * Usage (abbreviated — `accesskit --help` for the full list):
 *
 *     ACCESSKIT_API_KEY=ak_live_...
 *     ACCESSKIT_API_URL=https://app.accesskit.example
 *
 *     accesskit scan <websiteId>          # trigger + poll + exit-code gate
 *     accesskit status <scanId>           # one-shot status lookup
 *     accesskit list [--website <id>]     # recent scans
 */

const VERSION = "1.0.0";

const EXIT = {
  OK: 0,
  THRESHOLD_BREACH: 1,
  USAGE: 2,
  API_ERROR: 3,
  TIMEOUT: 4,
};

// ─── CLI-agnostic helpers ────────────────────────────────────────────────────

/** Parse process argv in a minimal, dependency-free way. */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      if (eq !== -1) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
        i++;
      } else {
        const key = tok.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("-")) {
          flags[key] = true;
          i++;
        } else {
          flags[key] = next;
          i += 2;
        }
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      // Short flags: only -h and -v are recognised.
      for (const ch of tok.slice(1)) {
        if (ch === "h") flags.help = true;
        else if (ch === "v") flags.version = true;
      }
      i++;
    } else {
      positional.push(tok);
      i++;
    }
  }
  return { positional, flags };
}

function resolveApiConfig(flags) {
  const apiKey = flags["api-key"] || process.env.ACCESSKIT_API_KEY;
  const apiUrl =
    flags["api-url"] ||
    process.env.ACCESSKIT_API_URL ||
    "https://app.accesskit.dev";
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, "") };
}

/** Thin fetch wrapper that throws rich errors for non-2xx. */
async function apiFetch(apiUrl, apiKey, path, init = {}) {
  if (!apiKey) {
    const err = new Error(
      "Missing API key. Set ACCESSKIT_API_KEY or pass --api-key=<key>.",
    );
    err.code = EXIT.USAGE;
    throw err;
  }
  const res = await fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `accesskit-cli/${VERSION}`,
      ...(init.headers || {}),
    },
  });

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!res.ok) {
    const err = new Error(
      `API ${res.status} ${res.statusText}: ${body?.error || text || "(no body)"}`,
    );
    err.code = EXIT.API_ERROR;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Pure: threshold evaluation ──────────────────────────────────────────────

/**
 * Decide whether a completed scan breaches any configured CI threshold.
 * Pure — takes counts + threshold config, returns a list of failure
 * reasons (empty array = pass). Exported for testability.
 */
export function evaluateThresholds(scan, thresholds) {
  const reasons = [];
  const {
    failOnCritical,
    failOnSerious,
    failOnModerate,
    failOnMinor,
    failOnAny,
    minScore,
  } = thresholds;

  // `failOn*` semantics: fail when the count is strictly greater than
  // the configured value (so `--fail-on-critical 0` = "any critical
  // fails", `--fail-on-critical 5` = "up to 5 is fine").
  const maybeCompare = (label, count, limit) => {
    if (limit === undefined || limit === null) return;
    const actual = count ?? 0;
    if (actual > limit) {
      reasons.push(`${label} count ${actual} exceeds limit ${limit}`);
    }
  };

  maybeCompare("CRITICAL", scan.criticalCount, failOnCritical);
  maybeCompare("SERIOUS", scan.seriousCount, failOnSerious);
  maybeCompare("MODERATE", scan.moderateCount, failOnModerate);
  maybeCompare("MINOR", scan.minorCount, failOnMinor);

  if (failOnAny !== undefined && failOnAny !== null) {
    const total = scan.totalViolations ?? 0;
    if (total > failOnAny) {
      reasons.push(`total violations ${total} exceeds limit ${failOnAny}`);
    }
  }

  if (minScore !== undefined && minScore !== null && scan.score !== null) {
    if (scan.score < minScore) {
      reasons.push(`score ${scan.score} is below minimum ${minScore}`);
    }
  }

  return reasons;
}

/** Coerce a CLI flag value to an integer or return undefined. */
export function asInt(val) {
  if (val === undefined || val === null || val === true || val === false) {
    return undefined;
  }
  const n = Number.parseInt(String(val), 10);
  return Number.isFinite(n) ? n : undefined;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatScanSummary(scan) {
  const lines = [
    `scan:         ${scan.id}`,
    `website:      ${scan.websiteId}`,
    `status:       ${scan.status}`,
    `score:        ${scan.score ?? "—"}/100`,
    `pages:        ${scan.pagesScanned ?? 0}`,
    `violations:   ${scan.totalViolations ?? 0} ` +
      `(${scan.criticalCount ?? 0} critical, ` +
      `${scan.seriousCount ?? 0} serious, ` +
      `${scan.moderateCount ?? 0} moderate, ` +
      `${scan.minorCount ?? 0} minor)`,
    `duration:     ${scan.duration != null ? `${(scan.duration / 1000).toFixed(1)}s` : "—"}`,
    `completed at: ${scan.completedAt ?? "—"}`,
  ];
  if (scan.errorMessage) lines.push(`error:        ${scan.errorMessage}`);
  return lines.join("\n");
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdScan(flags, positional) {
  const websiteId = positional[0] || flags.website;
  if (!websiteId) {
    process.stderr.write("Usage: accesskit scan <websiteId> [flags]\n");
    return EXIT.USAGE;
  }

  const { apiKey, apiUrl } = resolveApiConfig(flags);
  const json = Boolean(flags.json);
  const wait = flags.wait !== "false" && flags.wait !== false;
  const timeoutSec = asInt(flags.timeout) ?? 600;
  const pollSec = Math.max(2, asInt(flags["poll-interval"]) ?? 10);

  const thresholds = {
    failOnCritical: asInt(flags["fail-on-critical"]),
    failOnSerious: asInt(flags["fail-on-serious"]),
    failOnModerate: asInt(flags["fail-on-moderate"]),
    failOnMinor: asInt(flags["fail-on-minor"]),
    failOnAny: asInt(flags["fail-on-any"]),
    minScore: asInt(flags["min-score"]),
  };

  if (!json) {
    process.stderr.write(`▶ Triggering scan for website ${websiteId}…\n`);
  }

  let scan;
  try {
    const res = await apiFetch(apiUrl, apiKey, "/scans", {
      method: "POST",
      body: JSON.stringify({ websiteId }),
    });
    scan = res.data;
  } catch (err) {
    // If a scan is already running, the API returns 409 with scanId so
    // we can just latch onto it rather than erroring out — matches the
    // "CI should be idempotent" principle.
    if (err.status === 409 && err.body?.scanId) {
      if (!json) {
        process.stderr.write(
          `  existing scan ${err.body.scanId} already in progress, attaching…\n`,
        );
      }
      scan = { id: err.body.scanId };
    } else {
      process.stderr.write(`✖ ${err.message}\n`);
      return err.code ?? EXIT.API_ERROR;
    }
  }

  if (!wait) {
    if (json) process.stdout.write(JSON.stringify(scan) + "\n");
    else process.stdout.write(`Queued scan ${scan.id}\n`);
    return EXIT.OK;
  }

  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await apiFetch(apiUrl, apiKey, `/scans/${scan.id}`);
      scan = res.data;
    } catch (err) {
      process.stderr.write(`✖ ${err.message}\n`);
      return err.code ?? EXIT.API_ERROR;
    }

    if (scan.status === "COMPLETED" || scan.status === "FAILED") break;

    if (!json) {
      process.stderr.write(
        `  [${new Date().toISOString()}] status=${scan.status}, pages=${scan.pagesScanned ?? 0}\n`,
      );
    }
    await sleep(pollSec * 1000);
  }

  if (scan.status !== "COMPLETED" && scan.status !== "FAILED") {
    process.stderr.write(
      `✖ Timed out after ${timeoutSec}s waiting for scan ${scan.id} (last status: ${scan.status}).\n`,
    );
    if (json) process.stdout.write(JSON.stringify(scan) + "\n");
    return EXIT.TIMEOUT;
  }

  if (json) {
    process.stdout.write(JSON.stringify(scan) + "\n");
  } else {
    process.stdout.write(formatScanSummary(scan) + "\n");
  }

  if (scan.status === "FAILED") {
    process.stderr.write(`✖ Scan failed: ${scan.errorMessage ?? "no details"}\n`);
    return EXIT.API_ERROR;
  }

  const breaches = evaluateThresholds(scan, thresholds);
  if (breaches.length > 0) {
    process.stderr.write(`✖ Accessibility thresholds breached:\n`);
    for (const b of breaches) process.stderr.write(`  • ${b}\n`);
    return EXIT.THRESHOLD_BREACH;
  }

  if (!json) process.stderr.write(`✔ All thresholds passed.\n`);
  return EXIT.OK;
}

async function cmdStatus(flags, positional) {
  const scanId = positional[0];
  if (!scanId) {
    process.stderr.write("Usage: accesskit status <scanId>\n");
    return EXIT.USAGE;
  }
  const { apiKey, apiUrl } = resolveApiConfig(flags);
  try {
    const res = await apiFetch(apiUrl, apiKey, `/scans/${scanId}`);
    if (flags.json) process.stdout.write(JSON.stringify(res.data) + "\n");
    else process.stdout.write(formatScanSummary(res.data) + "\n");
    return EXIT.OK;
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    return err.code ?? EXIT.API_ERROR;
  }
}

async function cmdList(flags) {
  const { apiKey, apiUrl } = resolveApiConfig(flags);
  const params = new URLSearchParams();
  if (flags.website) params.set("websiteId", String(flags.website));
  if (flags.limit) params.set("limit", String(flags.limit));
  const qs = params.toString();
  try {
    const res = await apiFetch(apiUrl, apiKey, `/scans${qs ? `?${qs}` : ""}`);
    if (flags.json) {
      process.stdout.write(JSON.stringify(res) + "\n");
    } else {
      const rows = res.data ?? [];
      if (rows.length === 0) {
        process.stdout.write("(no scans)\n");
        return EXIT.OK;
      }
      for (const s of rows) {
        process.stdout.write(
          `${s.id}\t${s.status}\tscore=${s.score ?? "—"}\tviolations=${s.totalViolations ?? 0}\t${s.createdAt}\n`,
        );
      }
    }
    return EXIT.OK;
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    return err.code ?? EXIT.API_ERROR;
  }
}

// ─── Entry ──────────────────────────────────────────────────────────────────

const HELP = `accesskit ${VERSION} — accessibility scans for your CI

Usage:
  accesskit scan <websiteId>     Trigger a scan and wait for it to finish
  accesskit status <scanId>      Fetch a single scan's current state
  accesskit list                 List recent scans (filter with --website)

Auth (one of these must be set):
  --api-key <key>                API key (ak_live_...)
  ACCESSKIT_API_KEY env var      Same — preferred in CI

Target:
  --api-url <url>                Base URL of your AccessKit deployment
  ACCESSKIT_API_URL env var      Default: https://app.accesskit.dev

\`scan\` flags:
  --no-wait                      Return immediately after queuing
  --timeout <seconds>            Max total wait for completion (default 600)
  --poll-interval <seconds>      How often to poll (default 10, min 2)
  --fail-on-critical <N>         Exit 1 if critical count > N
  --fail-on-serious  <N>         Exit 1 if serious  count > N
  --fail-on-moderate <N>         Exit 1 if moderate count > N
  --fail-on-minor    <N>         Exit 1 if minor    count > N
  --fail-on-any      <N>         Exit 1 if total violations > N
  --min-score        <0-100>     Exit 1 if score < value
  --json                         Machine-readable output (final scan object)

Exit codes:
  0 success              1 threshold breach        2 usage error
  3 API/network error    4 polling timeout

Examples:
  accesskit scan wst_abc123 --fail-on-critical 0 --min-score 90
  accesskit status scan_xyz789 --json
  accesskit list --website wst_abc123 --limit 5
`;

async function main(argv) {
  const { positional, flags } = parseArgs(argv);

  if (flags.version) {
    process.stdout.write(`accesskit ${VERSION}\n`);
    return EXIT.OK;
  }
  if (flags.help || positional.length === 0) {
    process.stdout.write(HELP);
    return positional.length === 0 && !flags.help ? EXIT.USAGE : EXIT.OK;
  }

  const [command, ...rest] = positional;
  switch (command) {
    case "scan":
      return cmdScan(flags, rest);
    case "status":
      return cmdStatus(flags, rest);
    case "list":
      return cmdList(flags);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return EXIT.USAGE;
  }
}

// Only run the CLI when invoked directly — leaves the module importable
// from tests (`evaluateThresholds`, `asInt`, `parseArgs`).
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const isEntry = (() => {
  try {
    const entry = realpathSync(fileURLToPath(import.meta.url));
    const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
    return entry === invoked;
  } catch {
    return false;
  }
})();

if (isEntry) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code ?? EXIT.OK))
    .catch((err) => {
      process.stderr.write(`✖ unexpected error: ${err?.stack || err}\n`);
      process.exit(EXIT.API_ERROR);
    });
}

export { parseArgs, resolveApiConfig };
