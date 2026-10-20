"use client";

import clsx from "clsx";
import { BarChart3, Clock, Flame, Gauge, Star, Trophy } from "lucide-react";
import { useState } from "react";
import { useAreas, useStats } from "@/lib/client/hooks";
import { formatMinutes, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/shared/dates";
import type { AreaMinutes } from "@/lib/shared/types";
import { Heatmap } from "@/components/charts/Heatmap";
import { MoodTrend, WeeklyTrend } from "@/components/charts/StatsCharts";
import { AreaIcon, EmptyState, PageHeader, Segmented, Skeleton } from "@/components/ui";

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Star; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3.5">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5 text-primary" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function StatsPage() {
  const { data, isLoading } = useStats();
  const areas = useAreas();
  const [range, setRange] = useState<"week" | "month">("week");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (data.totals.doneAllTime === 0) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState icon={BarChart3} title="No history yet" body="Complete a few tasks and your patterns will show up here: streaks, best days and where your time goes." />
      </div>
    );
  }

  const { last30 } = data.top3;
  const winRate = last30.days ? Math.round((last30.wins / last30.days) * 100) : null;
  const best = [...data.weekdays].sort((a, b) => b.pct - a.pct)[0];
  const ratio = data.estimates.ratio;
  const areaTime = data.areaTime[range];

  return (
    <div className="space-y-4">
      <PageHeader title="Stats" subtitle={`${data.totals.doneAllTime.toLocaleString()} tasks done · ${formatMinutes(data.totals.focusMinAllTime)} focused`} />

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={Trophy} label="Top 3 win rate" value={winRate === null ? "–" : `${winRate}%`} sub={`${last30.wins} of ${last30.days} days · 30d`} />
        <Tile icon={Flame} label="Active streak" value={`${data.streaks.activeDays}d`} sub={data.streaks.top3Wins ? `${data.streaks.top3Wins}-day win streak` : "Days with a completion"} />
        <Tile icon={Star} label="Best day" value={best && best.pct ? WEEKDAY_SHORT[best.weekday - 1] : "–"} sub={best && best.pct ? `${Math.round(best.pct * 100)}% done on average` : "Not enough data"} />
        <Tile
          icon={Gauge}
          label="Estimates"
          value={ratio ? `${ratio.toFixed(2)}×` : "–"}
          sub={!ratio ? "Add estimates to tasks" : Math.abs(ratio - 1) < 0.1 ? "Spot on" : ratio > 1 ? "Tasks take longer than planned" : "Faster than planned"}
        />
      </div>

      <Card title="Last 365 days">
        <Heatmap days={data.heatmap} />
      </Card>

      <Card title="Weekly completion">
        <WeeklyTrend weeks={data.weekly} />
      </Card>

      <Card
        title="Time per area"
        action={
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        }
      >
        <AreaBars rows={areaTime} areas={areas} />
      </Card>

      <Card title="By weekday">
        <div className="flex h-32 items-end gap-2" role="img" aria-label={`Average completion by weekday. Best: ${best ? WEEKDAY_LONG[best.weekday - 1] : "none"}`}>
          {data.weekdays.map((w) => (
            <div key={w.weekday} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${WEEKDAY_LONG[w.weekday - 1]}: ${Math.round(w.pct * 100)}% done, ${w.done} tasks/day`}>
              <span className="text-[10px] text-muted tabular-nums">{w.pct ? `${Math.round(w.pct * 100)}%` : ""}</span>
              <div
                className={clsx("w-full rounded-t-md", w.weekday === best?.weekday ? "bg-primary" : "bg-primary/35")}
                style={{ height: `${Math.max(4, w.pct * 100)}%` }}
              />
              <span className={clsx("text-xs", w.weekday === best?.weekday ? "font-semibold text-fg" : "text-muted")}>{WEEKDAY_SHORT[w.weekday - 1][0]}</span>
            </div>
          ))}
        </div>
      </Card>

      {data.estimates.byArea.length > 0 && (
        <Card title="Estimated vs actual">
          <ul className="space-y-2">
            {data.estimates.byArea
              .filter((r) => r.samples >= 3)
              .sort((a, b) => b.ratio - a.ratio)
              .map((r) => {
                const area = areas.byId(r.area_id);
                return (
                  <li key={r.area_id ?? 0} className="flex items-center gap-3 text-sm">
                    <AreaIcon area={area} />
                    <span className="flex-1">{area?.name ?? "No area"}</span>
                    <span className="text-xs text-muted">{r.samples} tasks</span>
                    <span className={clsx("w-14 text-right font-medium tabular-nums", r.ratio > 1.25 ? "text-warning" : "text-fg")}>{r.ratio.toFixed(2)}×</span>
                  </li>
                );
              })}
          </ul>
          <p className="mt-3 text-xs text-muted">1.00× means tasks take exactly as long as estimated. Above 1, pad your estimates.</p>
        </Card>
      )}

      <Card title="Habit streaks">
        {data.streaks.habits.length ? (
          <ul className="space-y-2.5">
            {data.streaks.habits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <Flame className={clsx("size-4", h.current ? "text-warning" : "text-muted")} />
                <span className="flex-1 truncate">{h.title}</span>
                <span className="font-medium tabular-nums">
                  {h.current}
                  {h.unit === "weeks" ? "w" : "d"}
                </span>
                <span className="w-16 text-right text-xs text-muted tabular-nums">
                  best {h.best}
                  {h.unit === "weeks" ? "w" : "d"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No active habits.</p>
        )}
      </Card>

      <Card title="Energy & mood · 30 days">
        {data.moods.length >= 2 ? <MoodTrend data={data.moods} /> : <p className="text-sm text-muted">Log a few evening reflections to see your energy and mood trend.</p>}
      </Card>
    </div>
  );
}

/** Labeled horizontal bars: identity is carried by the label, not color alone. */
function AreaBars({ rows, areas }: { rows: AreaMinutes[]; areas: ReturnType<typeof useAreas> }) {
  if (!rows.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Clock className="size-4" /> No focus sessions yet. Start one from any task.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.minutes));
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const area = areas.byId(r.area_id);
        return (
          <li key={r.area_id ?? 0} className="text-sm">
            <div className="mb-1 flex items-center gap-2">
              <AreaIcon area={area} className="size-3.5" />
              <span className="flex-1">{area?.name ?? "No area"}</span>
              <span className="font-medium tabular-nums">{formatMinutes(r.minutes)}</span>
              <span className="w-10 text-right text-xs text-muted tabular-nums">{Math.round((r.minutes / total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-track">
              <div className="h-full rounded-full" style={{ width: `${(r.minutes / max) * 100}%`, background: area?.color ?? "var(--muted)" }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
