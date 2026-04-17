/**
 * E2E tests for authenticated dashboard flows.
 *
 * These run with the session cookie created by global-setup.spec.ts.
 * The `authenticated` Playwright project (playwright.config.ts) injects
 * the storage state from tests/e2e/.auth/user.json automatically.
 *
 * Critical path covered:
 *   1. Dashboard loads for authenticated users
 *   2. Add website form is reachable and validates input
 *   3. Websites list page renders
 *   4. Navigation links work
 *
 * Note: Tests that write to the database (creating real websites, triggering
 * scans) are marked with test.skip unless E2E_WRITE_TESTS=true is set, to
 * prevent accidental data creation in shared environments.
 */

import { test, expect } from "@playwright/test";

// ─── Dashboard ───────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("renders the dashboard page when authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    // Should NOT be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("has a skip-to-content link (WCAG 2.4.1)", async ({ page }) => {
    await page.goto("/dashboard");
    // The skip link is visually hidden but must exist in the DOM
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeAttached();
  });

  test("shows 'Add website' CTA when no websites exist", async ({ page }) => {
    await page.goto("/dashboard");
    // Either a stats grid or an empty-state with add-website CTA
    const addLink = page
      .getByRole("link", { name: /add.*website|add your first/i })
      .first();
    await expect(addLink).toBeVisible();
  });

  test("navigation sidebar is present", async ({ page }) => {
    await page.goto("/dashboard");
    // Core nav links should be reachable
    await expect(page.getByRole("link", { name: /websites/i }).first()).toBeVisible();
  });
});

// ─── Websites list ───────────────────────────────────────────────────────────

test.describe("Websites list page", () => {
  test("renders the websites page", async ({ page }) => {
    await page.goto("/websites");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /websites/i }),
    ).toBeVisible();
  });

  test("has an 'Add website' button", async ({ page }) => {
    await page.goto("/websites");
    const addBtn = page.getByRole("link", { name: /add website/i });
    await expect(addBtn).toBeVisible();
  });
});

// ─── Add website form ────────────────────────────────────────────────────────

test.describe("Add website form", () => {
  test("renders the add website page", async ({ page }) => {
    await page.goto("/websites/new");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /add.*website/i })).toBeVisible();
  });

  test("shows URL and name inputs", async ({ page }) => {
    await page.goto("/websites/new");
    await expect(page.getByLabel(/website url/i)).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
  });

  test("shows WCAG standard checkboxes", async ({ page }) => {
    await page.goto("/websites/new");
    // Should have at least WCAG 2.1 AA checkbox
    const wcagCheckbox = page.getByRole("checkbox", { name: /wcag 2\.1.*aa/i });
    await expect(wcagCheckbox).toBeVisible();
  });

  test("submit button is disabled when no standard is selected", async ({
    page,
  }) => {
    await page.goto("/websites/new");
    // Uncheck the default WCAG 2.1 AA
    const wcagCheckbox = page.getByRole("checkbox", { name: /wcag 2\.1.*aa/i });
    await wcagCheckbox.uncheck();
    const submitBtn = page.getByRole("button", { name: /add website/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("shows validation error for SSRF-blocked URL", async ({ page }) => {
    await page.goto("/websites/new");
    await page.getByLabel(/website url/i).fill("http://192.168.1.1");
    await page.getByLabel(/display name/i).fill("Internal");
    await page.getByRole("button", { name: /add website/i }).click();
    // Should show an error message (not navigate away)
    const error = page.getByRole("alert");
    await expect(error).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/websites\/new/);
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

test.describe("Settings pages", () => {
  test("renders the settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("billing settings page is reachable", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Write tests (opt-in only) ───────────────────────────────────────────────

test.describe("Critical path: add website → scan (write tests)", () => {
  test.skip(
    !process.env.E2E_WRITE_TESTS,
    "Set E2E_WRITE_TESTS=true to enable write tests",
  );

  test("can add a website and land on the website detail page", async ({
    page,
  }) => {
    await page.goto("/websites/new");

    await page.getByLabel(/website url/i).fill("https://example.com");
    await page.getByLabel(/display name/i).fill("E2E Test Site");

    await page.getByRole("button", { name: /add website/i }).click();

    // After successful add, redirected to the website detail page
    await expect(page).toHaveURL(/\/websites\/[a-z0-9]+$/i, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /e2e test site/i }),
    ).toBeVisible();
  });

  test("can trigger a scan from the website detail page", async ({ page }) => {
    // Navigate to an existing website (created by the previous test or a seed)
    await page.goto("/websites");
    const firstWebsite = page.getByRole("link", { name: /e2e test site/i }).first();
    await firstWebsite.click();

    // Trigger scan
    const scanBtn = page.getByRole("button", { name: /run scan|start scan/i });
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();

    // Should show a "scan queued" or "scanning in progress" status
    const statusMsg = page.getByRole("status");
    await expect(statusMsg).toBeVisible({ timeout: 10_000 });
    await expect(statusMsg).toContainText(/queued|scanning|progress/i);
  });
});
