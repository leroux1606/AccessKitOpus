"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cancelScan } from "@/app/(dashboard)/websites/[websiteId]/actions";

const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

interface ScanPollerProps {
  scanId: string;
  websiteId: string;
  initialStatus: string;
}

export function ScanPoller({ scanId, websiteId, initialStatus }: ScanPollerProps) {
  const router = useRouter();
  // Store router in a ref so the effect never re-runs due to a router identity
  // change after router.refresh() — that was causing the infinite polling loop.
  const routerRef = useRef(router);
  routerRef.current = router;

  const [timedOut, setTimedOut] = useState(false);
  const [isCancelling, startCancelTransition] = useTransition();

  useEffect(() => {
    let stopped = false;
    const startTime = Date.now();

    const id = setInterval(async () => {
      if (stopped) return;

      if (Date.now() - startTime > MAX_POLL_MS) {
        stopped = true;
        clearInterval(id);
        setTimedOut(true);
        return;
      }

      try {
        const res = await fetch(`/api/internal/scan-status?scanId=${scanId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED") {
          stopped = true;
          clearInterval(id);
          routerRef.current.refresh();
        }
      } catch {
        // network error — will retry next interval
      }
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [scanId]); // scanId is stable; router is accessed via ref to avoid re-subscribing

  function handleCancel() {
    startCancelTransition(async () => {
      await cancelScan(scanId, websiteId);
    });
  }

  if (timedOut) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium text-destructive">Scan is taking too long</p>
          <p className="text-sm text-muted-foreground mt-1">
            The scan may be stuck. You can cancel it and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            )}
            {isCancelling ? "Cancelling…" : "Cancel scan"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2
          className="h-10 w-10 mx-auto mb-3 animate-spin text-primary"
          aria-hidden="true"
        />
        {/* WCAG 4.1.3: live region so screen readers announce status updates */}
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
          Checking for updates every 3 seconds…
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-muted-foreground hover:text-destructive"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          )}
          {isCancelling ? "Cancelling…" : "Cancel scan"}
        </Button>
      </CardContent>
    </Card>
  );
}
