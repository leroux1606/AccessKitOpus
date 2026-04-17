"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

interface ChartDataPoint {
  name: string;
  score: number;
  type: "own" | "competitor";
}

interface ComparisonChartProps {
  data: ChartDataPoint[];
}

export function ComparisonChart({ data }: ComparisonChartProps) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.score - a.score);

  const summaryText = sorted
    .map((d) => `${d.name} (${d.type === "own" ? "yours" : "competitor"}): ${d.score}/100`)
    .join(", ");

  return (
    <>
      <span className="sr-only" role="img" aria-label={`Score comparison: ${summaryText}`} />
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 40)} aria-hidden="true">
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: 12,
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value) => [`${value}/100`, "Score"]}
          />
          <ReferenceLine
            x={90}
            stroke="hsl(var(--primary))"
            strokeDasharray="4 2"
            opacity={0.35}
            label={{ value: "90", position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
            {sorted.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.type === "own"
                    ? "hsl(262, 83%, 68%)"
                    : "hsl(var(--muted-foreground))"
                }
                opacity={entry.type === "own" ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(262, 83%, 68%)" }} />
          Your sites
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground opacity-60" />
          Competitors
        </div>
      </div>
    </>
  );
}
