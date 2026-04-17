"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Mail, Monitor, Scan, AlertTriangle, TrendingDown, CalendarDays, UserCheck } from "lucide-react";

interface Preference {
  type: string;
  email: boolean;
  inApp: boolean;
}

const TYPE_META: Record<string, { label: string; description: string; icon: typeof Bell }> = {
  SCAN_COMPLETE: {
    label: "Scan Complete",
    description: "When a website scan finishes",
    icon: Scan,
  },
  CRITICAL_ISSUES: {
    label: "Critical Issues",
    description: "When a scan finds critical accessibility violations",
    icon: AlertTriangle,
  },
  SCORE_DROP: {
    label: "Score Drop",
    description: "When a website's score drops 5+ points",
    icon: TrendingDown,
  },
  WEEKLY_DIGEST: {
    label: "Weekly Digest",
    description: "Monday summary of all website scores and issues",
    icon: CalendarDays,
  },
  ISSUE_ASSIGNED: {
    label: "Issue Assigned",
    description: "When an issue is assigned to you",
    icon: UserCheck,
  },
};

interface Props {
  initialPreferences: Preference[];
}

export function NotificationPreferencesForm({ initialPreferences }: Props) {
  const [prefs, setPrefs] = useState<Preference[]>(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (type: string, channel: "email" | "inApp") => {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [channel]: !p[channel] } : p)),
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: prefs }),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      {/* Column headers */}
      <div className="flex items-center justify-end gap-8 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center gap-1 w-16 justify-center">
          <Mail className="h-3.5 w-3.5" />
          Email
        </div>
        <div className="flex items-center gap-1 w-16 justify-center">
          <Monitor className="h-3.5 w-3.5" />
          In-App
        </div>
      </div>

      {prefs.map((pref) => {
        const meta = TYPE_META[pref.type];
        if (!meta) return null;
        const Icon = meta.icon;

        return (
          <Card key={pref.type}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4.5 w-4.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="w-16 flex justify-center">
                    <button
                      onClick={() => toggle(pref.type, "email")}
                      role="switch"
                      aria-checked={pref.email}
                      aria-label={`${meta.label} email notifications`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        pref.email ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                          pref.email ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="w-16 flex justify-center">
                    <button
                      onClick={() => toggle(pref.type, "inApp")}
                      role="switch"
                      aria-checked={pref.inApp}
                      aria-label={`${meta.label} in-app notifications`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        pref.inApp ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                          pref.inApp ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
        {saved && <span className="text-sm text-green-400">Preferences saved</span>}
      </div>
    </div>
  );
}
