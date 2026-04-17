"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Link2, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleReportSharing, deleteReport } from "./actions";

interface ReportActionsProps {
  reportId: string;
  shareToken: string | null;
  isPublic: boolean;
}

export function ReportActions({ reportId, shareToken, isPublic: initialPublic }: ReportActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [copied, setCopied] = useState(false);

  async function handleToggleShare() {
    startTransition(async () => {
      const result = await toggleReportSharing(reportId);
      if (result.success) {
        setIsPublic(result.isPublic ?? false);
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteReport(reportId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  async function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/report/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/reports/${reportId}/pdf`} download>
          <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          PDF
        </a>
      </Button>

      {isPublic && shareToken && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          disabled={isPending}
          aria-label={copied ? "Copied!" : "Copy share link"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 mr-1.5 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Link"}
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleShare}
        disabled={isPending}
        aria-label={isPublic ? "Disable sharing" : "Enable sharing"}
      >
        <Link2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
        {isPublic ? "Unshare" : "Share"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:text-destructive"
        aria-label="Delete report"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
