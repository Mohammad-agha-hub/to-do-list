import type { z } from "zod";
import { bools, db } from "./db";
import { notFound, setClause, sqlValues } from "./http";
import { today as getToday } from "./settings";
import { listTasks } from "./tasks";
import { dateRange } from "@/lib/shared/dates";
import { goalAmounts, goalPace, progressRatio } from "@/lib/shared/metrics";
import type { GoalInput, GoalPatch, MilestoneInput, MilestonePatch, ProgressLogInput } from "@/lib/shared/schemas";
import type { Goal, GoalDetail, GoalSummary, Milestone, ProgressLog } from "@/lib/shared/types";

const GOAL_COLUMNS = [
  "area_id",
  "title",
  "description",
  "type",
  "target_value",
  "current_value",
  "unit",
  "start_date",
  "deadline",
  "status",
] as const;

export async function getGoal(id: number): Promise<Goal> {
  const row = await (await db()).get<Goal>("SELECT * FROM goals WHERE id = ?", [id]);
  if (!row) throw notFound("Goal not found");
  return row;
}

export async function listGoalRows(): Promise<Goal[]> {
  return (await db()).all<Goal>(
    `SELECT * FROM goals ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
     deadline IS NULL, deadline, id`,
  );
}

async function linkedCounts(): Promise<Map<number, { done: number; total: number }>> {
  const rows = await (await db()).all<{ goal_id: number; done: number; total: number }>(
    `SELECT goal_id, SUM(status = 'done') AS done, COUNT(*) AS total
     FROM tasks WHERE goal_id IS NOT NULL AND status != 'skipped' GROUP BY goal_id`,
  );
  return new Map(rows.map((r) => [r.goal_id, { done: r.done, total: r.total }]));
}

export function summarize(goal: Goal, linked: { done: number; total: number }, today: string): GoalSummary {
  const { done, total } = goalAmounts(goal, linked);
  return { ...goal, done, total, progress: progressRatio(done, total), pace: goalPace(goal, done, total, today) };
}

export async function listGoals(today?: string): Promise<GoalSummary[]> {
  const [day, counts, rows] = await Promise.all([today ?? getToday(), linkedCounts(), listGoalRows()]);
  return rows.map((g) => summarize(g, counts.get(g.id) ?? { done: 0, total: 0 }, day));
}

export async function goalDetail(id: number): Promise<GoalDetail> {
  const [today, goal, tasks, milestones, logs] = await Promise.all([
    getToday(),
    getGoal(id),
    listTasks("goal_id = @id", { id }, "status = 'done', status = 'skipped', scheduled_date IS NULL, scheduled_date, priority, sort_order"),
    listMilestones(id),
    (await db()).all<ProgressLog>("SELECT id, goal_id, date, delta, note FROM progress_logs WHERE goal_id = ? ORDER BY date DESC, id DESC", [id]),
  ]);
  const linked = tasks.filter((t) => t.status !== "skipped");
  const summary = summarize(goal, { done: linked.filter((t) => t.status === "done").length, total: linked.length }, today);

  // Progress over time, as cumulative units per day.
  const events = new Map<string, number>();
  let base = 0;
  if (goal.type === "task_based") {
    for (const t of linked) if (t.completed_date) events.set(t.completed_date, (events.get(t.completed_date) ?? 0) + 1);
  } else {
    base = goal.current_value - logs.reduce((s, l) => s + l.delta, 0);
    for (const l of logs) events.set(l.date, (events.get(l.date) ?? 0) + l.delta);
  }
  const firstEvent = [...events.keys()].sort()[0];
  const from = [goal.start_date, firstEvent].filter(Boolean).sort()[0] as string;
  const to = today < from ? from : today;
  let value = base;
  const chart = dateRange(from, to).map((date) => {
    value += events.get(date) ?? 0;
    return { date, value: Math.round(value * 100) / 100 };
  });

  return { ...summary, milestones, tasks, logs, chart };
}

export async function createGoal(input: z.infer<typeof GoalInput>): Promise<Goal> {
  const values = sqlValues(input);
  const cols = Object.keys(values);
  const { lastId } = await (await db()).run(`INSERT INTO goals (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`, values);
  return getGoal(lastId);
}

export async function updateGoal(id: number, patch: z.infer<typeof GoalPatch>): Promise<Goal> {
  await getGoal(id);
  const values = sqlValues(patch);
  const set = setClause(values, GOAL_COLUMNS);
  if (set) await (await db()).run(`UPDATE goals SET ${set} WHERE id = @id`, { ...values, id });
  return getGoal(id);
}

export async function deleteGoal(id: number) {
  await getGoal(id);
  await (await db()).run("DELETE FROM goals WHERE id = ?", [id]);
}

// ---------- Milestones ----------

export async function listMilestones(goalId: number): Promise<Milestone[]> {
  const rows = await (await db()).all<Milestone>("SELECT * FROM milestones WHERE goal_id = ? ORDER BY sort_order, due_date IS NULL, due_date, id", [goalId]);
  return rows.map((r) => bools(r, ["done"]));
}

async function getMilestone(id: number): Promise<Milestone> {
  const row = await (await db()).get<Milestone>("SELECT * FROM milestones WHERE id = ?", [id]);
  if (!row) throw notFound("Milestone not found");
  return bools(row, ["done"]);
}

export async function createMilestone(goalId: number, input: z.infer<typeof MilestoneInput>): Promise<Milestone> {
  await getGoal(goalId);
  const values = sqlValues({ ...input, goal_id: goalId });
  if (!input.sort_order) {
    const row = await (await db()).get<{ n: number }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM milestones WHERE goal_id = ?", [goalId]);
    values.sort_order = row?.n ?? 1;
  }
  const cols = Object.keys(values);
  const { lastId } = await (await db()).run(`INSERT INTO milestones (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`, values);
  return getMilestone(lastId);
}

export async function updateMilestone(id: number, patch: z.infer<typeof MilestonePatch>): Promise<Milestone> {
  await getMilestone(id);
  const values = sqlValues(patch);
  const set = setClause(values, ["title", "due_date", "done", "sort_order"]);
  if (set) await (await db()).run(`UPDATE milestones SET ${set} WHERE id = @id`, { ...values, id });
  return getMilestone(id);
}

export async function deleteMilestone(id: number) {
  await getMilestone(id);
  await (await db()).run("DELETE FROM milestones WHERE id = ?", [id]);
}

// ---------- Numeric progress logs ----------

export async function addProgressLog(goalId: number, input: z.infer<typeof ProgressLogInput>): Promise<ProgressLog> {
  await getGoal(goalId);
  const date = input.date ?? (await getToday());
  const [inserted] = await (await db()).batch([
    { sql: "INSERT INTO progress_logs (goal_id, date, delta, note) VALUES (?, ?, ?, ?)", params: [goalId, date, input.delta, input.note] },
    { sql: "UPDATE goals SET current_value = current_value + ? WHERE id = ?", params: [input.delta, goalId] },
  ]);
  return { id: inserted.lastId, goal_id: goalId, date, delta: input.delta, note: input.note };
}

export async function deleteProgressLog(id: number) {
  const log = await (await db()).get<ProgressLog>("SELECT * FROM progress_logs WHERE id = ?", [id]);
  if (!log) throw notFound("Log not found");
  await (await db()).batch([
    { sql: "DELETE FROM progress_logs WHERE id = ?", params: [id] },
    { sql: "UPDATE goals SET current_value = current_value - ? WHERE id = ?", params: [log.delta, log.goal_id] },
  ]);
}
