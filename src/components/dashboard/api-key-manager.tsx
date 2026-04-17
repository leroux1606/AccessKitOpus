"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key, Plus, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ApiKeyData {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeyManagerProps {
  keys: ApiKeyData[];
}

export function ApiKeyManager({ keys: initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.key);
        setKeys((prev) => [
          { id: data.id, name: data.name, createdAt: data.createdAt, lastUsedAt: null },
          ...prev,
        ]);
        setNewKeyName("");
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/settings/api-keys?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } finally {
      setRevoking(null);
    }
  }

  function handleCopy() {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {/* Revealed key banner */}
      {revealedKey && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-amber-400">
              Copy your API key now — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background rounded px-3 py-2 font-mono break-all border border-border">
                {revealedKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setRevealedKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create key */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {keys.length} API key{keys.length !== 1 ? "s" : ""}
        </p>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create API key
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="keyName" className="text-sm font-medium block mb-1.5">
                  Key name
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. CI/CD Pipeline, Staging"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Key className="h-8 w-8 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No API keys yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul role="list" className="divide-y divide-border">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(key.createdAt)} ·{" "}
                      {key.lastUsedAt ? `Last used ${formatDate(key.lastUsedAt)}` : "Never used"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revoking === key.id}
                  >
                    {revoking === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Revoke
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
