import { addDays, dateRange, diffDays, weekStart, weekday } from "./dates";
import type { RecurrenceRule } from "./schemas";
import type { DotStatus, Goal, Pace } from "./types";

// ---------- Goals ----------

/** Units of progress done and total for a goal. */
export function goalAmounts(goal: Pick<Goal, "type" | "current_value" | "target_value">, linked: { done: number; total: number }) {
  if (goal.type === "task_based") return { done: linked.done, total: linked.total };
  return { done: goal.current_value, total: goal.target_value ?? 0 };
}

export function progressRatio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Pace = required rate (remaining / weeks left) vs actual rate (done / weeks elapsed).
 * on_track: actual >= required; at_risk: actual >= 75% of required; behind otherwise.
 */
export function goalPace(
  goal: Pick<Goal, "start_date" | "deadline" | "status" | "unit" | "type">,
  done: number,
  total: number,
  today: string,
): Pace {
  const unit = goal.type === "task_based" ? "tasks" : goal.unit || "units";
  const weeksElapsed = Math.max(1, diffDays(today, goal.start_date) + 1) / 7;
  const actualPerWeek = round1(done / weeksElapsed);
  const remaining = Math.max(0, total - done);

  if (goal.status === "completed" || (total > 0 && remaining === 0)) {
    return { status: "done", requiredPerWeek: 0, actualPerWeek, daysLeft: null, label: "Goal reached" };
  }
  if (!goal.deadline || total <= 0) {
    return { status: "none", requiredPerWeek: null, actualPerWeek, daysLeft: null, label: `Doing ${actualPerWeek} ${unit}/week` };
  }
  const daysLeft = diffDays(goal.deadline, today);
  if (daysLeft < 0) {
    return { status: "behind", requiredPerWeek: null, actualPerWeek, daysLeft, label: `Deadline passed · ${round1(remaining)} ${unit} left` };
  }
  const requiredPerWeek = round1(remaining / (Math.max(1, daysLeft + 1) / 7));
  const status = actualPerWeek >= requiredPerWeek ? "on_track" : actualPerWeek >= requiredPerWeek * 0.75 ? "at_risk" : "behind";
  const verdict = status === "on_track" ? "on track" : status === "at_risk" ? "at risk" : "behind";
  return {
    status,
    requiredPerWeek,
    actualPerWeek,
    daysLeft,
    label: `Need ${requiredPerWeek}/week, doing ${actualPerWeek}/week — ${verdict}`,
  };
}

// ---------- Habits ----------

export function isScheduledOn(rule: RecurrenceRule, date: string, startDate: string): boolean {
  if (date < startDate) return false;
  switch (rule.type) {
    case "daily":
      return true;
    case "weekdays":
      return rule.days.includes(weekday(date));
    case "interval":
      return diffDays(date, startDate) % rule.every === 0;
    case "weekly":
      return true; // flexible: any day may count toward the weekly target
  }
}

export function describeRule(rule: RecurrenceRule): string {
  switch (rule.type) {
    case "daily":
      return "Every day";
    case "weekdays": {
      const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const sorted = [...rule.days].sort();
      if (sorted.join() === "1,2,3,4,5") return "Weekdays";
      if (sorted.join() === "6,7") return "Weekends";
      return sorted.map((d) => names[d - 1]).join(", ");
    }
    case "interval":
      return `Every ${rule.every} days`;
    case "weekly":
      return `${rule.count}× per week`;
  }
}

export type StreakResult = { current: number; best: number; unit: "days" | "weeks" };

/**
 * Day rules: consecutive scheduled days that were done. Missing a scheduled day breaks
 * the streak; non-scheduled days don't. Today not yet done doesn't break it.
 * Weekly rules: consecutive weeks meeting the target; the current week can't break it.
 */
export function computeStreaks(rule: RecurrenceRule, startDate: string, today: string, doneDates: Set<string>): StreakResult {
  if (rule.type === "weekly") {
    let run = 0;
    let best = 0;
    const thisWeek = weekStart(today);
    for (let w = weekStart(startDate); w <= thisWeek; w = addDays(w, 7)) {
      let count = 0;
      for (let i = 0; i < 7; i++) if (doneDates.has(addDays(w, i))) count++;
      if (count >= rule.count) {
        run++;
        best = Math.max(best, run);
      } else if (w !== thisWeek) {
        run = 0;
      }
    }
    return { current: run, best, unit: "weeks" };
  }

  let run = 0;
  let best = 0;
  if (startDate <= today) {
    for (const d of dateRange(startDate, today)) {
      if (!isScheduledOn(rule, d, startDate)) continue;
      if (doneDates.has(d)) {
        run++;
        best = Math.max(best, run);
      } else if (d !== today) {
        run = 0;
      }
    }
  }
  return { current: run, best, unit: "days" };
}

export function habitStrip(rule: RecurrenceRule, startDate: string, today: string, doneDates: Set<string>, days = 30) {
  const out: { date: string; status: DotStatus }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    let status: DotStatus;
    if (d < startDate) status = "before";
    else if (doneDates.has(d)) status = "done";
    else if (rule.type === "weekly") status = "off";
    else if (!isScheduledOn(rule, d, startDate)) status = "off";
    else status = d === today ? "pending" : "missed";
    out.push({ date: d, status });
  }
  return out;
}

export function weekDoneCount(today: string, doneDates: Set<string>): number {
  const ws = weekStart(today);
  let n = 0;
  for (let i = 0; i < 7; i++) if (doneDates.has(addDays(ws, i))) n++;
  return n;
}
