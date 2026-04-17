"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, X, Eye, EyeOff } from "lucide-react";

interface WebhookDelivery {
  id: string;
  event: string;
  success: boolean;
  statusCode: number | null;
  deliveredAt: string | Date;
}

interface Webhook {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  createdAt: string | Date;
  deliveries: WebhookDelivery[];
  _count: { deliveries: number };
}

const EVENT_LABELS: Record<string, string> = {
  SCAN_COMPLETED: "Scan Completed",
  CRITICAL_ISSUES_FOUND: "Critical Issues Found",
  SCORE_DROPPED: "Score Dropped",
  ISSUE_STATUS_CHANGED: "Issue Status Changed",
};

const ALL_EVENTS = Object.keys(EVENT_LABELS);

interface Props {
  initialWebhooks: Webhook[];
}

export function WebhookManager({ initialWebhooks }: Props) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(ALL_EVENTS);
  const [loading, setLoading] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const router = useRouter();

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const create = async () => {
    if (!url.trim() || events.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create webhook");
        return;
      }
      const data = await res.json();
      setNewSecret(data.webhook.secret);
      setUrl("");
      setEvents(ALL_EVENTS);
      setShowForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await fetch("/api/settings/webhooks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !enabled } : w)),
    );
  };

  const remove = async (id: string) => {
    await fetch(`/api/settings/webhooks?id=${id}`, { method: "DELETE" });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Secret reveal */}
      {newSecret && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-yellow-400 mb-2">
              Webhook signing secret — copy now, it will not be shown again:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background p-2 rounded font-mono break-all">
                {showSecret ? newSecret : "••••••••••••••••••••••••••••••••"}
              </code>
              <button onClick={() => setShowSecret(!showSecret)} className="p-1 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewSecret(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhook list */}
      {webhooks.map((w) => (
        <Card key={w.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">{w.url}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {w.events.map((e) => (
                    <Badge key={e} variant="secondary" className="text-[10px]">
                      {EVENT_LABELS[e] || e}
                    </Badge>
                  ))}
                </div>
                {/* Recent deliveries */}
                {w.deliveries.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {w.deliveries.map((d) => (
                      <span
                        key={d.id}
                        title={`${d.event} — ${d.statusCode ?? "error"} at ${new Date(d.deliveredAt).toLocaleString()}`}
                        className={`w-2 h-2 rounded-full ${d.success ? "bg-green-400" : "bg-red-400"}`}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {w._count.deliveries} total deliveries
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleEnabled(w.id, w.enabled)}
                  aria-label={w.enabled ? "Disable webhook" : "Enable webhook"}
                >
                  {w.enabled ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(w.id)}
                  className="text-red-400 hover:text-red-300"
                  aria-label="Delete webhook"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <label htmlFor="wh-url" className="text-xs font-medium text-muted-foreground">
                Endpoint URL
              </label>
              <input
                id="wh-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks/accesskit"
                className="mt-1 block w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Events</p>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((event) => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      events.includes(event)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {EVENT_LABELS[event]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={loading} size="sm">
                {loading ? "Creating..." : "Create Webhook"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      )}
    </div>
  );
}
