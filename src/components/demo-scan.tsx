"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DemoResult {
  url: string;
  score: number;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  topIssues: Array<{
    severity: string;
    description: string;
    ruleId: string;
    wcagCriterion: string | null;
    fixSuggestion: string | null;
  }>;
}

export function DemoScan() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDemo = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/demo-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400";

  const severityColor = (s: string) => {
    switch (s) {
      case "CRITICAL": return "bg-red-500/20 text-red-400";
      case "SERIOUS": return "bg-orange-500/20 text-orange-400";
      case "MODERATE": return "bg-yellow-500/20 text-yellow-400";
      case "MINOR": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runDemo()}
          placeholder="Enter a website URL to scan..."
          className="flex-1 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(262,83%,68%)]"
          disabled={loading}
          aria-label="Website URL to scan"
        />
        <Button
          onClick={runDemo}
          disabled={loading || !url.trim()}
          className="bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0 px-6"
        >
          {loading ? (
            <Scan className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Scan
            </>
          )}
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground mt-3 text-center animate-pulse">
          Scanning single page... this may take 15-30 seconds
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 mt-3 text-center">{error}</p>
      )}

      {/* Results */}
      {result && (
        <Card className="mt-6 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            {/* Score header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{result.url}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-4xl font-bold ${scoreColor(result.score)}`}>
                    {result.score}
                  </span>
                  <span className="text-muted-foreground text-sm">/100</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{result.totalViolations}</p>
                <p className="text-xs text-muted-foreground">issues found</p>
              </div>
            </div>

            {/* Severity breakdown */}
            <div className="flex gap-3 mb-5">
              {[
                { label: "Critical", count: result.criticalCount, color: "text-red-400" },
                { label: "Serious", count: result.seriousCount, color: "text-orange-400" },
                { label: "Moderate", count: result.moderateCount, color: "text-yellow-400" },
                { label: "Minor", count: result.minorCount, color: "text-blue-400" },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center p-2 rounded-lg bg-muted/30">
                  <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Top issues */}
            {result.topIssues.length > 0 && (
              <div className="space-y-2 mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Issues</p>
                {result.topIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{issue.description}</p>
                      {issue.wcagCriterion && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">WCAG {issue.wcagCriterion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {result.totalViolations === 0 ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="h-3 w-3" /> No issues detected
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    Full scan covers all pages with detailed fixes
                  </span>
                )}
              </p>
              <Button size="sm" variant="ghost" className="text-[hsl(262,83%,68%)]" asChild>
                <Link href="/login">
                  Get full report <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
