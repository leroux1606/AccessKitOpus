"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface Violation {
  id: string;
  description: string;
  ruleId: string;
  severity: string;
  status: string;
  category: string;
  firstDetectedAt: string;
  websiteId: string;
  website: { name: string };
  assignedTo: { id: string; name: string | null; email: string; image: string | null } | null;
}

interface CrossWebsiteTableProps {
  violations: Violation[];
}

const severityVariant = (s: string) =>
  s === "CRITICAL" ? "critical" as const : s === "SERIOUS" ? "serious" as const : s === "MODERATE" ? "moderate" as const : "minor" as const;

const statusVariant = (s: string) => {
  if (s === "OPEN") return "destructive" as const;
  if (s === "IN_PROGRESS") return "warning" as const;
  if (s === "FIXED" || s === "VERIFIED") return "success" as const;
  return "secondary" as const;
};

export function CrossWebsiteTable({ violations }: CrossWebsiteTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm" role="table" aria-label="All accessibility issues">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="text-left px-4 py-3 font-medium">Issue</th>
              <th scope="col" className="text-left px-4 py-3 font-medium hidden md:table-cell">Website</th>
              <th scope="col" className="text-left px-4 py-3 font-medium">Severity</th>
              <th scope="col" className="text-left px-4 py-3 font-medium hidden md:table-cell">Assignee</th>
              <th scope="col" className="text-left px-4 py-3 font-medium hidden lg:table-cell">Detected</th>
              <th scope="col" className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {violations.map((v) => (
              <tr key={v.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-4 py-3">
                  <Link
                    href={`/websites/${v.websiteId}/issues/${v.id}`}
                    className="block group-hover:text-[hsl(262,80%,80%)] transition-colors"
                  >
                    <p className="font-medium text-sm truncate max-w-xs">{v.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">{v.ruleId}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Link
                    href={`/websites/${v.websiteId}/issues`}
                    className="text-sm truncate max-w-[150px] block hover:text-[hsl(262,80%,80%)] transition-colors"
                  >
                    {v.website.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={severityVariant(v.severity)}>
                    {v.severity.toLowerCase()}
                  </Badge>
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
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                  {formatRelativeTime(v.firstDetectedAt)}
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
  );
}
