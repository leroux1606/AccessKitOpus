/**
 * Playwright global setup — runs once before the authenticated test suite.
 *
 * Creates a valid NextAuth v5 JWT session cookie using @auth/core/jwt so
 * that dashboard.spec.ts can run without going through the real OAuth/email
 * login flow.
 *
 * Requirements:
 *   - AUTH_SECRET env var must be set (same value as the running dev server)
 *   - A user with E2E_USER_ID must exist in the database, OR you can seed
 *     the database first with `npm run db:seed`
 *
 * The generated storage state is written to tests/e2e/.auth/user.json and
 * is read by Playwright's `authenticated` project (see playwright.config.ts).
 */

import { test as setup } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("create authenticated session", async ({ page }) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.warn(
      "⚠  AUTH_SECRET is not set — skipping session creation. " +
        "Authenticated E2E tests will be skipped.",
    );
    // Write empty storage state so the dependent project can start
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(
      AUTH_FILE,
      JSON.stringify({ cookies: [], origins: [] }),
    );
    return;
  }

  // Use a dedicated E2E test user ID (set E2E_USER_ID in your .env.test or CI)
  const userId = process.env.E2E_USER_ID ?? "e2e-test-user-id";

  // Build a JWT payload matching the NextAuth v5 session shape
  const now = Math.floor(Date.now() / 1000);
  const sessionToken = await encode({
    token: {
      sub: userId,
      id: userId,
      name: "E2E Test User",
      email: process.env.E2E_USER_EMAIL ?? "e2e@accesskit.test",
      picture: null,
      iat: now,
      exp: now + 60 * 60 * 24, // 24 hours
      jti: crypto.randomUUID(),
    },
    secret,
    maxAge: 60 * 60 * 24,
    // NextAuth v5 uses the cookie name as the PBES2 salt
    salt: "authjs.session-token",
  });

  // Navigate to the app first so we can set a same-site cookie
  await page.goto("/");

  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Verify the session works — the dashboard redirects to /login if invalid
  await page.goto("/dashboard");
  const isAuthenticated = !page.url().includes("/login");

  if (!isAuthenticated) {
    console.warn(
      "⚠  Session cookie did not authenticate — the user may not exist in the DB.\n" +
        `   User ID used: ${userId}\n` +
        "   Run `npm run db:seed` or set E2E_USER_ID to a real user ID.",
    );
  }

  // Save the storage state regardless so the dependent project can proceed
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
