"use client";

/** Shared tooltip shell for Recharts: surface card, text in ink tokens, colored key beside values. */
export function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-fg">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted">
          {r.color && (
            <span
              className="inline-block h-0.5 w-3 rounded"
              style={r.dashed ? { borderTop: `2px dashed ${r.color}` } : { background: r.color, height: 2 }}
            />
          )}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-fg tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fill: "var(--muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
