import type { z } from "zod";
import { db } from "./db";
import { notFound, setClause, sqlValues } from "./http";
import { today as getToday } from "./settings";
import { computeStreaks, habitStrip, isScheduledOn, weekDoneCount } from "@/lib/shared/metrics";
import type { HabitInput, HabitPatch, RecurrenceRule } from "@/lib/shared/schemas";
import type { Habit, HabitSummary } from "@/lib/shared/types";

type HabitRow = Omit<Habit, "rule" | "active"> & { rule: string; active: number };

function toHabit(row: HabitRow): Habit {
  return { ...row, rule: JSON.parse(row.rule) as RecurrenceRule, active: Boolean(row.active) };
}

export function getHabit(id: number): Habit {
  const row = db().prepare("SELECT id, title, area_id, goal_id, rule, estimate_min, active, start_date FROM recurrences WHERE id = ?").get(id) as HabitRow | undefined;
  if (!row) throw notFound("Habit not found");
  return toHabit(row);
}

export function listHabitRows(): Habit[] {
  return (
    db().prepare("SELECT id, title, area_id, goal_id, rule, estimate_min, active, start_date FROM recurrences ORDER BY active DESC, id").all() as HabitRow[]
  ).map(toHabit);
}

/** Dates (by scheduled day) each habit was completed. */
export function habitDoneDates(): Map<number, Set<string>> {
  const rows = db()
    .prepare("SELECT recurrence_id, scheduled_date FROM tasks WHERE recurrence_id IS NOT NULL AND status = 'done'")
    .all() as { recurrence_id: number; scheduled_date: string }[];
  const map = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.recurrence_id)) map.set(r.recurrence_id, new Set());
    map.get(r.recurrence_id)!.add(r.scheduled_date);
  }
  return map;
}

export function listHabits(today = getToday()): HabitSummary[] {
  const done = habitDoneDates();
  const todays = new Map(
    (
      db().prepare("SELECT id, recurrence_id, status FROM tasks WHERE recurrence_id IS NOT NULL AND scheduled_date = ?").all(today) as {
        id: number;
        recurrence_id: number;
        status: string;
      }[]
    ).map((r) => [r.recurrence_id, r]),
  );
  return listHabitRows().map((h) => {
    const dates = done.get(h.id) ?? new Set<string>();
    const streak = computeStreaks(h.rule, h.start_date, today, dates);
    const t = todays.get(h.id);
    return {
      ...h,
      ...streak,
      strip: habitStrip(h.rule, h.start_date, today, dates),
      todayTaskId: t?.id ?? null,
      todayDone: t?.status === "done",
      weekDone: weekDoneCount(today, dates),
    };
  });
}

/** Creates today's task instances for active habits. Safe to call repeatedly. */
export function generateInstances(date: string) {
  const insert = db().prepare(
    `INSERT OR IGNORE INTO tasks (title, area_id, estimate_min, scheduled_date, recurrence_id, priority, sort_order)
     VALUES (?, ?, ?, ?, ?, 2, 0)`,
  );
  const done = habitDoneDates();
  for (const h of listHabitRows()) {
    if (!h.active || !isScheduledOn(h.rule, date, h.start_date)) continue;
    if (h.rule.type === "weekly" && weekDoneCount(date, done.get(h.id) ?? new Set()) >= h.rule.count) continue;
    insert.run(h.title, h.area_id, h.estimate_min, date, h.id);
  }
}

export function createHabit(input: z.infer<typeof HabitInput>): Habit {
  const today = getToday();
  const info = db()
    .prepare(
      "INSERT INTO recurrences (title, area_id, goal_id, rule, estimate_min, active, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(input.title, input.area_id, input.goal_id, JSON.stringify(input.rule), input.estimate_min, input.active ? 1 : 0, today);
  generateInstances(today);
  return getHabit(Number(info.lastInsertRowid));
}

export function updateHabit(id: number, patch: z.infer<typeof HabitPatch>): Habit {
  getHabit(id);
  const values = sqlValues({ ...patch, rule: patch.rule ? JSON.stringify(patch.rule) : undefined });
  const set = setClause(values, ["title", "area_id", "goal_id", "rule", "estimate_min", "active"]);
  const today = getToday();
  db().transaction(() => {
    if (set) db().prepare(`UPDATE recurrences SET ${set} WHERE id = @id`).run({ ...values, id });
    // Keep today's open instance in sync with the habit.
    const h = getHabit(id);
    const scheduled = h.active && isScheduledOn(h.rule, today, h.start_date);
    if (!scheduled) {
      db().prepare("DELETE FROM tasks WHERE recurrence_id = ? AND scheduled_date >= ? AND status = 'todo'").run(id, today);
    } else {
      db()
        .prepare("UPDATE tasks SET title = ?, area_id = ?, estimate_min = ? WHERE recurrence_id = ? AND scheduled_date >= ? AND status = 'todo'")
        .run(h.title, h.area_id, h.estimate_min, id, today);
    }
  })();
  generateInstances(today);
  return getHabit(id);
}

export function deleteHabit(id: number) {
  getHabit(id);
  db().prepare("DELETE FROM recurrences WHERE id = ?").run(id);
}

/** Past instances of flexible weekly habits aren't "missed", they were just optional days. */
export function expireFlexibleInstances(before: string) {
  db()
    .prepare(
      `UPDATE tasks SET status = 'skipped' WHERE status = 'todo' AND scheduled_date < ? AND recurrence_id IN
       (SELECT id FROM recurrences WHERE json_extract(rule, '$.type') = 'weekly')`,
    )
    .run(before);
}
