"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Eye } from "lucide-react";

interface WhiteLabelConfig {
  companyName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
}

interface WhiteLabelFormProps {
  initial: WhiteLabelConfig;
}

export function WhiteLabelForm({ initial }: WhiteLabelFormProps) {
  const [config, setConfig] = useState<WhiteLabelConfig>({
    companyName: initial.companyName ?? "",
    primaryColor: initial.primaryColor ?? "#8B5CF6",
    secondaryColor: initial.secondaryColor ?? "#7C3AED",
    logoUrl: initial.logoUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/white-label", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Brand Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
          <CardDescription>
            These settings apply to client portals and white-label PDF reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="companyName" className="text-sm font-medium block mb-1.5">
              Company Name
            </label>
            <input
              id="companyName"
              type="text"
              value={config.companyName ?? ""}
              onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
              placeholder="Your Agency Name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Replaces &quot;AccessKit&quot; in reports and client portals
            </p>
          </div>

          <div>
            <label htmlFor="logoUrl" className="text-sm font-medium block mb-1.5">
              Logo URL
            </label>
            <input
              id="logoUrl"
              type="url"
              value={config.logoUrl ?? ""}
              onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
              placeholder="https://your-domain.com/logo.png"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Square image recommended (at least 200x200px). PNG or SVG.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="primaryColor" className="text-sm font-medium block mb-1.5">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.primaryColor ?? "#8B5CF6"}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <input
                  id="primaryColor"
                  type="text"
                  value={config.primaryColor ?? ""}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  placeholder="#8B5CF6"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label htmlFor="secondaryColor" className="text-sm font-medium block mb-1.5">
                Secondary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.secondaryColor ?? "#7C3AED"}
                  onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <input
                  id="secondaryColor"
                  type="text"
                  value={config.secondaryColor ?? ""}
                  onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                  placeholder="#7C3AED"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-6 bg-white">
            <div className="flex items-center gap-3 pb-4 border-b-2" style={{ borderColor: config.primaryColor ?? "#8B5CF6" }}>
              {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logoUrl}
                  alt="Logo preview"
                  className="w-7 h-7 rounded object-cover"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: config.primaryColor ?? "#8B5CF6" }}
                >
                  {(config.companyName ?? "AK").slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-bold text-gray-900">
                {config.companyName || "AccessKit"}
              </span>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              This is how your brand will appear on PDF reports and client portals.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save changes
        </Button>
        {saved && <span className="text-sm text-green-400">Saved successfully</span>}
      </div>
    </div>
  );
}
