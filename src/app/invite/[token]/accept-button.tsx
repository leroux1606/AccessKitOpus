"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { acceptInvitation } from "./actions";

interface AcceptInviteButtonProps {
  token: string;
  invitationId: string;
}

export function AcceptInviteButton({ token, invitationId }: AcceptInviteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(invitationId, token);
      if (result.success) {
        router.push("/dashboard");
      }
    });
  }

  return (
    <Button
      className="w-full bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0 shadow-lg shadow-[hsl(262,83%,68%)]/20 h-11"
      onClick={handleAccept}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      )}
      Accept invitation
    </Button>
  );
}
