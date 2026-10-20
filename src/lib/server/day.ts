import { bools, db } from "./db";
import { expireFlexibleStmt, instanceStmts } from "./habits";
import { getMeta, getSettings, setMetaStmt, today as getToday } from "./settings";
import { listTasks } from "./tasks";
import { thisWeekFocus } from "./review";
import { addDays, localHour, weekStart, weekday } from "@/lib/shared/dates";
import type { DayLogInput } from "@/lib/shared/schemas";
import type { DayLog, TodayData } from "@/lib/shared/types";
import type { z } from "zod";

/**
 * Runs on the first request of a new logical day:
 * - unfinished one-off tasks from earlier days move to today (carried_over_count + 1)
 * - flexible weekly habit instances from past days expire
 * - today's habit instances are generated
 *
 * Requests can arrive in parallel, so every statement is set-based and only touches rows that
 * still need it: running the batch twice has the same effect as running it once.
 */
export async function ensureDay(): Promise<string> {
  const today = await getToday();
  if ((await getMeta("last_rollover")) === today) return today;

  await (await db()).batch([
    {
      sql: `INSERT INTO carry_log (task_id, from_date, to_date)
            SELECT id, scheduled_date, ? FROM tasks WHERE status = 'todo' AND recurrence_id IS NULL AND scheduled_date < ?`,
      params: [today, today],
    },
    {
      sql: `UPDATE tasks SET scheduled_date = ?, carried_over_count = carried_over_count + 1, is_top3 = 0
            WHERE status = 'todo' AND recurrence_id IS NULL AND scheduled_date < ?`,
      params: [today, today],
    },
    expireFlexibleStmt(today),
    ...(await instanceStmts(today)),
    setMetaStmt("last_rollover", today),
  ]);
  return today;
}

export async function getDayLog(date: string): Promise<DayLog | null> {
  const row = await (await db()).get<DayLog>("SELECT * FROM day_logs WHERE date = ?", [date]);
  return row ? bools(row, ["top3_done"]) : null;
}

export async function saveDayLog(date: string, input: z.infer<typeof DayLogInput>): Promise<DayLog> {
  const fields = Object.entries(input).filter(([, v]) => v !== undefined);
  await (await db()).batch([
    { sql: "INSERT OR IGNORE INTO day_logs (date) VALUES (?)", params: [date] },
    ...(fields.length
      ? [{ sql: `UPDATE day_logs SET ${fields.map(([k]) => `${k} = @${k}`).join(", ")} WHERE date = @date`, params: { ...Object.fromEntries(fields), date } }]
      : []),
  ]);
  return (await getDayLog(date))!;
}

/** Week start of a weekly review that should be shown now, if any. */
async function pendingReview(today: string, hour: number): Promise<string | null> {
  const has = async (ws: string) =>
    Boolean(await (await db()).get("SELECT 1 FROM weekly_reviews WHERE week_start = ? AND completed_at IS NOT NULL", [ws]));
  const wd = weekday(today);
  if (wd === 7 && hour >= 18) {
    const ws = weekStart(today);
    return (await has(ws)) ? null : ws;
  }
  if (wd === 1) {
    const ws = addDays(weekStart(today), -7);
    return (await has(ws)) || (await getMeta(`review_dismissed:${ws}`)) ? null : ws;
  }
  return null;
}

export async function todayData(): Promise<TodayData> {
  const today = await ensureDay();
  const hour = localHour();
  const [settings, tasks, done, dayLog, reviewDue, weekFocus, reflectionDismissed] = await Promise.all([
    getSettings(),
    listTasks("scheduled_date = @today AND status = 'todo'", { today }, "is_top3 DESC, priority, sort_order, id"),
    listTasks("status = 'done' AND completed_date = @today", { today }, "completed_at DESC"),
    getDayLog(today),
    pendingReview(today, hour),
    thisWeekFocus(today),
    getMeta(`reflection_dismissed:${today}`),
  ]);
  const plannedMin = [...tasks, ...done].reduce((s, t) => s + (t.estimate_min ?? 0), 0);
  const lateEvening = hour >= settings.reflection_hour || hour < settings.day_start_hour;

  return {
    today,
    tasks,
    done,
    plannedMin,
    availableMin: Math.round(settings.available_hours * 60),
    dayLog,
    reviewDue,
    weekFocus,
    reflectionDue: lateEvening && !(dayLog && (dayLog.energy || dayLog.mood)) && !reflectionDismissed,
  };
}
