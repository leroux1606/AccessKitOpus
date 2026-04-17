"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ExternalLink,
  Trash2,
  Loader2,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface WebsiteOption {
  id: string;
  name: string;
  url: string;
}

interface PortalData {
  id: string;
  slug: string;
  companyName: string | null;
  enabled: boolean;
  website: { name: string; url: string; currentScore: number | null; lastScanAt: string | null };
}

interface PortalManagerProps {
  portals: PortalData[];
  websites: WebsiteOption[];
  baseUrl: string;
}

export function PortalManager({ portals: initialPortals, websites, baseUrl }: PortalManagerProps) {
  const [portals, setPortals] = useState(initialPortals);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState("");
  const [clientName, setClientName] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Websites that don't already have portals
  const availableWebsites = websites.filter(
    (w) => !portals.some((p) => p.website.url === w.url)
  );

  async function handleCreate() {
    if (!selectedWebsite) return;
    setCreating(true);
    try {
      const res = await fetch("/api/client-portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: selectedWebsite,
          companyName: clientName.trim() || undefined,
          password: password || undefined,
        }),
      });
      if (res.ok) {
        const portal = await res.json();
        setPortals((prev) => [portal, ...prev]);
        setShowCreate(false);
        setSelectedWebsite("");
        setClientName("");
        setPassword("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    setToggling(id);
    try {
      const res = await fetch(`/api/client-portals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        setPortals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enabled: !currentEnabled } : p))
        );
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/client-portals/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPortals((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {portals.length} portal{portals.length !== 1 ? "s" : ""}
        </p>
        {!showCreate && availableWebsites.length > 0 && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create portal
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <label htmlFor="portalWebsite" className="text-sm font-medium block mb-1.5">
                Website
              </label>
              <select
                id="portalWebsite"
                value={selectedWebsite}
                onChange={(e) => setSelectedWebsite(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a website...</option>
                {availableWebsites.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.url})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="clientName" className="text-sm font-medium block mb-1.5">
                Client Name (optional)
              </label>
              <input
                id="clientName"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="portalPassword" className="text-sm font-medium block mb-1.5">
                Password Protection (optional)
              </label>
              <input
                id="portalPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for public access"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !selectedWebsite}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create portal"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portal list */}
      {portals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No client portals yet. Create one to give your clients a branded view of their accessibility progress.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {portals.map((portal) => (
            <Card key={portal.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">
                        {portal.companyName || portal.website.name}
                      </h3>
                      <Badge variant={portal.enabled ? "default" : "secondary"} className="text-xs">
                        {portal.enabled ? "Active" : "Disabled"}
                      </Badge>
                      {portal.website.currentScore !== null && (
                        <Badge variant="outline" className="text-xs">
                          Score: {portal.website.currentScore}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{portal.website.url}</p>
                    <a
                      href={`${baseUrl}/portal/${portal.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      {baseUrl}/portal/{portal.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(portal.id, portal.enabled)}
                      disabled={toggling === portal.id}
                      title={portal.enabled ? "Disable portal" : "Enable portal"}
                    >
                      {toggling === portal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : portal.enabled ? (
                        <ToggleRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(portal.id)}
                      disabled={deleting === portal.id}
                    >
                      {deleting === portal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
