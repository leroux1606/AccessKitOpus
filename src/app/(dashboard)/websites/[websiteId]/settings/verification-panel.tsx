"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VerificationMethod } from "@prisma/client";

interface VerificationPanelProps {
  websiteId: string;
  websiteUrl: string;
  verificationToken: string;
  isVerified: boolean;
  verificationMethod: VerificationMethod | null;
}

type TabId = "meta" | "dns" | "file";

const TABS: { id: TabId; label: string }[] = [
  { id: "meta", label: "Meta tag" },
  { id: "dns", label: "DNS TXT record" },
  { id: "file", label: "File upload" },
];

export function VerificationPanel({
  websiteId,
  websiteUrl,
  verificationToken,
  isVerified,
  verificationMethod,
}: VerificationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("meta");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const metaTag = `<meta name="accesskit-verification" content="${verificationToken}">`;
  const dnsTxt = `accesskit-verify=${verificationToken}`;
  const fileContent = verificationToken;
  const fileUrl = `${websiteUrl}/.well-known/accesskit-verify.txt`;

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleVerify() {
    setIsVerifying(true);
    setResult(null);

    try {
      const res = await fetch("/api/internal/verify-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json() as { success: boolean; method?: string; error?: string };

      if (data.success) {
        setResult({ success: true, message: "Website verified successfully! Refresh to see updated status." });
        // Refresh the page to show verified status
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult({ success: false, message: data.error ?? "Verification failed. Please check your setup and try again." });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setIsVerifying(false);
    }
  }

  if (isVerified) {
    return (
      <div className="flex items-center gap-3 py-2">
        <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-green-400">Ownership verified</p>
          {verificationMethod && (
            <p className="text-xs text-muted-foreground capitalize">
              via {verificationMethod.replace("_", " ").toLowerCase()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose one method to prove you control this website. Once verified, all verification methods
        can be removed.
      </p>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Verification methods"
        className="flex gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meta tag panel */}
      <div
        id="tab-panel-meta"
        role="tabpanel"
        aria-labelledby="tab-meta"
        hidden={activeTab !== "meta"}
        className="space-y-3"
      >
        <p className="text-sm">
          Add this tag inside the <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;head&gt;</code> element of your homepage:
        </p>
        <CodeBlock value={metaTag} onCopy={() => copyToClipboard(metaTag, "meta")} copied={copied === "meta"} />
      </div>

      {/* DNS panel */}
      <div
        id="tab-panel-dns"
        role="tabpanel"
        aria-labelledby="tab-dns"
        hidden={activeTab !== "dns"}
        className="space-y-3"
      >
        <p className="text-sm">
          Add a <strong>TXT record</strong> to your domain&apos;s DNS settings with this value:
        </p>
        <CodeBlock value={dnsTxt} onCopy={() => copyToClipboard(dnsTxt, "dns")} copied={copied === "dns"} />
        <p className="text-xs text-muted-foreground">
          DNS changes can take up to 48 hours to propagate. Try verifying again after the TTL expires.
        </p>
      </div>

      {/* File panel */}
      <div
        id="tab-panel-file"
        role="tabpanel"
        aria-labelledby="tab-file"
        hidden={activeTab !== "file"}
        className="space-y-3"
      >
        <p className="text-sm">
          Create a plain-text file at{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">{fileUrl}</code>{" "}
          with the following content (no extra spaces or newlines):
        </p>
        <CodeBlock value={fileContent} onCopy={() => copyToClipboard(fileContent, "file")} copied={copied === "file"} />
      </div>

      {/* Verify button */}
      <div className="space-y-2">
        <Button onClick={handleVerify} disabled={isVerifying} className="w-full">
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Verify ownership
            </>
          )}
        </Button>

        {result && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-md p-3 text-sm ${
              result.success
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : "bg-destructive/10 border border-destructive/20 text-destructive"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({
  value,
  onCopy,
  copied,
}: {
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="relative group">
      <code className="block rounded-md bg-muted px-4 py-3 text-xs font-mono break-all pr-12 leading-relaxed">
        {value}
      </code>
      <button
        onClick={onCopy}
        aria-label={copied ? "Copied!" : "Copy to clipboard"}
        className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 bg-background border hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
