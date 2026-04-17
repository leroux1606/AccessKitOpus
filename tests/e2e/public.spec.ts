/**
 * E2E tests for public-facing pages (no authentication required).
 *
 * These run against the live Next.js dev server without any session cookie.
 * They verify that:
 *  - Public pages render correctly
 *  - Unauthenticated users are redirected from protected routes
 *  - The health endpoint responds correctly
 *  - Key legal/GDPR pages are accessible
 */

import { test, expect } from "@playwright/test";

// ─── Home / landing ──────────────────────────────────────────────────────────

test.describe("Home page", () => {
  test("renders the marketing page with a CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AccessKit/i);
    // Should have at least one visible call-to-action link
    const cta = page.getByRole("link", { name: /get started|sign in|login/i }).first();
    await expect(cta).toBeVisible();
  });
});

// ─── Login page ──────────────────────────────────────────────────────────────

test.describe("Login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/sign in|login|accesskit/i);
    // Should have an email input for magic link
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await expect(emailInput).toBeVisible();
  });

  test("shows provider buttons (Google / GitHub)", async ({ page }) => {
    await page.goto("/login");
    // At least one OAuth button should be present
    const googleBtn = page.getByRole("button", { name: /google/i });
    const githubBtn = page.getByRole("button", { name: /github/i });
    const hasOAuth =
      (await googleBtn.count()) > 0 || (await githubBtn.count()) > 0;
    expect(hasOAuth).toBe(true);
  });
});

// ─── Auth redirects ──────────────────────────────────────────────────────────

test.describe("Protected route redirects", () => {
  test("redirects /dashboard to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /websites to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/websites");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /websites/new to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/websites/new");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Privacy & terms (GDPR) ──────────────────────────────────────────────────

test.describe("Legal pages", () => {
  test("privacy policy is publicly accessible", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/privacy/i);
    // Should mention GDPR key terms
    await expect(page.getByText(/personal data|gdpr|data protection/i).first()).toBeVisible();
  });

  test("terms of service is publicly accessible", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/terms/i);
    await expect(page.getByText(/terms|conditions|acceptable use/i).first()).toBeVisible();
  });

  test("privacy policy contains required GDPR rights", async ({ page }) => {
    await page.goto("/privacy");
    const content = await page.textContent("main");
    // Key GDPR Articles 15–22 rights should be mentioned
    expect(content).toMatch(/right to access|right of access|article 15/i);
    expect(content).toMatch(/erasure|right to be forgotten|delete/i);
  });
});

// ─── Health endpoint ─────────────────────────────────────────────────────────

test.describe("Health check endpoint", () => {
  test("GET /api/health returns 200 with status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });

  test("health response timestamp is a valid ISO-8601 date", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    const date = new Date(body.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });
});

// ─── Accessibility basics ────────────────────────────────────────────────────

test.describe("Basic accessibility on public pages", () => {
  test("login page has a visible page heading", async ({ page }) => {
    await page.goto("/login");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
  });

  test("privacy page has a visible page heading", async ({ page }) => {
    await page.goto("/privacy");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
  });

  test("terms page has a visible page heading", async ({ page }) => {
    await page.goto("/terms");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
  });
});
