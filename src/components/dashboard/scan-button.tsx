"use client";

import { useTransition } from "react";
import { Scan, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerScan } from "@/app/(dashboard)/websites/[websiteId]/actions";

interface ScanButtonProps {
  websiteId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function ScanButton({ websiteId, disabled, disabledReason }: ScanButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await triggerScan(websiteId);
    });
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={disabled || isPending}
      aria-label={disabledReason ?? (isPending ? "Starting scan…" : "Scan now")}
      title={disabledReason}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
      ) : (
        <Scan className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
      )}
      {isPending ? "Starting…" : "Scan now"}
    </Button>
  );
}
