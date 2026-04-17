"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Scan, Globe } from "lucide-react";

interface Competitor {
  id: string;
  name: string;
  url: string;
  currentScore: number | null;
  lastScanAt: Date | string | null;
}

interface Props {
  organizationId: string;
  competitors: Competitor[];
  competitorLimit: number;
  canAddMore: boolean;
}

export function CompetitorManager({ competitors: initial, competitorLimit, canAddMore: initialCanAdd }: Props) {
  const [competitors, setCompetitors] = useState(initial);
  const [canAdd, setCanAdd] = useState(initialCanAdd);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const router = useRouter();

  const addCompetitor = async () => {
    if (!name.trim() || !url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/benchmarking/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to add competitor");
        return;
      }
      setName("");
      setUrl("");
      setShowForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const removeCompetitor = async (id: string) => {
    await fetch(`/api/benchmarking/competitors?id=${id}`, { method: "DELETE" });
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    setCanAdd(true);
  };

  const scanCompetitor = async (id: string) => {
    setScanning(id);
    try {
      await fetch(`/api/benchmarking/competitors/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: id }),
      });
      router.refresh();
    } finally {
      setScanning(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Manage Competitors</CardTitle>
          <span className="text-xs text-muted-foreground">
            {competitors.length}/{competitorLimit === Infinity ? "Unlimited" : competitorLimit}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {competitors.length === 0 && !showForm && (
          <div className="text-center py-8">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-4">
              No competitors added yet. Add competitor websites to compare accessibility scores.
            </p>
          </div>
        )}

        {competitors.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground truncate">{c.url}</p>
            </div>
            {c.currentScore !== null && (
              <span className={`text-sm font-bold ${
                c.currentScore >= 90
                  ? "text-green-400"
                  : c.currentScore >= 70
                    ? "text-yellow-400"
                    : "text-red-400"
              }`}>
                {c.currentScore}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scanCompetitor(c.id)}
              disabled={scanning === c.id}
              aria-label={`Scan ${c.name}`}
            >
              <Scan className={`h-4 w-4 ${scanning === c.id ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeCompetitor(c.id)}
              aria-label={`Remove ${c.name}`}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {showForm && (
          <div className="space-y-3 p-3 rounded-lg border border-border/50">
            <div>
              <label htmlFor="comp-name" className="text-xs font-medium text-muted-foreground">
                Competitor Name
              </label>
              <input
                id="comp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="mt-1 block w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="comp-url" className="text-xs font-medium text-muted-foreground">
                Website URL
              </label>
              <input
                id="comp-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://competitor.com"
                className="mt-1 block w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addCompetitor} disabled={loading} size="sm">
                {loading ? "Adding..." : "Add Competitor"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showForm && canAdd && (
          <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
