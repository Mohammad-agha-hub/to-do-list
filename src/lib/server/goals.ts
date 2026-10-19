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

export function getGoal(id: number): Goal {
  const row = db().prepare("SELECT * FROM goals WHERE id = ?").get(id) as Goal | undefined;
  if (!row) throw notFound("Goal not found");
  return row;
}

export function listGoalRows(): Goal[] {
  return db()
    .prepare(
      `SELECT * FROM goals ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
       deadline IS NULL, deadline, id`,
    )
    .all() as Goal[];
}

function linkedCounts(): Map<number, { done: number; total: number }> {
  const rows = db()
    .prepare(
      `SELECT goal_id, SUM(status = 'done') AS done, COUNT(*) AS total
       FROM tasks WHERE goal_id IS NOT NULL AND status != 'skipped' GROUP BY goal_id`,
    )
    .all() as { goal_id: number; done: number; total: number }[];
  return new Map(rows.map((r) => [r.goal_id, { done: r.done, total: r.total }]));
}

export function summarize(goal: Goal, linked: { done: number; total: number }, today: string): GoalSummary {
  const { done, total } = goalAmounts(goal, linked);
  return { ...goal, done, total, progress: progressRatio(done, total), pace: goalPace(goal, done, total, today) };
}

export function listGoals(today = getToday()): GoalSummary[] {
  const counts = linkedCounts();
  return listGoalRows().map((g) => summarize(g, counts.get(g.id) ?? { done: 0, total: 0 }, today));
}

export function goalDetail(id: number): GoalDetail {
  const today = getToday();
  const goal = getGoal(id);
  const tasks = listTasks("goal_id = @id", { id }, "status = 'done', status = 'skipped', scheduled_date IS NULL, scheduled_date, priority, sort_order");
  const linked = tasks.filter((t) => t.status !== "skipped");
  const summary = summarize(goal, { done: linked.filter((t) => t.status === "done").length, total: linked.length }, today);
  const milestones = listMilestones(id);
  const logs = db().prepare("SELECT id, goal_id, date, delta, note FROM progress_logs WHERE goal_id = ? ORDER BY date DESC, id DESC").all(id) as ProgressLog[];

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

export function createGoal(input: z.infer<typeof GoalInput>): Goal {
  const values = sqlValues(input);
  const cols = Object.keys(values);
  const info = db()
    .prepare(`INSERT INTO goals (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`)
    .run(values);
  return getGoal(Number(info.lastInsertRowid));
}

export function updateGoal(id: number, patch: z.infer<typeof GoalPatch>): Goal {
  getGoal(id);
  const values = sqlValues(patch);
  const set = setClause(values, GOAL_COLUMNS);
  if (set) db().prepare(`UPDATE goals SET ${set} WHERE id = @id`).run({ ...values, id });
  return getGoal(id);
}

export function deleteGoal(id: number) {
  getGoal(id);
  db().prepare("DELETE FROM goals WHERE id = ?").run(id);
}

// ---------- Milestones ----------

export function listMilestones(goalId: number): Milestone[] {
  return db()
    .prepare("SELECT * FROM milestones WHERE goal_id = ? ORDER BY sort_order, due_date IS NULL, due_date, id")
    .all(goalId)
    .map((r) => bools(r as Milestone, ["done"]));
}

function getMilestone(id: number): Milestone {
  const row = db().prepare("SELECT * FROM milestones WHERE id = ?").get(id);
  if (!row) throw notFound("Milestone not found");
  return bools(row as Milestone, ["done"]);
}

export function createMilestone(goalId: number, input: z.infer<typeof MilestoneInput>): Milestone {
  getGoal(goalId);
  const values = sqlValues({ ...input, goal_id: goalId });
  if (!input.sort_order) {
    const { n } = db().prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM milestones WHERE goal_id = ?").get(goalId) as { n: number };
    values.sort_order = n;
  }
  const cols = Object.keys(values);
  const info = db()
    .prepare(`INSERT INTO milestones (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`)
    .run(values);
  return getMilestone(Number(info.lastInsertRowid));
}

export function updateMilestone(id: number, patch: z.infer<typeof MilestonePatch>): Milestone {
  getMilestone(id);
  const values = sqlValues(patch);
  const set = setClause(values, ["title", "due_date", "done", "sort_order"]);
  if (set) db().prepare(`UPDATE milestones SET ${set} WHERE id = @id`).run({ ...values, id });
  return getMilestone(id);
}

export function deleteMilestone(id: number) {
  getMilestone(id);
  db().prepare("DELETE FROM milestones WHERE id = ?").run(id);
}

// ---------- Numeric progress logs ----------

export function addProgressLog(goalId: number, input: z.infer<typeof ProgressLogInput>): ProgressLog {
  getGoal(goalId);
  const date = input.date ?? getToday();
  const tx = db().transaction(() => {
    const info = db()
      .prepare("INSERT INTO progress_logs (goal_id, date, delta, note) VALUES (?, ?, ?, ?)")
      .run(goalId, date, input.delta, input.note);
    db().prepare("UPDATE goals SET current_value = current_value + ? WHERE id = ?").run(input.delta, goalId);
    return Number(info.lastInsertRowid);
  });
  const id = tx();
  return { id, goal_id: goalId, date, delta: input.delta, note: input.note };
}

export function deleteProgressLog(id: number) {
  const log = db().prepare("SELECT * FROM progress_logs WHERE id = ?").get(id) as ProgressLog | undefined;
  if (!log) throw notFound("Log not found");
  db().transaction(() => {
    db().prepare("DELETE FROM progress_logs WHERE id = ?").run(id);
    db().prepare("UPDATE goals SET current_value = current_value - ? WHERE id = ?").run(log.delta, log.goal_id);
  })();
}
