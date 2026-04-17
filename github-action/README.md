# AccessKit GitHub Action

Run an AccessKit accessibility scan from your GitHub workflow and gate
merges on WCAG thresholds.

Wraps the zero-dependency [`@accesskit/cli`](../cli/README.md) in a
composite Action with explicit inputs/outputs and a GitHub-native job
summary.

## Quick start

```yaml
jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: leroux1606/AccessKitOpus/github-action@main
        with:
          api-key: ${{ secrets.ACCESSKIT_API_KEY }}
          website-id: wst_abc123
          fail-on-critical: 0
          min-score: 85
```

> **Note.** The Action currently lives in this repo; reference it via
> `leroux1606/AccessKitOpus/github-action@main`. Once split out to a
> dedicated public repo (see **Split-out** below) you'll reference it
> as `accesskit/action@v1`.

## Inputs

| Input              | Required | Default     | Description |
|--------------------|----------|-------------|-------------|
| `api-key`          | ✅       | —           | API key from Settings → API Keys (store as a repo/org secret). |
| `website-id`       | ✅       | —           | ID of a verified website. |
| `api-url`          | ❌       | `https://app.accesskit.dev` | Base URL of your AccessKit deployment. |
| `fail-on-critical` | ❌       | disabled    | Fail when `critical > N`. Use `0` for strict mode. |
| `fail-on-serious`  | ❌       | disabled    | Fail when `serious > N`. |
| `fail-on-moderate` | ❌       | disabled    | Fail when `moderate > N`. |
| `fail-on-minor`    | ❌       | disabled    | Fail when `minor > N`. |
| `fail-on-any`      | ❌       | disabled    | Fail when total violations > N. |
| `min-score`        | ❌       | disabled    | Fail when scan score < N (0–100). |
| `timeout`          | ❌       | `600`       | Seconds to wait for completion. |
| `poll-interval`    | ❌       | `10`        | Seconds between status polls (min 2). |

Any threshold you leave empty is simply skipped — you can mix and
match (e.g. strict on critical, loose on moderate).

## Outputs

| Output       | Description |
|--------------|-------------|
| `scan-id`    | ID of the scan that ran, e.g. `scan_cx1a…`. |
| `score`      | Final score (0–100) or empty if the scan failed. |
| `status`     | `COMPLETED` \| `FAILED` \| `QUEUED` \| `RUNNING` (last-seen). |
| `violations` | Total violation count. |

Outputs are populated even when a threshold breach fails the job, so
you can post PR comments or Slack messages from a follow-up step
guarded by `if: always()`.

## Recipes

### PR comment with scan summary

```yaml
- id: scan
  uses: leroux1606/AccessKitOpus/github-action@main
  with:
    api-key: ${{ secrets.ACCESSKIT_API_KEY }}
    website-id: wst_abc123
    fail-on-critical: 0

- name: Comment scan result on PR
  if: always() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const { scanId, score, status, violations } = {
        scanId: `${{ steps.scan.outputs.scan-id }}`,
        score: `${{ steps.scan.outputs.score }}`,
        status: `${{ steps.scan.outputs.status }}`,
        violations: `${{ steps.scan.outputs.violations }}`,
      };
      const body = `**AccessKit scan** ${status}\n\n` +
        `Score: **${score}/100** · Violations: **${violations}**\n` +
        `[View full report](https://app.accesskit.dev/scans/${scanId})`;
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body,
      });
```

### Scheduled nightly scan

```yaml
on:
  schedule:
    - cron: "0 3 * * *"   # 03:00 UTC daily

jobs:
  nightly-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: leroux1606/AccessKitOpus/github-action@main
        with:
          api-key: ${{ secrets.ACCESSKIT_API_KEY }}
          website-id: wst_abc123
          min-score: 90
          timeout: 1800
```

## Job summary

On every run the Action writes a table to `$GITHUB_STEP_SUMMARY` with
scan ID, status, score, and violation count, so the Actions run page
shows the outcome at a glance.

## Split-out procedure (maintainers)

This folder is designed to be extractable to its own public repo
(e.g. `accesskit/action`) so customers get a stable `uses:` reference:

```bash
# 1. Split the github-action/ subtree into its own branch
git subtree split --prefix=github-action -b action-release

# 2. Copy the CLI into the action so action.yml's first path resolves
git checkout action-release
cp ../cli/accesskit.mjs ./
git add accesskit.mjs
git commit -m "Bundle CLI v1.0.0"

# 3. Push to the standalone repo and tag a release
git remote add public https://github.com/accesskit/action.git
git push public action-release:main
git tag v1 && git push public v1
```

Customers then use `uses: accesskit/action@v1`. The in-tree version
remains canonical until that happens.
