"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShort } from "@/lib/shared/dates";
import { axisProps, TooltipCard } from "./ChartTooltip";

/** Weekly completion % for the last 12 weeks. */
export function WeeklyTrend({ weeks }: { weeks: { week: string; done: number; planned: number }[] }) {
  const data = weeks.map((w) => ({ ...w, pct: w.planned ? Math.round((w.done / w.planned) * 100) : null }));
  const known = data.filter((d) => d.pct !== null);
  const avg = known.length ? Math.round(known.reduce((s, d) => s + (d.pct ?? 0), 0) / known.length) : 0;
  return (
    <div className="h-44" role="img" aria-label={`Weekly completion over 12 weeks, averaging ${avg}%`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="week" {...axisProps} tickFormatter={formatShort} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} width={38} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={`Week of ${formatShort(String(payload[0].payload.week))}`}
                  rows={[
                    {
                      label: "Done",
                      value:
                        payload[0].payload.pct === null
                          ? "No tasks"
                          : `${payload[0].payload.done}/${payload[0].payload.planned} · ${payload[0].payload.pct}%`,
                      color: "var(--primary)",
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Energy and mood (1–5) over the last 30 days. */
export function MoodTrend({ data }: { data: { date: string; energy: number | null; mood: number | null }[] }) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-series-1" /> Energy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-series-2" /> Mood
        </span>
      </div>
      <div className="h-40" role="img" aria-label="Energy and mood over the last 30 days">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" {...axisProps} tickFormatter={formatShort} minTickGap={32} />
            <YAxis {...axisProps} domain={[1, 5]} ticks={[1, 3, 5]} width={24} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeOpacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={formatShort(String(label))}
                    rows={[
                      { label: "Energy", value: String(payload[0].payload.energy ?? "–"), color: "var(--series-1)" },
                      { label: "Mood", value: String(payload[0].payload.mood ?? "–"), color: "var(--series-2)" },
                    ]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="energy" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--series-1)" }} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="mood" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--series-2)" }} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
