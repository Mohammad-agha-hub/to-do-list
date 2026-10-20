import type { z } from "zod";
import { db, type Stmt } from "./db";
import { notFound, setClause, sqlValues } from "./http";
import { today as getToday } from "./settings";
import { computeStreaks, habitStrip, isScheduledOn, weekDoneCount } from "@/lib/shared/metrics";
import type { HabitInput, HabitPatch, RecurrenceRule } from "@/lib/shared/schemas";
import type { Habit, HabitSummary } from "@/lib/shared/types";

type HabitRow = Omit<Habit, "rule" | "active"> & { rule: string; active: number };
const HABIT_COLS = "id, title, area_id, goal_id, rule, estimate_min, active, start_date";

function toHabit(row: HabitRow): Habit {
  return { ...row, rule: JSON.parse(row.rule) as RecurrenceRule, active: Boolean(row.active) };
}

export async function getHabit(id: number): Promise<Habit> {
  const row = await (await db()).get<HabitRow>(`SELECT ${HABIT_COLS} FROM recurrences WHERE id = ?`, [id]);
  if (!row) throw notFound("Habit not found");
  return toHabit(row);
}

export async function listHabitRows(): Promise<Habit[]> {
  return (await (await db()).all<HabitRow>(`SELECT ${HABIT_COLS} FROM recurrences ORDER BY active DESC, id`)).map(toHabit);
}

/** Dates (by scheduled day) each habit was completed. */
export async function habitDoneDates(): Promise<Map<number, Set<string>>> {
  const rows = await (await db()).all<{ recurrence_id: number; scheduled_date: string }>(
    "SELECT recurrence_id, scheduled_date FROM tasks WHERE recurrence_id IS NOT NULL AND status = 'done'",
  );
  const map = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.recurrence_id)) map.set(r.recurrence_id, new Set());
    map.get(r.recurrence_id)!.add(r.scheduled_date);
  }
  return map;
}

export async function listHabits(today?: string): Promise<HabitSummary[]> {
  const day = today ?? (await getToday());
  const [done, habits, todays] = await Promise.all([
    habitDoneDates(),
    listHabitRows(),
    (await db()).all<{ id: number; recurrence_id: number; status: string }>(
      "SELECT id, recurrence_id, status FROM tasks WHERE recurrence_id IS NOT NULL AND scheduled_date = ?",
      [day],
    ),
  ]);
  const byHabit = new Map(todays.map((r) => [r.recurrence_id, r]));
  return habits.map((h) => {
    const dates = done.get(h.id) ?? new Set<string>();
    const t = byHabit.get(h.id);
    return {
      ...h,
      ...computeStreaks(h.rule, h.start_date, day, dates),
      strip: habitStrip(h.rule, h.start_date, day, dates),
      todayTaskId: t?.id ?? null,
      todayDone: t?.status === "done",
      weekDone: weekDoneCount(day, dates),
    };
  });
}

/**
 * Statements that create a date's task instances for active habits.
 * INSERT OR IGNORE + the unique (recurrence_id, scheduled_date) index make this safe to repeat.
 */
export async function instanceStmts(date: string): Promise<Stmt[]> {
  const [habits, done] = await Promise.all([listHabitRows(), habitDoneDates()]);
  const inserts = habits
    .filter((h) => h.active && isScheduledOn(h.rule, date, h.start_date))
    .filter((h) => h.rule.type !== "weekly" || weekDoneCount(date, done.get(h.id) ?? new Set()) < h.rule.count)
    .map((h) => ({
      sql: `INSERT OR IGNORE INTO tasks (title, area_id, goal_id, estimate_min, scheduled_date, recurrence_id, priority, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, 2, 0)`,
      params: [h.title, h.area_id, h.goal_id, h.estimate_min, date, h.id],
    }));
  // Instances created before goal_id was copied over still point at no goal.
  const backfill: Stmt = {
    sql: `UPDATE tasks SET goal_id = (SELECT goal_id FROM recurrences r WHERE r.id = tasks.recurrence_id)
          WHERE recurrence_id IS NOT NULL AND goal_id IS NULL`,
    params: [],
  };
  return [backfill, ...inserts];
}

export async function generateInstances(date: string) {
  await (await db()).batch(await instanceStmts(date));
}

export async function createHabit(input: z.infer<typeof HabitInput>): Promise<Habit> {
  const today = await getToday();
  const { lastId } = await (await db()).run(
    "INSERT INTO recurrences (title, area_id, goal_id, rule, estimate_min, active, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [input.title, input.area_id, input.goal_id, JSON.stringify(input.rule), input.estimate_min, input.active, today],
  );
  await generateInstances(today);
  return getHabit(lastId);
}

export async function updateHabit(id: number, patch: z.infer<typeof HabitPatch>): Promise<Habit> {
  const before = await getHabit(id);
  const today = await getToday();
  const values = sqlValues({ ...patch, rule: patch.rule ? JSON.stringify(patch.rule) : undefined });
  const set = setClause(values, ["title", "area_id", "goal_id", "rule", "estimate_min", "active"]);

  // Keep today's open instance in sync with the habit, in the same transaction.
  const h: Habit = { ...before, ...patch } as Habit;
  const scheduled = h.active && isScheduledOn(h.rule, today, h.start_date);
  const stmts: Stmt[] = [];
  if (set) stmts.push({ sql: `UPDATE recurrences SET ${set} WHERE id = @id`, params: { ...values, id } });
  stmts.push(
    scheduled
      ? {
          sql: "UPDATE tasks SET title = ?, area_id = ?, goal_id = ?, estimate_min = ? WHERE recurrence_id = ? AND scheduled_date >= ? AND status = 'todo'",
          params: [h.title, h.area_id, h.goal_id, h.estimate_min, id, today],
        }
      : { sql: "DELETE FROM tasks WHERE recurrence_id = ? AND scheduled_date >= ? AND status = 'todo'", params: [id, today] },
  );
  await (await db()).batch(stmts);
  await generateInstances(today);
  return getHabit(id);
}

export async function deleteHabit(id: number) {
  await getHabit(id);
  await (await db()).run("DELETE FROM recurrences WHERE id = ?", [id]);
}

/** Past instances of flexible weekly habits aren't "missed", they were just optional days. */
export function expireFlexibleStmt(before: string): Stmt {
  return {
    sql: `UPDATE tasks SET status = 'skipped' WHERE status = 'todo' AND scheduled_date < ? AND recurrence_id IN
          (SELECT id FROM recurrences WHERE json_extract(rule, '$.type') = 'weekly')`,
    params: [before],
  };
}
