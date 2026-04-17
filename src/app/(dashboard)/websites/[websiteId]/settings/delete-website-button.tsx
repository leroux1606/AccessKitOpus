"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWebsite } from "./actions";

interface DeleteWebsiteButtonProps {
  websiteId: string;
  websiteName: string;
}

export function DeleteWebsiteButton({ websiteId, websiteName }: DeleteWebsiteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleInitiate() {
    setShowConfirm(true);
    setConfirmText("");
    setError(null);
  }

  function handleCancel() {
    setShowConfirm(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    if (confirmText !== websiteName) return;

    startTransition(async () => {
      const result = await deleteWebsite(websiteId);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/websites");
        router.refresh();
      }
    });
  }

  if (!showConfirm) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={handleInitiate}
        className="flex-shrink-0"
      >
        Delete website
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 mt-3">
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          This will permanently delete <strong>{websiteName}</strong> and all its scans, pages, and
          violations. Type the website name to confirm.
        </p>
      </div>

      <label htmlFor="confirm-delete" className="sr-only">
        Type website name to confirm deletion
      </label>
      <input
        id="confirm-delete"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={websiteName}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        autoFocus
        aria-label={`Type "${websiteName}" to confirm deletion`}
        aria-required="true"
        disabled={isPending}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={confirmText !== websiteName || isPending}
          aria-label={`Confirm deletion of ${websiteName}`}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
              Deleting...
            </>
          ) : (
            "Delete permanently"
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
