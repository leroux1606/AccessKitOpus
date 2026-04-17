"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface ScoreDataPoint {
  date: string;
  score: number | null;
}

interface ScoreTrendChartProps {
  data: ScoreDataPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length < 2) return null;

  const validPoints = data.filter((d) => d.score !== null);
  const summaryText =
    validPoints.length > 0
      ? `Score trend: ${validPoints.map((d) => `${d.date} ${d.score}/100`).join(", ")}.`
      : "No score data available.";

  return (
    <>
      {/* Visually hidden table summary for screen reader users (WCAG 1.1.1) */}
      <span className="sr-only" role="img" aria-label={summaryText} />
      <ResponsiveContainer width="100%" height={160} aria-hidden="true">
      <LineChart data={data} margin={{ top: 5, right: 16, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickCount={6}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          formatter={(value) => [`${value} / 100`, "Score"]}
          labelStyle={{ fontWeight: 500 }}
        />
        {/* Reference line at 90 — "good" threshold */}
        <ReferenceLine
          y={90}
          stroke="hsl(var(--primary))"
          strokeDasharray="4 2"
          opacity={0.35}
          label={{ value: "90", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
    </>
  );
}
