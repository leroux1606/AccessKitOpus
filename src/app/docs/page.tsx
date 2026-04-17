import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Key, Scan, Webhook } from "lucide-react";

export const metadata = { title: "API Documentation — AccessKit" };

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/websites",
    description: "List all websites in your organization",
    auth: true,
    response: `{
  "websites": [
    {
      "id": "clx...",
      "name": "Example Site",
      "url": "https://example.com",
      "currentScore": 87,
      "lastScanAt": "2026-03-25T10:00:00Z"
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/websites",
    description: "Add a new website to monitor",
    auth: true,
    body: `{ "name": "My Site", "url": "https://mysite.com" }`,
    response: `{ "website": { "id": "clx...", "name": "My Site", "url": "https://mysite.com" } }`,
  },
  {
    method: "GET",
    path: "/api/v1/websites/:id",
    description: "Get details for a specific website",
    auth: true,
    response: `{ "id": "clx...", "name": "Example Site", "currentScore": 87, ... }`,
  },
  {
    method: "POST",
    path: "/api/v1/scans",
    description: "Trigger a new accessibility scan",
    auth: true,
    body: `{ "websiteId": "clx..." }`,
    response: `{ "scan": { "id": "clx...", "status": "QUEUED" } }`,
  },
  {
    method: "GET",
    path: "/api/v1/scans?websiteId=xxx",
    description: "List scans for a website",
    auth: true,
    response: `{
  "scans": [
    {
      "id": "clx...",
      "status": "COMPLETED",
      "score": 87,
      "totalViolations": 12,
      "completedAt": "2026-03-25T10:05:00Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/issues?websiteId=xxx",
    description: "List accessibility issues for a website",
    auth: true,
    response: `{
  "issues": [
    {
      "id": "clx...",
      "severity": "CRITICAL",
      "description": "Images must have alternate text",
      "ruleId": "image-alt",
      "status": "OPEN",
      "wcagCriterion": "1.1.1"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    description: "OpenAPI 3.0 specification (machine-readable)",
    auth: false,
    response: `{ "openapi": "3.0.0", "info": { ... }, "paths": { ... } }`,
  },
];

function MethodBadge({ method }: { method: string }) {
  const color =
    method === "GET"
      ? "bg-green-500/20 text-green-400"
      : method === "POST"
        ? "bg-blue-500/20 text-blue-400"
        : method === "PATCH"
          ? "bg-yellow-500/20 text-yellow-400"
          : "bg-red-500/20 text-red-400";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>{method}</span>;
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto border-b border-border/50">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">AK</span>
            </div>
            <span className="font-bold text-foreground">AccessKit</span>
          </Link>
          <Badge variant="secondary">API Docs</Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground mb-10">
          Integrate AccessKit into your CI/CD pipeline, custom dashboards, or automation workflows.
        </p>

        {/* Authentication */}
        <section className="mb-12" id="authentication">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5 text-[hsl(262,83%,68%)]" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All API requests (except the OpenAPI spec) require an API key. Create one in{" "}
                <strong>Settings &rarr; API Keys</strong>.
              </p>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Include in every request:</p>
                <code className="text-sm font-mono text-foreground">
                  Authorization: Bearer ak_your_api_key_here
                </code>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Example with curl:</p>
                <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">{`curl -H "Authorization: Bearer ak_..." \\
  https://app.accesskit.io/api/v1/websites`}</pre>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Rate limits: <strong className="text-foreground">100 req/min</strong> (Agency), <strong className="text-foreground">1000 req/min</strong> (Enterprise)</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Webhooks */}
        <section className="mb-12" id="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Webhook className="h-5 w-5 text-[hsl(262,83%,68%)]" />
                Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure webhooks in <strong>Settings &rarr; Webhooks</strong> to receive real-time notifications.
              </p>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Available Events</p>
                <div className="flex flex-wrap gap-2">
                  {["SCAN_COMPLETED", "CRITICAL_ISSUES_FOUND", "SCORE_DROPPED", "ISSUE_STATUS_CHANGED"].map((e) => (
                    <Badge key={e} variant="secondary" className="font-mono text-xs">{e}</Badge>
                  ))}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Payload format:</p>
                <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">{`{
  "event": "SCAN_COMPLETED",
  "data": { "scanId": "...", "score": 87, ... },
  "timestamp": "2026-03-25T10:05:00Z"
}`}</pre>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify deliveries with the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">X-AccessKit-Signature</code> header (HMAC-SHA256).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <h2 className="text-xl font-bold mb-6">Endpoints</h2>
          <div className="space-y-4">
            {endpoints.map((ep, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <MethodBadge method={ep.method} />
                    <code className="text-sm font-mono font-medium text-foreground">{ep.path}</code>
                    {ep.auth && <Badge variant="outline" className="text-[10px]">Auth required</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{ep.description}</p>
                  {ep.body && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Request body:</p>
                      <pre className="bg-muted/30 rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">{ep.body}</pre>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Response:</p>
                    <pre className="bg-muted/30 rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">{ep.response}</pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CI/CD Example */}
        <section className="mt-12" id="cicd">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scan className="h-5 w-5 text-[hsl(262,83%,68%)]" />
                CI/CD Integration Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Trigger a scan on every deploy and fail the build if critical issues are found:
              </p>
              <pre className="bg-muted/30 rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{`# GitHub Actions example
- name: Trigger AccessKit scan
  run: |
    SCAN=$(curl -s -X POST \\
      -H "Authorization: Bearer \${{ secrets.ACCESSKIT_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{"websiteId": "your-website-id"}' \\
      https://app.accesskit.io/api/v1/scans)

    echo "Scan triggered: $SCAN"

- name: Check for critical issues
  run: |
    ISSUES=$(curl -s \\
      -H "Authorization: Bearer \${{ secrets.ACCESSKIT_API_KEY }}" \\
      "https://app.accesskit.io/api/v1/issues?websiteId=your-website-id&severity=CRITICAL&status=OPEN")

    COUNT=$(echo "$ISSUES" | jq '.issues | length')
    if [ "$COUNT" -gt "0" ]; then
      echo "::error::$COUNT critical accessibility issues found"
      exit 1
    fi`}</pre>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} AccessKit. All rights reserved.</p>
      </footer>
    </div>
  );
}
