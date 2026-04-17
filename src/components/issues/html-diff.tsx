"use client";

interface HtmlDiffProps {
  original: string;
  fixed: string | null;
}

function formatHtml(html: string): string {
  // Simple formatter: add newlines after > and before <
  return html
    .replace(/></g, ">\n<")
    .replace(/\s+/g, " ")
    .trim();
}

export function HtmlDiff({ original, fixed }: HtmlDiffProps) {
  if (!fixed) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current HTML</h4>
        <pre className="rounded-md bg-muted/50 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-red-400">
          {formatHtml(original)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
          Current HTML
        </h4>
        <pre className="rounded-md bg-red-500/5 border border-red-500/20 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-red-400">
          {formatHtml(original)}
        </pre>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
          Suggested Fix
        </h4>
        <pre className="rounded-md bg-green-500/5 border border-green-500/20 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-green-400">
          {formatHtml(fixed)}
        </pre>
      </div>
    </div>
  );
}
