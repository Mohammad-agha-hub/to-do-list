import type { z } from "zod";
import { db } from "./db";
import { ensureDay } from "./day";
import { listGoals } from "./goals";
import { setMeta } from "./settings";
import { listTasks } from "./tasks";
import { addDays } from "@/lib/shared/dates";
import type { WeeklyReviewInput } from "@/lib/shared/schemas";
import type { ReviewData, WeeklyReview } from "@/lib/shared/types";

export function getReview(weekStart: string): WeeklyReview | null {
  return (db().prepare("SELECT * FROM weekly_reviews WHERE week_start = ?").get(weekStart) as WeeklyReview | undefined) ?? null;
}

export function reviewData(weekStart: string): ReviewData {
  const today = ensureDay();
  const weekEnd = addDays(weekStart, 6);
  const completedByArea = db()
    .prepare(
      `SELECT area_id, COUNT(*) AS count FROM tasks
       WHERE status = 'done' AND completed_date BETWEEN ? AND ? GROUP BY area_id ORDER BY count DESC`,
    )
    .all(weekStart, weekEnd) as ReviewData["completedByArea"];
  const slipped = db()
    .prepare(
      `SELECT c.task_id, t.title, t.area_id, COUNT(*) AS carries, t.status FROM carry_log c
       JOIN tasks t ON t.id = c.task_id WHERE c.from_date BETWEEN ? AND ?
       GROUP BY c.task_id ORDER BY carries DESC, t.priority LIMIT 30`,
    )
    .all(weekStart, weekEnd) as ReviewData["slipped"];
  const nextStart = addDays(weekStart, 7);

  return {
    weekStart,
    weekEnd,
    review: getReview(weekStart),
    completedByArea,
    completedTotal: completedByArea.reduce((s, r) => s + r.count, 0),
    slipped,
    goalsBehind: listGoals(today).filter((g) => g.status === "active" && (g.pace.status === "behind" || g.pace.status === "at_risk")),
    backlog: listTasks("scheduled_date IS NULL AND status = 'todo'"),
    nextWeek: listTasks(
      "scheduled_date BETWEEN @from AND @to AND status = 'todo' AND recurrence_id IS NULL",
      { from: nextStart < today ? today : nextStart, to: addDays(nextStart, 6) },
      "scheduled_date, priority, sort_order",
    ),
  };
}

export function saveReview(weekStart: string, input: z.infer<typeof WeeklyReviewInput>, complete: boolean): WeeklyReview {
  db()
    .prepare(
      `INSERT INTO weekly_reviews (week_start, wins, slipped, notes, next_week_focus, completed_at)
       VALUES (@week_start, @wins, @slipped, @notes, @next_week_focus, @completed_at)
       ON CONFLICT(week_start) DO UPDATE SET wins = excluded.wins, slipped = excluded.slipped, notes = excluded.notes,
         next_week_focus = excluded.next_week_focus, completed_at = COALESCE(excluded.completed_at, weekly_reviews.completed_at)`,
    )
    .run({ ...input, week_start: weekStart, completed_at: complete ? new Date().toISOString() : null });
  if (complete) setMeta(`review_dismissed:${weekStart}`, "1");
  return getReview(weekStart)!;
}

export function latestNextWeekFocus(today: string): { week_start: string; next_week_focus: string } | null {
  return (
    (db()
      .prepare(
        "SELECT week_start, next_week_focus FROM weekly_reviews WHERE next_week_focus != '' AND week_start < ? ORDER BY week_start DESC LIMIT 1",
      )
      .get(today) as { week_start: string; next_week_focus: string } | undefined) ?? null
  );
}
