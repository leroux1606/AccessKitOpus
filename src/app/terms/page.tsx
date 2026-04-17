import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "AccessKit terms of service and acceptable use policy.",
};

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using AccessKit you agree to these Terms of Service
              (&ldquo;Terms&rdquo;). If you use AccessKit on behalf of an organisation, you confirm
              you have authority to bind that organisation to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of service</h2>
            <p>
              AccessKit is a web accessibility monitoring platform. It scans websites for
              accessibility issues, generates reports, and tracks remediation progress.
              AccessKit is a <strong>monitoring and baseline assessment tool</strong> — it does not
              guarantee legal compliance with WCAG, ADA, Section 508, EN 301 549, or any other
              standard. You remain solely responsible for ensuring your websites meet applicable
              accessibility requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Accounts</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>You must provide accurate account information.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>You must be 16 years or older (18 in some jurisdictions) to use AccessKit.</li>
              <li>One free trial per person or organisation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable use</h2>
            <p className="mb-2">You may not use AccessKit to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Scan websites you do not own or have explicit permission to scan.</li>
              <li>Attempt to circumvent plan limits through automated account creation.</li>
              <li>Reverse-engineer, decompile, or resell the AccessKit software.</li>
              <li>Transmit malware, conduct denial-of-service attacks, or violate any law.</li>
              <li>Use automated scripts to trigger scans in excess of plan limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Website ownership verification</h2>
            <p>
              Before scanning, you must verify ownership of each website via meta tag, DNS TXT
              record, or verification file. By verifying, you confirm you are authorised to run
              automated accessibility scans on that website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Billing and refunds</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Subscriptions are billed monthly or annually in advance.</li>
              <li>You may cancel at any time; cancellation takes effect at the end of the billing period.</li>
              <li>Refunds are issued at our discretion for unused time if requested within 14 days of charge.</li>
              <li>Prices may change with 30 days&apos; notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Intellectual property</h2>
            <p>
              AccessKit and its underlying software remain the intellectual property of AccessKit.
              Your scan data, reports, and configurations remain yours. You grant AccessKit a
              limited licence to process your data solely to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, AccessKit is provided &ldquo;as is&rdquo;
              without warranty. We are not liable for indirect, incidental, or consequential
              damages arising from your use of the service or reliance on scan results. Our total
              liability shall not exceed the fees you paid in the 12 months prior to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
            <p>
              We may suspend or terminate your account for material breach of these Terms,
              non-payment, or unlawful use, with or without notice where urgent action is required.
              You may delete your account at any time from Settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Governing law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in which AccessKit is
              incorporated. Disputes shall be resolved in the courts of that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
            <p>
              Legal queries: <a href="mailto:legal@accesskit.io" className="underline">legal@accesskit.io</a>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
