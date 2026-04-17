"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ScanPollerProps {
  scanId: string;
  initialStatus: string;
}

export function ScanPoller({ scanId, initialStatus }: ScanPollerProps) {
  const router = useRouter();

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/scan-status?scanId=${scanId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { status: string };
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        router.refresh();
      }
    } catch {
      // network error — will retry next interval
    }
  }, [scanId, router]);

  useEffect(() => {
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  // WCAG 4.1.3 Status Messages (Level AA): live region so screen readers
  // announce status updates without requiring focus to move here.
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2
          className="h-10 w-10 mx-auto mb-3 animate-spin text-primary"
          aria-hidden="true"
        />
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="font-medium">
            {initialStatus === "QUEUED" ? "Scan queued…" : "Scanning in progress…"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {initialStatus === "QUEUED"
              ? "Your scan is queued and will start shortly."
              : "Crawling pages and running accessibility checks. This may take a few minutes."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          This page refreshes automatically every 3 seconds.
        </p>
      </CardContent>
    </Card>
  );
}
