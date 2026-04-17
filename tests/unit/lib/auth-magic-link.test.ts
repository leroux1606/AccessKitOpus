/**
 * Unit tests for the magic-link verification helpers.
 *
 * Locks in the Phase A2 security fix — production must NEVER log the
 * sign-in URL to stdout, since anyone with production log access could
 * otherwise impersonate any user.
 */

import {
  buildMagicLinkEmail,
  logMagicLinkForDev,
  sendVerificationRequest,
} from "@/lib/auth-magic-link";

function makeLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
  };
}

describe("logMagicLinkForDev", () => {
  it("logs the magic link in development", () => {
    const logger = makeLogger();
    logMagicLinkForDev(
      "alice@example.com",
      "https://app.example/auth/callback/resend?token=abc",
      { NODE_ENV: "development" } as NodeJS.ProcessEnv,
      logger,
    );
    expect(logger.log).toHaveBeenCalled();
    const joined = logger.log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(joined).toContain("alice@example.com");
    expect(joined).toContain("https://app.example/auth/callback/resend?token=abc");
  });

  it("logs the magic link in test env", () => {
    const logger = makeLogger();
    logMagicLinkForDev(
      "bob@example.com",
      "https://app.example/magic",
      { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      logger,
    );
    expect(logger.log).toHaveBeenCalled();
  });

  it("is SILENT in production (Phase A2 security fix)", () => {
    const logger = makeLogger();
    logMagicLinkForDev(
      "carol@example.com",
      "https://app.example/auth/callback/resend?token=secret-production-token",
      { NODE_ENV: "production" } as NodeJS.ProcessEnv,
      logger,
    );
    expect(logger.log).not.toHaveBeenCalled();
  });
});

describe("buildMagicLinkEmail", () => {
  it("includes the url in both the anchor href and the visible text", () => {
    const html = buildMagicLinkEmail("https://app.example/x?token=abc");
    expect(html).toContain(`href="https://app.example/x?token=abc"`);
    expect(html).toContain(">https://app.example/x?token=abc<");
  });

  it("mentions the 24-hour expiry", () => {
    expect(buildMagicLinkEmail("https://example")).toMatch(/24 hours/i);
  });
});

describe("sendVerificationRequest", () => {
  function makeDeps(overrides: {
    env?: Partial<NodeJS.ProcessEnv>;
    send?: jest.Mock;
    loadShouldThrow?: Error;
  } = {}) {
    const logger = makeLogger();
    const send = overrides.send ?? jest.fn().mockResolvedValue({ id: "msg-1" });
    const loadResend = overrides.loadShouldThrow
      ? jest.fn().mockRejectedValue(overrides.loadShouldThrow)
      : jest.fn().mockResolvedValue({
          Resend: class {
            emails = { send };
            constructor(public apiKey: string) {}
          },
        });

    return {
      logger,
      send,
      loadResend,
      env: {
        NODE_ENV: "development",
        RESEND_API_KEY: "re_test_key",
        EMAIL_FROM: "noreply@example.com",
        ...overrides.env,
      } as NodeJS.ProcessEnv,
    };
  }

  it("sends the email via Resend using env-configured from address", async () => {
    const deps = makeDeps();
    await sendVerificationRequest(
      { identifier: "alice@example.com", url: "https://app.example/magic?token=x" },
      deps,
    );

    expect(deps.send).toHaveBeenCalledTimes(1);
    const args = deps.send.mock.calls[0]?.[0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
    };
    expect(args.to).toBe("alice@example.com");
    expect(args.from).toBe("noreply@example.com");
    expect(args.subject).toMatch(/sign in/i);
    expect(args.html).toContain("https://app.example/magic?token=x");
  });

  it("falls back to onboarding@resend.dev when EMAIL_FROM is unset", async () => {
    const deps = makeDeps({ env: { EMAIL_FROM: undefined } });
    await sendVerificationRequest(
      { identifier: "alice@example.com", url: "https://app.example/m" },
      deps,
    );
    expect(deps.send.mock.calls[0]?.[0].from).toBe("onboarding@resend.dev");
  });

  it("swallows Resend import failures and logs an error (dev still prints the link)", async () => {
    const deps = makeDeps({ loadShouldThrow: new Error("module missing") });
    await expect(
      sendVerificationRequest(
        { identifier: "a@b.com", url: "https://app.example/m" },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalled();
    // Dev log still happened — local dev remains usable
    expect(deps.logger.log).toHaveBeenCalled();
  });

  it("swallows Resend send() rejection without throwing", async () => {
    const failingSend = jest.fn().mockRejectedValue(new Error("SMTP down"));
    const deps = makeDeps({ send: failingSend });
    await expect(
      sendVerificationRequest(
        { identifier: "a@b.com", url: "https://app.example/m" },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("does NOT log the magic link in production even when Resend succeeds", async () => {
    const deps = makeDeps({ env: { NODE_ENV: "production" } });
    await sendVerificationRequest(
      { identifier: "a@b.com", url: "https://app.example/m?t=prod-secret" },
      deps,
    );
    const allLogs = deps.logger.log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allLogs).not.toContain("prod-secret");
    expect(allLogs).not.toMatch(/MAGIC LINK/);
  });
});
