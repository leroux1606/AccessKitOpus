"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMinus } from "lucide-react";
import { removeMember } from "@/app/(dashboard)/team/actions";
import { formatDate, getInitials } from "@/lib/utils";

interface Member {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface MemberListProps {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
}

function MemberRow({
  member,
  currentUserId,
  canManage,
}: {
  member: Member;
  currentUserId: string;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isCurrentUser = member.user.id === currentUserId;
  const isOwner = member.role === "OWNER";
  const canRemove = canManage && !isCurrentUser && !isOwner;

  function handleRemove() {
    if (!confirm(`Remove ${member.user.name ?? member.user.email} from the organization?`)) return;
    startTransition(async () => {
      await removeMember(member.id);
    });
  }

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <Avatar className="h-9 w-9 flex-shrink-0">
        {member.user.image && (
          <AvatarImage src={member.user.image} alt={member.user.name ?? member.user.email} />
        )}
        <AvatarFallback className="text-xs">
          {getInitials(member.user.name, member.user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.user.name ?? "—"}
          {isCurrentUser && (
            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant={member.role === "OWNER" ? "default" : "secondary"} className="capitalize">
          {member.role.toLowerCase().replace("_", " ")}
        </Badge>
        <span className="text-xs text-muted-foreground hidden sm:block">
          Joined {formatDate(member.createdAt)}
        </span>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${member.user.name ?? member.user.email} from organization`}
          >
            <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

export function MemberList({ members, currentUserId, canManage }: MemberListProps) {
  return (
    <>
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          currentUserId={currentUserId}
          canManage={canManage}
        />
      ))}
    </>
  );
}
