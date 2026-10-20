"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, formatDay, weekStart } from "@/lib/shared/dates";

type Day = { date: string; done: number; planned: number };

// Sequential: one hue, light → dark. Empty days sit on the track color.
const LEVELS = ["bg-track", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(d: Day) {
  if (!d.planned) return 0;
  const pct = d.done / d.planned;
  return pct < 0.25 ? 1 : pct < 0.5 ? 2 : pct < 0.75 ? 3 : 4;
}

function describe(d: Day) {
  if (!d.planned) return `${formatDay(d.date)}: nothing planned`;
  return `${formatDay(d.date)}: ${d.done} of ${d.planned} done (${Math.round((d.done / d.planned) * 100)}%)`;
}

/** GitHub-style completion heatmap, Monday-first columns, colored by % done. */
export function Heatmap({ days }: { days: Day[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Day | null>(null);

  const { weeks, months } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    const last = days.at(-1)?.date ?? "";
    const weeks: (Day | null)[][] = [];
    const months: { index: number; label: string }[] = [];
    for (let w = weekStart(days[0]?.date ?? last); w <= last; w = addDays(w, 7)) {
      const col = Array.from({ length: 7 }, (_, i) => byDate.get(addDays(w, i)) ?? null);
      const firstOfMonth = col.find((c) => c?.date.endsWith("-01"));
      if (firstOfMonth) months.push({ index: weeks.length, label: MONTHS[Number(firstOfMonth.date.slice(5, 7)) - 1] });
      weeks.push(col);
    }
    return { weeks, months };
  }, [days]);

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, [weeks.length]);

  const active = days.filter((d) => d.planned > 0);
  const summary = `${active.length} active days in the last year, ${days.reduce((s, d) => s + d.done, 0)} tasks done`;
  const latest = selected ?? days.at(-1);

  return (
    <div>
      <div ref={scroller} className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
        <div className="inline-block" role="img" aria-label={summary}>
          <div className="relative mb-1 h-4 text-[10px] text-muted">
            {months.map((m) => (
              <span key={`${m.label}-${m.index}`} className="absolute" style={{ left: m.index * 14 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]" onMouseLeave={() => setSelected(null)}>
            {weeks.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((d, di) =>
                  d ? (
                    <button
                      key={d.date}
                      type="button"
                      tabIndex={-1}
                      title={describe(d)}
                      onMouseEnter={() => setSelected(d)}
                      onClick={() => setSelected(d)}
                      className={clsx(
                        "size-[11px] rounded-[3px] transition-transform hover:scale-125",
                        LEVELS[level(d)],
                        selected?.date === d.date && "ring-2 ring-fg/60 ring-offset-1 ring-offset-surface",
                      )}
                    />
                  ) : (
                    <span key={di} className="size-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="min-h-4 font-medium text-fg">{latest ? describe(latest) : ""}</span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {LEVELS.map((l) => (
            <span key={l} className={clsx("size-[10px] rounded-[3px]", l)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
