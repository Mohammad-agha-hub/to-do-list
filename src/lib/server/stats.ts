import { db } from "./db";
import { ensureDay } from "./day";
import { listHabits } from "./habits";
import { addDays, dateRange, monthStart, startOfDayUTC, weekStart, weekday } from "@/lib/shared/dates";
import type { AreaMinutes, StatsData } from "@/lib/shared/types";

type DateCount = { d: string; n: number };

function countMap(sql: string, ...params: unknown[]): Map<string, number> {
  return new Map((db().prepare(sql).all(...params) as DateCount[]).map((r) => [r.d, r.n]));
}

/** Per-day completion: done that day vs everything that was planned for it. */
export function dailyCompletion(from: string, to: string) {
  const done = countMap(
    "SELECT completed_date AS d, COUNT(*) AS n FROM tasks WHERE status = 'done' AND completed_date BETWEEN ? AND ? GROUP BY d",
    from,
    to,
  );
  const carried = countMap("SELECT from_date AS d, COUNT(*) AS n FROM carry_log WHERE from_date BETWEEN ? AND ? GROUP BY d", from, to);
  const open = countMap(
    "SELECT scheduled_date AS d, COUNT(*) AS n FROM tasks WHERE status = 'todo' AND scheduled_date BETWEEN ? AND ? GROUP BY d",
    from,
    to,
  );
  return dateRange(from, to).map((date) => {
    const d = done.get(date) ?? 0;
    return { date, done: d, planned: d + (carried.get(date) ?? 0) + (open.get(date) ?? 0) };
  });
}

function areaMinutes(sinceDate: string): AreaMinutes[] {
  return db()
    .prepare(
      `SELECT t.area_id AS area_id, ROUND(SUM(f.duration_min)) AS minutes
       FROM focus_sessions f LEFT JOIN tasks t ON t.id = f.task_id
       WHERE f.started_at >= ? GROUP BY t.area_id ORDER BY minutes DESC`,
    )
    .all(startOfDayUTC(sinceDate)) as AreaMinutes[];
}

export function statsData(): StatsData {
  const today = ensureDay();
  const heatmap = dailyCompletion(addDays(today, -364), today);

  // Last 12 weeks, oldest first.
  const thisWeek = weekStart(today);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const week = addDays(thisWeek, (i - 11) * 7);
    const days = heatmap.filter((h) => h.date >= week && h.date < addDays(week, 7));
    return { week, done: days.reduce((s, d) => s + d.done, 0), planned: days.reduce((s, d) => s + d.planned, 0) };
  });

  // Best weekday over the last 12 weeks.
  const recent = heatmap.filter((h) => h.date >= addDays(thisWeek, -77) && h.date < today && h.planned > 0);
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((wd) => {
    const days = recent.filter((h) => weekday(h.date) === wd);
    const done = days.reduce((s, d) => s + d.done, 0);
    const planned = days.reduce((s, d) => s + d.planned, 0);
    return { weekday: wd, pct: planned ? done / planned : 0, done: days.length ? Math.round((done / days.length) * 10) / 10 : 0 };
  });

  const top3Row = (since: string) =>
    db()
      .prepare(
        "SELECT COALESCE(SUM(top3_done), 0) AS wins, COUNT(*) AS days FROM day_logs WHERE top3_count > 0 AND date >= ? AND (date < ? OR top3_done = 1)",
      )
      .get(since, today) as { wins: number; days: number };

  const est = db()
    .prepare(
      `SELECT area_id, SUM(actual_min) AS actual, SUM(estimate_min) AS estimate, COUNT(*) AS samples
       FROM tasks WHERE status = 'done' AND estimate_min > 0 AND actual_min > 0 GROUP BY area_id`,
    )
    .all() as { area_id: number | null; actual: number; estimate: number; samples: number }[];
  const totalActual = est.reduce((s, r) => s + r.actual, 0);
  const totalEstimate = est.reduce((s, r) => s + r.estimate, 0);

  // Consecutive days with at least one completion (today counts once something is done).
  let activeDays = 0;
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].done > 0) activeDays++;
    else if (heatmap[i].date !== today) break;
  }
  const wins = db().prepare("SELECT date, top3_done FROM day_logs WHERE top3_count > 0 ORDER BY date DESC").all() as {
    date: string;
    top3_done: number;
  }[];
  let top3Wins = 0;
  let expect = today;
  for (const w of wins) {
    if (w.date === today && !w.top3_done) {
      expect = addDays(today, -1);
      continue;
    }
    if (w.date !== expect || !w.top3_done) break;
    top3Wins++;
    expect = addDays(expect, -1);
  }

  const moods = db()
    .prepare("SELECT date, energy, mood FROM day_logs WHERE date >= ? AND (energy IS NOT NULL OR mood IS NOT NULL) ORDER BY date")
    .all(addDays(today, -29)) as StatsData["moods"];

  const totals = db()
    .prepare(
      "SELECT (SELECT COUNT(*) FROM tasks WHERE status = 'done') AS doneAllTime, (SELECT COALESCE(ROUND(SUM(duration_min)), 0) FROM focus_sessions) AS focusMinAllTime",
    )
    .get() as StatsData["totals"];

  return {
    today,
    heatmap,
    weekly,
    areaTime: { week: areaMinutes(thisWeek), month: areaMinutes(monthStart(today)) },
    top3: { last30: top3Row(addDays(today, -29)), all: top3Row("0000-00-00") },
    weekdays,
    estimates: {
      ratio: totalEstimate ? totalActual / totalEstimate : null,
      samples: est.reduce((s, r) => s + r.samples, 0),
      byArea: est.map((r) => ({ area_id: r.area_id, ratio: r.actual / r.estimate, samples: r.samples })),
    },
    streaks: {
      activeDays,
      top3Wins,
      habits: listHabits(today)
        .filter((h) => h.active)
        .map((h) => ({ id: h.id, title: h.title, current: h.current, best: h.best, unit: h.unit })),
    },
    moods,
    totals,
  };
}
