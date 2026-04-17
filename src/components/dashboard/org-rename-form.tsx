"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Check, X } from "lucide-react";

interface OrgRenameFormProps {
  currentName: string;
  canEdit: boolean;
}

export function OrgRenameForm({ currentName, canEdit }: OrgRenameFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (name.trim() === currentName) {
      setEditing(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to update name");
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setName(currentName);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-lg">{currentName}</p>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label="Rename organization"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Rename
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          maxLength={64}
          autoFocus
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Organization name"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={loading || !name.trim()}
          aria-label="Save name"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
