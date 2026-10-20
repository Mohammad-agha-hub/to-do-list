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

export async function getTask(id: number): Promise<Task> {
  const row = await (await db()).get("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!row) throw notFound("Task not found");
  return toTask(row);
}

export async function listTasks(where: string, params: Record<string, unknown> = {}, order = "priority, sort_order, id"): Promise<Task[]> {
  return (await (await db()).all(`SELECT * FROM tasks WHERE ${where} ORDER BY ${order}`, params)).map(toTask);
}

async function nextSortOrder(date: string | null): Promise<number> {
  const row = await (await db()).get<{ n: number }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM tasks WHERE scheduled_date IS ?", [date]);
  return row?.n ?? 1;
}

export async function createTask(input: z.infer<typeof TaskInput>): Promise<Task> {
  if (input.milestone_id && !input.goal_id) {
    const m = await (await db()).get<{ goal_id: number }>("SELECT goal_id FROM milestones WHERE id = ?", [input.milestone_id]);
    if (!m) throw new HttpError(400, "Unknown milestone");
    input.goal_id = m.goal_id;
  }
  const values = sqlValues({ ...input, sort_order: await nextSortOrder(input.scheduled_date) });
  const cols = Object.keys(values);
  const { lastId } = await (await db()).run(`INSERT INTO tasks (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`, values);
  const task = await getTask(lastId);
  if (task.is_top3) await refreshTop3(task.scheduled_date);
  return task;
}

export async function updateTask(id: number, patch: z.infer<typeof TaskPatch>): Promise<Task> {
  const before = await getTask(id);
  const values: Record<string, unknown> = sqlValues(patch);
  let set = setClause(values, TASK_COLUMNS);

  if (patch.status && patch.status !== before.status) {
    if (patch.status === "done") {
      values.completed_at = new Date().toISOString();
      values.completed_date = await getToday();
    } else {
      values.completed_at = null;
      values.completed_date = null;
    }
    set = [set, "completed_at = @completed_at", "completed_date = @completed_date"].filter(Boolean).join(", ");
  }
  // Top 3 is per day, so rescheduling drops the flag unless the patch sets it.
  if (patch.scheduled_date !== undefined && patch.scheduled_date !== before.scheduled_date && patch.is_top3 === undefined) {
    values.is_top3 = 0;
    set = [set, "is_top3 = @is_top3"].filter(Boolean).join(", ");
  }
  if (!set) return before;

  await (await db()).run(`UPDATE tasks SET ${set} WHERE id = @id`, { ...values, id });
  const after = await getTask(id);
  if (before.is_top3 || after.is_top3) {
    await refreshTop3(before.scheduled_date);
    if (after.scheduled_date !== before.scheduled_date) await refreshTop3(after.scheduled_date);
  }
  return after;
}

export async function deleteTask(id: number) {
  const t = await getTask(id);
  await (await db()).run("DELETE FROM tasks WHERE id = ?", [id]);
  if (t.is_top3) await refreshTop3(t.scheduled_date);
}

export async function reorderTasks(ids: number[]) {
  await (await db()).batch(ids.map((id, i) => ({ sql: "UPDATE tasks SET sort_order = ? WHERE id = ?", params: [i + 1, id] })));
}

/** Keeps day_logs.top3_* in sync with the Top 3 tasks of a day. */
export async function refreshTop3(date: string | null) {
  if (!date) return;
  await (await db()).run(
    `INSERT INTO day_logs (date, top3_done, top3_count)
     SELECT @date, COUNT(*) > 0 AND SUM(status = 'done') = COUNT(*), COUNT(*)
     FROM tasks WHERE is_top3 = 1 AND scheduled_date = @date AND status != 'skipped'
     ON CONFLICT(date) DO UPDATE SET top3_done = excluded.top3_done, top3_count = excluded.top3_count`,
    { date },
  );
}
