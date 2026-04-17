"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Mail } from "lucide-react";
import { revokeInvitation } from "@/app/(dashboard)/team/actions";
import { formatDate } from "@/lib/utils";

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { name: string | null; email: string };
}

interface PendingInvitationsProps {
  invitations: Invitation[];
  canManage: boolean;
}

function InvitationRow({
  invitation,
  canManage,
}: {
  invitation: Invitation;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      await revokeInvitation(invitation.id);
    });
  }

  return (
    <li className="flex items-center gap-4 px-6 py-4 opacity-75">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email} · Expires {formatDate(invitation.expiresAt)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="warning" className="text-[10px]">
          Pending
        </Badge>
        <Badge variant="secondary" className="capitalize">
          {invitation.role.toLowerCase()}
        </Badge>
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleRevoke}
            disabled={isPending}
            aria-label={`Revoke invitation for ${invitation.email}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

export function PendingInvitations({ invitations, canManage }: PendingInvitationsProps) {
  if (invitations.length === 0) return null;

  return (
    <>
      {invitations.map((inv) => (
        <InvitationRow key={inv.id} invitation={inv} canManage={canManage} />
      ))}
    </>
  );
}
