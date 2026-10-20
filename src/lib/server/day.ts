import { bools, db } from "./db";
import { expireFlexibleInstances, generateInstances } from "./habits";
import { getMeta, getSettings, setMeta, today as getToday } from "./settings";
import { listTasks } from "./tasks";
import { thisWeekFocus } from "./review";
import { addDays, localHour, weekStart, weekday } from "@/lib/shared/dates";
import type { DayLogInput } from "@/lib/shared/schemas";
import type { DayLog, TodayData } from "@/lib/shared/types";
import type { z } from "zod";

/**
 * Runs once per logical day (on the first request of a new day):
 * - unfinished one-off tasks from earlier days move to today (carried_over_count + 1)
 * - flexible weekly habit instances from past days expire
 * - today's habit instances are generated
 */
export function ensureDay(): string {
  const today = getToday();
  if (getMeta("last_rollover") === today) return today;

  db().transaction(() => {
    const stale = db()
      .prepare("SELECT id, scheduled_date FROM tasks WHERE status = 'todo' AND recurrence_id IS NULL AND scheduled_date < ?")
      .all(today) as { id: number; scheduled_date: string }[];
    const log = db().prepare("INSERT INTO carry_log (task_id, from_date, to_date) VALUES (?, ?, ?)");
    const move = db().prepare(
      "UPDATE tasks SET scheduled_date = ?, carried_over_count = carried_over_count + 1, is_top3 = 0 WHERE id = ?",
    );
    for (const t of stale) {
      log.run(t.id, t.scheduled_date, today);
      move.run(today, t.id);
    }
    expireFlexibleInstances(today);
    generateInstances(today);
    setMeta("last_rollover", today);
  })();
  return today;
}

export function getDayLog(date: string): DayLog | null {
  const row = db().prepare("SELECT * FROM day_logs WHERE date = ?").get(date);
  return row ? bools(row as DayLog, ["top3_done"]) : null;
}

export function saveDayLog(date: string, input: z.infer<typeof DayLogInput>): DayLog {
  db().prepare("INSERT OR IGNORE INTO day_logs (date) VALUES (?)").run(date);
  const fields = Object.entries(input).filter(([, v]) => v !== undefined);
  if (fields.length) {
    db()
      .prepare(`UPDATE day_logs SET ${fields.map(([k]) => `${k} = @${k}`).join(", ")} WHERE date = @date`)
      .run({ ...Object.fromEntries(fields), date });
  }
  return getDayLog(date)!;
}

/** Week start of a weekly review that should be shown now, if any. */
function pendingReview(today: string, hour: number): string | null {
  const has = (ws: string) =>
    Boolean(db().prepare("SELECT 1 FROM weekly_reviews WHERE week_start = ? AND completed_at IS NOT NULL").get(ws));
  const wd = weekday(today);
  if (wd === 7 && hour >= 18) {
    const ws = weekStart(today);
    return has(ws) ? null : ws;
  }
  if (wd === 1) {
    const ws = addDays(weekStart(today), -7);
    return has(ws) || getMeta(`review_dismissed:${ws}`) ? null : ws;
  }
  return null;
}

export function todayData(): TodayData {
  const today = ensureDay();
  const settings = getSettings();
  const hour = localHour();

  const tasks = listTasks("scheduled_date = @today AND status = 'todo'", { today }, "is_top3 DESC, priority, sort_order, id");
  const done = listTasks("status = 'done' AND completed_date = @today", { today }, "completed_at DESC");
  const plannedMin = [...tasks, ...done].reduce((s, t) => s + (t.estimate_min ?? 0), 0);
  const dayLog = getDayLog(today);
  const lateEvening = hour >= settings.reflection_hour || hour < settings.day_start_hour;

  return {
    today,
    tasks,
    done,
    plannedMin,
    availableMin: Math.round(settings.available_hours * 60),
    dayLog,
    reviewDue: pendingReview(today, hour),
    weekFocus: thisWeekFocus(today),
    reflectionDue: lateEvening && !(dayLog && (dayLog.energy || dayLog.mood)) && !getMeta(`reflection_dismissed:${today}`),
  };
}
