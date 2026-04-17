"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { getInitials } from "@/lib/utils";

interface Violation {
  id: string;
  description: string;
  ruleId: string;
  severity: string;
  status: string;
  category: string;
  firstDetectedAt: string;
  assignedTo: { id: string; name: string | null; email: string; image: string | null } | null;
  page: { url: string };
  websiteId: string;
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
}

interface IssuesTableProps {
  violations: Violation[];
  teamMembers: TeamMember[];
  websiteId: string;
}

const severityVariant = (s: string) =>
  s === "CRITICAL" ? "critical" as const : s === "SERIOUS" ? "serious" as const : s === "MODERATE" ? "moderate" as const : "minor" as const;

const statusVariant = (s: string) => {
  if (s === "OPEN") return "destructive" as const;
  if (s === "IN_PROGRESS") return "warning" as const;
  if (s === "FIXED" || s === "VERIFIED") return "success" as const;
  return "secondary" as const;
};

export function IssuesTable({ violations, teamMembers, websiteId }: IssuesTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = violations.length > 0 && selectedIds.size === violations.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(violations.map((v) => v.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <BulkActionsToolbar
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
          teamMembers={teamMembers}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm" aria-label="Website accessibility issues">
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-600 accent-[hsl(262,83%,68%)]"
                    aria-label="Select all issues"
                  />
                </th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Issue</th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Severity</th>
                <th scope="col" className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th scope="col" className="text-left px-4 py-3 font-medium hidden lg:table-cell">Page</th>
                <th scope="col" className="text-left px-4 py-3 font-medium hidden md:table-cell">Assignee</th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {violations.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(v.id)}
                      onChange={() => toggleOne(v.id)}
                      className="h-4 w-4 rounded border-gray-600 accent-[hsl(262,83%,68%)]"
                      aria-label={`Select issue ${v.ruleId}`}
                    />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link
                      href={`/websites/${websiteId}/issues/${v.id}`}
                      className="block group-hover:text-[hsl(262,80%,80%)] transition-colors"
                    >
                      <p className="font-medium truncate">{v.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">{v.ruleId}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={severityVariant(v.severity)}>
                      {v.severity.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground capitalize">
                    {v.category.toLowerCase().replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground max-w-[140px] truncate block" title={v.page.url}>
                      {(() => { try { return new URL(v.page.url).pathname || "/"; } catch { return v.page.url; } })()}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {v.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          {v.assignedTo.image && (
                            <AvatarImage src={v.assignedTo.image} alt={v.assignedTo.name ?? v.assignedTo.email} />
                          )}
                          <AvatarFallback className="text-[8px]">
                            {getInitials(v.assignedTo.name, v.assignedTo.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate max-w-[80px]">
                          {v.assignedTo.name ?? v.assignedTo.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(v.status)}>
                      {v.status.toLowerCase().replace("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
