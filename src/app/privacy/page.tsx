import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AccessKit collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  const lastUpdated = "22 March 2026";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 inline-block"
        >
          ← Back to AccessKit
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
            <p>
              AccessKit (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a web accessibility
              monitoring platform. The data controller for personal data processed through AccessKit
              is the entity operating this service. For queries, contact:{" "}
              <a href="mailto:privacy@accesskit.io" className="underline">privacy@accesskit.io</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Data we collect and why</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Data</th>
                  <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                  <th className="text-left py-2 font-medium">Legal basis (GDPR Art. 6)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4">Name, email address</td>
                  <td className="py-2 pr-4">Account creation and authentication</td>
                  <td className="py-2">Contract (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">OAuth profile (Google / GitHub)</td>
                  <td className="py-2 pr-4">Single-sign-on login</td>
                  <td className="py-2">Contract (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Website URLs you add</td>
                  <td className="py-2 pr-4">Running accessibility scans</td>
                  <td className="py-2">Contract (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Scan results and violation data</td>
                  <td className="py-2 pr-4">Accessibility monitoring service</td>
                  <td className="py-2">Contract (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Billing data (via Stripe)</td>
                  <td className="py-2 pr-4">Payment processing and invoicing</td>
                  <td className="py-2">Contract + Legal obligation (Art. 6(1)(b)(c))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Usage analytics (PostHog)</td>
                  <td className="py-2 pr-4">Product improvement</td>
                  <td className="py-2">Consent (Art. 6(1)(a))</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Error logs (Sentry)</td>
                  <td className="py-2 pr-4">Bug detection and platform stability</td>
                  <td className="py-2">Legitimate interests (Art. 6(1)(f))</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Third-party processors</h2>
            <p className="mb-3">
              We share data with the following sub-processors under data processing agreements:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Vercel</strong> — hosting and edge network (EU/US)</li>
              <li><strong>Supabase / Neon</strong> — PostgreSQL database hosting</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Stripe</strong> — payment processing (PCI DSS compliant)</li>
              <li><strong>Inngest</strong> — background job queue</li>
              <li><strong>Sentry</strong> — error monitoring</li>
              <li><strong>PostHog</strong> — product analytics (only if consent given)</li>
              <li><strong>Cloudflare R2</strong> — screenshot storage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data retention</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Account data: retained while your account is active + 30 days after deletion</li>
              <li>Scan results: retained per your plan; older scans may be archived</li>
              <li>Billing records: 7 years (legal obligation)</li>
              <li>Error logs: 90 days rolling window</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your rights (GDPR)</h2>
            <p className="mb-3">Under GDPR Articles 15–22 you have the right to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Access</strong> — request a copy of all personal data we hold about you</li>
              <li><strong>Rectification</strong> — correct inaccurate data in your account settings</li>
              <li><strong>Erasure</strong> — delete your account and all associated data</li>
              <li><strong>Restriction</strong> — limit processing while a dispute is resolved</li>
              <li><strong>Portability</strong> — export your data as machine-readable JSON</li>
              <li><strong>Object</strong> — opt out of analytics at any time via cookie settings</li>
            </ul>
            <p className="mt-3">
              To exercise your rights: use the{" "}
              <strong>Settings → Account → Export data / Delete account</strong> options in your
              dashboard, or email{" "}
              <a href="mailto:privacy@accesskit.io" className="underline">privacy@accesskit.io</a>.
              We respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookies</h2>
            <p className="mb-3">We use:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Essential cookies</strong> — session authentication (required, no consent needed)</li>
              <li><strong>Analytics cookies</strong> — PostHog (only set after you give consent)</li>
            </ul>
            <p className="mt-3">
              You can change your cookie preference at any time by clicking the cookie notice that
              appears when you visit the site, or by clearing your browser&apos;s local storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. International transfers</h2>
            <p>
              Some processors (Vercel, Sentry, PostHog) may process data in the United States.
              These transfers are covered by Standard Contractual Clauses (SCCs) approved by the
              European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact and complaints</h2>
            <p>
              For privacy queries: <a href="mailto:privacy@accesskit.io" className="underline">privacy@accesskit.io</a>
            </p>
            <p className="mt-2">
              If you are in the EU/EEA and believe we have not adequately addressed your concern,
              you have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
