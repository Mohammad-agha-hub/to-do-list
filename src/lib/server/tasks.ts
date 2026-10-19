import { bools, db } from "./db";
import { HttpError, notFound, setClause, sqlValues } from "./http";
import { today as getToday } from "./settings";
import type { Task } from "@/lib/shared/types";
import type { TaskInput, TaskPatch } from "@/lib/shared/schemas";
import type { z } from "zod";

export const TASK_COLUMNS = [
  "title",
  "notes",
  "area_id",
  "goal_id",
  "milestone_id",
  "priority",
  "estimate_min",
  "actual_min",
  "due_date",
  "scheduled_date",
  "status",
  "is_top3",
  "sort_order",
] as const;

export function toTask(row: unknown): Task {
  return bools(row as Task, ["is_top3"]);
}

export function getTask(id: number): Task {
  const row = db().prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!row) throw notFound("Task not found");
  return toTask(row);
}

export function listTasks(where: string, params: Record<string, unknown> = {}, order = "priority, sort_order, id"): Task[] {
  return db().prepare(`SELECT * FROM tasks WHERE ${where} ORDER BY ${order}`).all(params).map(toTask);
}

function nextSortOrder(date: string | null): number {
  const row = db()
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM tasks WHERE scheduled_date IS ?")
    .get(date) as { n: number };
  return row.n;
}

export function createTask(input: z.infer<typeof TaskInput>): Task {
  if (input.milestone_id && !input.goal_id) {
    const m = db().prepare("SELECT goal_id FROM milestones WHERE id = ?").get(input.milestone_id) as { goal_id: number } | undefined;
    if (!m) throw new HttpError(400, "Unknown milestone");
    input.goal_id = m.goal_id;
  }
  const values = sqlValues({ ...input, sort_order: nextSortOrder(input.scheduled_date) });
  const cols = Object.keys(values);
  const info = db()
    .prepare(`INSERT INTO tasks (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`)
    .run(values);
  const task = getTask(Number(info.lastInsertRowid));
  if (task.is_top3) refreshTop3(task.scheduled_date);
  return task;
}

export function updateTask(id: number, patch: z.infer<typeof TaskPatch>): Task {
  const before = getTask(id);
  const values: Record<string, unknown> = sqlValues(patch);
  let set = setClause(values, TASK_COLUMNS);

  if (patch.status && patch.status !== before.status) {
    if (patch.status === "done") {
      values.completed_at = new Date().toISOString();
      values.completed_date = getToday();
    } else {
      values.completed_at = null;
      values.completed_date = null;
    }
    set = [set, "completed_at = @completed_at", "completed_date = @completed_date"].filter(Boolean).join(", ");
  }
  // Top 3 is per day, so rescheduling drops the flag unless the patch sets it.
  if (patch.scheduled_date !== undefined && patch.scheduled_date !== before.scheduled_date && patch.is_top3 === undefined) {
    values.is_top3 = 0;
    if (!set.includes("is_top3")) set += ", is_top3 = @is_top3";
  }
  if (!set) return before;

  db().prepare(`UPDATE tasks SET ${set} WHERE id = @id`).run({ ...values, id });
  const after = getTask(id);
  if (before.is_top3 || after.is_top3) {
    refreshTop3(before.scheduled_date);
    if (after.scheduled_date !== before.scheduled_date) refreshTop3(after.scheduled_date);
  }
  return after;
}

export function deleteTask(id: number) {
  const t = getTask(id);
  db().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  if (t.is_top3) refreshTop3(t.scheduled_date);
}

export function reorderTasks(ids: number[]) {
  const stmt = db().prepare("UPDATE tasks SET sort_order = ? WHERE id = ?");
  db().transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

/** Keeps day_logs.top3_* in sync with the Top 3 tasks of a day. */
export function refreshTop3(date: string | null) {
  if (!date) return;
  const row = db()
    .prepare(
      "SELECT COUNT(*) AS n, SUM(status = 'done') AS done FROM tasks WHERE is_top3 = 1 AND scheduled_date = ? AND status != 'skipped'",
    )
    .get(date) as { n: number; done: number | null };
  const won = row.n > 0 && row.done === row.n ? 1 : 0;
  db()
    .prepare(
      `INSERT INTO day_logs (date, top3_done, top3_count) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET top3_done = excluded.top3_done, top3_count = excluded.top3_count`,
    )
    .run(date, won, row.n);
}
