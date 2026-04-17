"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPublicBadgeEnabled } from "./actions";
import type { EmbedSnippets } from "@/lib/badges";

interface BadgePanelProps {
  websiteId: string;
  initialEnabled: boolean;
  snippets: EmbedSnippets;
  canManage: boolean;
}

export function BadgePanel({
  websiteId,
  initialEnabled,
  snippets,
  canManage,
}: BadgePanelProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!canManage) return;
    setError(null);
    const next = !enabled;
    // Optimistic: flip immediately so the badge preview reflects the new state.
    setEnabled(next);
    startTransition(async () => {
      const res = await setPublicBadgeEnabled(websiteId, next);
      if (res.error) {
        setEnabled(!next);
        setError(res.error);
      }
    });
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Public score badge</p>
          <p className="text-xs text-muted-foreground">
            When enabled, anyone with the badge URL can see this website&apos;s current
            accessibility score. Useful for embedding in a README or site footer.
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? "default" : "outline"}
          size="sm"
          onClick={toggle}
          disabled={!canManage || isPending}
          aria-pressed={enabled}
        >
          {enabled ? "Enabled" : "Disabled"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {enabled && (
        <div className="space-y-4 pt-2 border-t">
          <div>
            <p className="text-xs font-medium mb-2">Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snippets.imageUrl}
              alt="Accessibility score badge preview"
              width={160}
              height={20}
            />
          </div>

          <SnippetBlock
            label="Badge image URL"
            value={snippets.imageUrl}
            copied={copied === "url"}
            onCopy={() => copy(snippets.imageUrl, "url")}
          />
          <SnippetBlock
            label="Markdown (README)"
            value={snippets.markdown}
            copied={copied === "md"}
            onCopy={() => copy(snippets.markdown, "md")}
          />
          <SnippetBlock
            label="HTML (site footer)"
            value={snippets.html}
            copied={copied === "html"}
            onCopy={() => copy(snippets.html, "html")}
          />
        </div>
      )}
    </div>
  );
}

function SnippetBlock({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-muted px-2 py-1.5 text-xs font-mono break-all">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
