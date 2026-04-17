import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Tests run against a local Next.js dev server.
 * Authenticated tests use a JWT session cookie created in global-setup.ts.
 *
 * To run:
 *   npx playwright test            # headless
 *   npx playwright test --ui       # interactive UI
 *   npx playwright show-report     # view last report
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",

  // Run all tests in parallel by default
  fullyParallel: true,

  // Fail the build on CI if a test.only is left in source
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI to avoid resource exhaustion
  workers: process.env.CI ? 1 : undefined,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",

    // Collect traces on first retry — useful for debugging CI failures
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project — creates authenticated session state
    {
      name: "setup",
      testMatch: "**/global-setup.spec.ts",
    },

    // Public pages — no auth needed
    {
      name: "public",
      testMatch: "**/public.spec.ts",
    },

    // Authenticated pages — depend on the setup project
    {
      name: "authenticated",
      testMatch: "**/dashboard.spec.ts",
      dependencies: ["setup"],
      use: {
        storageState: "tests/e2e/.auth/user.json",
      },
    },
  ],

  // Start the Next.js dev server before tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
