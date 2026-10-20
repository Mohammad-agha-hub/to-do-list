import type { z } from "zod";
import { db } from "./db";
import { ensureDay } from "./day";
import { listGoals } from "./goals";
import { setMetaStmt } from "./settings";
import { listTasks } from "./tasks";
import { addDays, weekStart } from "@/lib/shared/dates";
import type { WeeklyReviewInput } from "@/lib/shared/schemas";
import type { ReviewData, WeeklyReview } from "@/lib/shared/types";

export async function getReview(week: string): Promise<WeeklyReview | null> {
  return (await (await db()).get<WeeklyReview>("SELECT * FROM weekly_reviews WHERE week_start = ?", [week])) ?? null;
}

export async function reviewData(week: string): Promise<ReviewData> {
  const today = await ensureDay();
  const weekEnd = addDays(week, 6);
  const nextStart = addDays(week, 7);
  const conn = await db();
  const [review, completedByArea, slipped, goals, backlog, nextWeek] = await Promise.all([
    getReview(week),
    conn.all<ReviewData["completedByArea"][number]>(
      `SELECT area_id, COUNT(*) AS count FROM tasks
       WHERE status = 'done' AND completed_date BETWEEN ? AND ? GROUP BY area_id ORDER BY count DESC`,
      [week, weekEnd],
    ),
    conn.all<ReviewData["slipped"][number]>(
      `SELECT c.task_id, t.title, t.area_id, COUNT(*) AS carries, t.status FROM carry_log c
       JOIN tasks t ON t.id = c.task_id WHERE c.from_date BETWEEN ? AND ?
       GROUP BY c.task_id ORDER BY carries DESC, t.priority LIMIT 30`,
      [week, weekEnd],
    ),
    listGoals(today),
    listTasks("scheduled_date IS NULL AND status = 'todo'"),
    listTasks(
      "scheduled_date BETWEEN @from AND @to AND status = 'todo' AND recurrence_id IS NULL",
      { from: nextStart < today ? today : nextStart, to: addDays(nextStart, 6) },
      "scheduled_date, priority, sort_order",
    ),
  ]);

  return {
    weekStart: week,
    weekEnd,
    review,
    completedByArea,
    completedTotal: completedByArea.reduce((s, r) => s + r.count, 0),
    slipped,
    goalsBehind: goals.filter((g) => g.status === "active" && (g.pace.status === "behind" || g.pace.status === "at_risk")),
    backlog,
    nextWeek,
  };
}

export async function saveReview(week: string, input: z.infer<typeof WeeklyReviewInput>, complete: boolean): Promise<WeeklyReview> {
  await (await db()).batch([
    {
      sql: `INSERT INTO weekly_reviews (week_start, wins, slipped, notes, next_week_focus, completed_at)
            VALUES (@week_start, @wins, @slipped, @notes, @next_week_focus, @completed_at)
            ON CONFLICT(week_start) DO UPDATE SET wins = excluded.wins, slipped = excluded.slipped, notes = excluded.notes,
              next_week_focus = excluded.next_week_focus, completed_at = COALESCE(excluded.completed_at, weekly_reviews.completed_at)`,
      params: { ...input, week_start: week, completed_at: complete ? new Date().toISOString() : null },
    },
    ...(complete ? [setMetaStmt(`review_dismissed:${week}`, "1")] : []),
  ]);
  return (await getReview(week))!;
}

/** The focus set in last week's review applies to this week. */
export async function thisWeekFocus(today: string): Promise<string | null> {
  const row = await (await db()).get<{ next_week_focus: string }>(
    "SELECT next_week_focus FROM weekly_reviews WHERE week_start = ? AND next_week_focus != ''",
    [addDays(weekStart(today), -7)],
  );
  return row?.next_week_focus ?? null;
}
