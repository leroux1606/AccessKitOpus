/**
 * End-to-end coverage of the critical UI flow (Phase L4):
 *
 *   add website → verify → scan → view issue → comment
 *
 * Split into two halves:
 *
 *   1. Read-only smoke tests — run in any authenticated CI environment,
 *      no seed data required. Verify routing for the deep issue /
 *      settings / scans pages. Bogus website IDs should produce a 404
 *      page (not a 500, not a redirect to login) so the route wiring
 *      itself is under test.
 *
 *   2. Write-path chain — gated behind E2E_WRITE_TESTS=true because it
 *      creates real database rows. Chains through every step of the
 *      critical flow in one test so a break at any seam fails loudly.
 */

import { test, expect } from "@playwright/test";

// ─── Read-only smoke tests for deep routes ──────────────────────────────────

test.describe("Deep routes render for authenticated users", () => {
  const FAKE_WEBSITE_ID = "does-not-exist-fixture";
  const FAKE_VIOLATION_ID = "violation-does-not-exist";

  test("unknown website id renders a 404 page, not a 500", async ({ page }) => {
    const response = await page.goto(`/websites/${FAKE_WEBSITE_ID}`);
    // Could be 404 OR Next's notFound() rendering — either way NOT a 5xx
    const status = response?.status() ?? 0;
    expect(status).toBeLessThan(500);
    // Also should not bounce the user to /login — that would mean auth
    // state leaked through the notFound path.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("unknown website settings route does not 500", async ({ page }) => {
    const response = await page.goto(`/websites/${FAKE_WEBSITE_ID}/settings`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("unknown issue route does not 500", async ({ page }) => {
    const response = await page.goto(
      `/websites/${FAKE_WEBSITE_ID}/issues/${FAKE_VIOLATION_ID}`,
    );
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("unknown scans list does not 500", async ({ page }) => {
    const response = await page.goto(`/websites/${FAKE_WEBSITE_ID}/scans`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Write-path chain: add → verify → scan → view issue → comment ───────────

test.describe("Critical flow: add website → verify → scan → view issue → comment", () => {
  test.skip(
    !process.env.E2E_WRITE_TESTS,
    "Set E2E_WRITE_TESTS=true to enable write-path tests (creates DB rows).",
  );

  // One-shot chain — subsequent steps depend on artifacts from earlier
  // ones so fail-early is the goal. Playwright's test.step groups the
  // failure into the right segment of the report.
  test("full chain completes end-to-end", async ({ page }) => {
    test.setTimeout(5 * 60_000);

    let websiteDetailUrl = "";

    await test.step("add website", async () => {
      await page.goto("/websites/new");
      await page.getByLabel(/website url/i).fill("https://example.com");
      await page
        .getByLabel(/display name/i)
        .fill(`E2E Critical Flow ${Date.now()}`);
      await page.getByRole("button", { name: /add website/i }).click();
      await expect(page).toHaveURL(/\/websites\/[a-z0-9]+$/i, {
        timeout: 15_000,
      });
      websiteDetailUrl = page.url();
    });

    await test.step("open settings and see the verification panel", async () => {
      await page.goto(`${websiteDetailUrl}/settings`);
      // The verification panel tabs (Meta tag / DNS TXT / File upload)
      // should be visible for any unverified site.
      await expect(page.getByRole("button", { name: /meta tag/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /dns txt/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /file upload/i })).toBeVisible();
    });

    await test.step("trigger a scan from the website detail page", async () => {
      await page.goto(websiteDetailUrl);
      const scanBtn = page.getByRole("button", { name: /run scan|start scan/i });
      await expect(scanBtn).toBeVisible();
      await scanBtn.click();
      await expect(page.getByRole("status")).toContainText(
        /queued|scanning|progress/i,
        { timeout: 10_000 },
      );
    });

    await test.step("wait for at least one violation to appear on the issues page", async () => {
      const issuesUrl = `${websiteDetailUrl.replace(/\/$/, "")}/issues`;
      // Scan can take minutes; poll the issues list for up to 3 minutes.
      await expect(async () => {
        await page.goto(issuesUrl);
        const rows = page.getByRole("link", { name: /view|details|open/i });
        expect(await rows.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 3 * 60_000, intervals: [5_000, 10_000, 15_000] });
    });

    await test.step("open the first issue detail page", async () => {
      const firstIssue = page
        .getByRole("link", { name: /view|details|open/i })
        .first();
      await firstIssue.click();
      await expect(page).toHaveURL(/\/issues\/[a-z0-9]+$/i);
      // The comment thread widget must be present on every issue page.
      await expect(page.getByRole("textbox", { name: /comment/i })).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("post a comment on the issue", async () => {
      const body = `E2E comment ${Date.now()}`;
      await page.getByRole("textbox", { name: /comment/i }).fill(body);
      await page.getByRole("button", { name: /post|submit|add comment/i }).click();
      // The submitted comment should render in the thread
      await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });
    });
  });
});
