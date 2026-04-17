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

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
}

interface AssigneeSelectProps {
  violationId: string;
  currentAssigneeId: string | null;
  teamMembers: TeamMember[];
}

export function AssigneeSelect({
  violationId,
  currentAssigneeId,
  teamMembers,
}: AssigneeSelectProps) {
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "unassigned");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(value: string) {
    setAssigneeId(value);
    const newAssigneeId = value === "unassigned" ? null : value;
    startTransition(async () => {
      await fetch(`/api/issues/${violationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: newAssigneeId }),
      });
      router.refresh();
    });
  }

  return (
    <Select value={assigneeId} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[200px]" aria-label="Assignee">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {teamMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.name ?? member.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
