"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open", color: "text-red-400" },
  { value: "IN_PROGRESS", label: "In Progress", color: "text-yellow-400" },
  { value: "FIXED", label: "Fixed", color: "text-green-400" },
  { value: "VERIFIED", label: "Verified", color: "text-emerald-400" },
  { value: "WONT_FIX", label: "Won't Fix", color: "text-muted-foreground" },
  { value: "FALSE_POSITIVE", label: "False Positive", color: "text-muted-foreground" },
] as const;

interface StatusSelectProps {
  violationId: string;
  currentStatus: string;
}

export function StatusSelect({ violationId, currentStatus }: StatusSelectProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      await fetch(`/api/issues/${violationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[160px]" aria-label="Issue status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className={opt.color}>{opt.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
