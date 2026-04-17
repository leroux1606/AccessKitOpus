/**
 * Magic-link "send verification request" handler, extracted from the
 * NextAuth config so it can be unit-tested in isolation.
 *
 * The original Phase A2 security fix gated the console.log of the magic
 * link to NODE_ENV !== "production". These tests lock that gate in so a
 * future edit can't accidentally re-leak production magic links to logs.
 */

export interface SendVerificationRequestParams {
  identifier: string;
  url: string;
}

type ResendClientLike = {
  emails: {
    send: (args: {
      from: string;
      to: string;
      subject: string;
      html: string;
    }) => Promise<unknown>;
  };
};

export interface SendVerificationDeps {
  loadResend?: () => Promise<{
    Resend: new (apiKey: string) => ResendClientLike;
  }>;
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, "log" | "error">;
}

/**
 * Dev-only: print the magic link to the console so developers can sign
 * in locally without a real email inbox. ALWAYS gated by NODE_ENV so
 * production logs never contain a sign-in URL.
 */
export function logMagicLinkForDev(
  identifier: string,
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, "log"> = console,
): void {
  if (env.NODE_ENV === "production") return;
  logger.log("\n========================================");
  logger.log("MAGIC LINK FOR:", identifier);
  logger.log(url);
  logger.log("========================================\n");
}

export function buildMagicLinkEmail(url: string): string {
  return `<p>Click to sign in: <a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`;
}

/**
 * NextAuth's `sendVerificationRequest` callback, factored so:
 *   1. The dev console.log is always environment-gated (A2 security fix).
 *   2. Resend is dynamically imported so a missing RESEND_API_KEY in dev
 *      doesn't crash the worker at import time.
 *   3. Resend failures never bubble — they fall through to the dev log
 *      so a local run without a real email provider still works.
 */
export async function sendVerificationRequest(
  { identifier, url }: SendVerificationRequestParams,
  deps: SendVerificationDeps = {},
): Promise<void> {
  const env = deps.env ?? process.env;
  const logger = deps.logger ?? console;
  const loadResend =
    deps.loadResend ??
    (async () =>
      (await import("resend")) as unknown as {
        Resend: new (apiKey: string) => ResendClientLike;
      });

  logMagicLinkForDev(identifier, url, env, logger);

  try {
    const { Resend } = await loadResend();
    const resend = new Resend(env.RESEND_API_KEY ?? "");
    await resend.emails.send({
      from: env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: identifier,
      subject: "Sign in to AccessKit",
      html: buildMagicLinkEmail(url),
    });
  } catch (err) {
    logger.error("Email send failed (use the console link above):", err);
  }
}
