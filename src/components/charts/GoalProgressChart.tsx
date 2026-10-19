"use client";

import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { diffDays, formatShort } from "@/lib/shared/dates";
import { formatAmount } from "../GoalBits";
import { axisProps, TooltipCard } from "./ChartTooltip";

const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

type Props = {
  data: { date: string; value: number }[];
  total: number;
  unit: string;
  start: string;
  deadline: string | null;
};

/** Actual cumulative progress vs the straight-line pace needed to hit the deadline. */
export function GoalProgressChart({ data, total, unit, start, deadline }: Props) {
  const span = deadline ? Math.max(1, diffDays(deadline, start)) : 0;
  const rows = data.map((d) => ({
    ...d,
    ideal: deadline && total > 0 ? Math.round(Math.min(total, (total * Math.max(0, diffDays(d.date, start))) / span) * 10) / 10 : null,
  }));
  const yMax = Math.max(total, ...rows.map((r) => r.value)) || 1;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-primary" /> Actual
        </span>
        {deadline && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-muted" /> Needed pace
          </span>
        )}
      </div>
      <div className="h-52" role="img" aria-label={`Progress over time, now ${formatAmount(rows.at(-1)?.value ?? 0, unit)} of ${formatAmount(total, unit)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goal-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
            <XAxis dataKey="date" {...axisProps} tickFormatter={formatShort} minTickGap={40} />
            <YAxis {...axisProps} domain={[0, yMax]} allowDecimals={false} width={36} tickFormatter={compact} />
            {total > 0 && <ReferenceLine y={total} stroke="var(--muted)" strokeOpacity={0.5} label={{ value: "Target", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} />}
            <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#goal-fill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            <Line type="linear" dataKey="ideal" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeOpacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={formatShort(String(label))}
                    rows={[
                      { label: "Actual", value: formatAmount(Number(payload[0].payload.value), unit), color: "var(--primary)" },
                      ...(payload[0].payload.ideal !== null
                        ? [{ label: "Needed", value: formatAmount(Number(payload[0].payload.ideal), unit), color: "var(--muted)", dashed: true }]
                        : []),
                    ]}
                  />
                ) : null
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
