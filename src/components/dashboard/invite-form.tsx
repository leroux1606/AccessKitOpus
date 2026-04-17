"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2 } from "lucide-react";
import { inviteTeamMember } from "@/app/(dashboard)/team/actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface InviteFormProps {
  seatLimitReached: boolean;
  plan: string;
}

export function InviteForm({ seatLimitReached, plan }: InviteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setUpgradeRequired(false);

    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteTeamMember(data);
      if (result.error) {
        setError(result.error);
        setUpgradeRequired(!!result.upgradeRequired);
      } else {
        setSuccess(true);
        formRef.current?.reset();
      }
    });
  }

  if (seatLimitReached) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Your <strong className="text-foreground">{plan}</strong> plan seat limit is reached.{" "}
          <Link href="/settings/billing" className="text-primary hover:underline underline-offset-4">
            Upgrade your plan
          </Link>{" "}
          to add more team members.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="invite-email" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            disabled={isPending}
            className={cn(
              "w-full rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 text-sm text-foreground",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-border"
            )}
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            disabled={isPending}
            className={cn(
              "h-[38px] rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-border"
            )}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} size="sm" className="h-[38px]">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline ml-1.5">Invite</span>
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}{" "}
          {upgradeRequired && (
            <Link href="/settings/billing" className="underline underline-offset-4">
              Upgrade plan
            </Link>
          )}
        </div>
      )}
      {success && (
        <p role="status" className="text-sm text-green-400">
          Invitation sent successfully!
        </p>
      )}
    </form>
  );
}
