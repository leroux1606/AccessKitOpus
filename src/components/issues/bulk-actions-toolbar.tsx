"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
}

interface BulkActionsToolbarProps {
  selectedIds: string[];
  onClear: () => void;
  teamMembers: TeamMember[];
}

export function BulkActionsToolbar({ selectedIds, onClear, teamMembers }: BulkActionsToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function bulkUpdate(data: Record<string, unknown>) {
    startTransition(async () => {
      await fetch("/api/issues/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationIds: selectedIds, ...data }),
      });
      onClear();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
      <span className="font-medium">{selectedIds.length} selected</span>

      <Select
        onValueChange={(status) => bulkUpdate({ status })}
        disabled={isPending}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs" aria-label="Set status">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          <SelectItem value="FIXED">Fixed</SelectItem>
          <SelectItem value="VERIFIED">Verified</SelectItem>
          <SelectItem value="WONT_FIX">Won&apos;t Fix</SelectItem>
          <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
        </SelectContent>
      </Select>

      <Select
        onValueChange={(assigneeId) =>
          bulkUpdate({ assignedToId: assigneeId === "unassigned" ? null : assigneeId })
        }
        disabled={isPending}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs" aria-label="Assign to">
          <SelectValue placeholder="Assign to..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {teamMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="ml-auto h-7 text-xs"
        aria-label="Clear selection"
      >
        <X className="h-3 w-3 mr-1" aria-hidden="true" />
        Clear
      </Button>
    </div>
  );
}
