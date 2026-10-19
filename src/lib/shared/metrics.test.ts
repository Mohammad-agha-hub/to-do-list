import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "./dates";
import { computeStreaks, goalPace, habitStrip, isScheduledOn } from "./metrics";

const today = "2026-10-19"; // Monday
const set = (...dates: string[]) => new Set(dates);
const daysBack = (n: number) => addDays(today, -n);

describe("isScheduledOn", () => {
  it("handles each rule type", () => {
    expect(isScheduledOn({ type: "daily" }, today, "2026-10-01")).toBe(true);
    expect(isScheduledOn({ type: "weekdays", days: [1, 3] }, today, "2026-10-01")).toBe(true);
    expect(isScheduledOn({ type: "weekdays", days: [2] }, today, "2026-10-01")).toBe(false);
    expect(isScheduledOn({ type: "interval", every: 3 }, "2026-10-07", "2026-10-01")).toBe(true);
    expect(isScheduledOn({ type: "interval", every: 3 }, "2026-10-08", "2026-10-01")).toBe(false);
    expect(isScheduledOn({ type: "daily" }, "2026-09-30", "2026-10-01")).toBe(false);
  });
});

describe("computeStreaks", () => {
  it("counts consecutive done days and ignores today being unfinished", () => {
    const done = set(daysBack(1), daysBack(2), daysBack(3), daysBack(5));
    expect(computeStreaks({ type: "daily" }, daysBack(10), today, done)).toEqual({ current: 3, best: 3, unit: "days" });
  });

  it("includes today once it's done", () => {
    const done = set(today, daysBack(1));
    expect(computeStreaks({ type: "daily" }, daysBack(5), today, done).current).toBe(2);
  });

  it("missing a scheduled day breaks the streak, unscheduled days don't", () => {
    // Mon/Wed/Fri. Today is Mon 19th; Fri 16th, Wed 14th, Mon 12th done; Tue/Thu/Sat/Sun unscheduled.
    const rule = { type: "weekdays" as const, days: [1, 3, 5] };
    const done = set("2026-10-16", "2026-10-14", "2026-10-12");
    expect(computeStreaks(rule, "2026-10-12", today, done).current).toBe(3);
    // Missing Wed 14th breaks it.
    expect(computeStreaks(rule, "2026-10-12", today, set("2026-10-16", "2026-10-12")).current).toBe(1);
  });

  it("tracks the best run separately", () => {
    const done = set(daysBack(9), daysBack(8), daysBack(7), daysBack(6), daysBack(1));
    expect(computeStreaks({ type: "daily" }, daysBack(9), today, done)).toMatchObject({ current: 1, best: 4 });
  });

  it("weekly targets count weeks, and the current week can't break the streak", () => {
    const ws = weekStart(today);
    const w1 = addDays(ws, -7);
    const w2 = addDays(ws, -14);
    const done = set(w1, addDays(w1, 2), addDays(w1, 4), w2, addDays(w2, 1), addDays(w2, 3));
    expect(computeStreaks({ type: "weekly", count: 3 }, w2, today, done)).toEqual({ current: 2, best: 2, unit: "weeks" });
    expect(computeStreaks({ type: "weekly", count: 4 }, w2, today, done).current).toBe(0);
  });
});

describe("habitStrip", () => {
  it("marks done, missed, off and pending days", () => {
    const strip = habitStrip({ type: "weekdays", days: [1, 2] }, daysBack(40), today, set(daysBack(6)), 7);
    expect(strip.map((s) => s.status)).toEqual(["done", "off", "off", "off", "off", "off", "pending"]);
    // 13 Oct (Tue) done; 12 Oct (Mon) would be "missed" if it were in range.
    expect(habitStrip({ type: "daily" }, daysBack(40), today, set(), 2).map((s) => s.status)).toEqual(["missed", "pending"]);
  });
});

describe("goalPace", () => {
  const goal = { start_date: addDays(today, -27), deadline: addDays(today, 27), status: "active", unit: "", type: "task_based" } as const;

  it("is on track when actual rate >= required", () => {
    expect(goalPace(goal, 20, 30, today).status).toBe("on_track");
  });

  it("is behind when far below the required rate", () => {
    const p = goalPace(goal, 4, 30, today);
    expect(p.status).toBe("behind");
    expect(p.label).toMatch(/^Need [\d.]+\/week, doing 1\/week — behind$/);
  });

  it("is at risk in between", () => {
    // 4 weeks elapsed, 4 weeks left: 13 done of 30 → 3.25/wk vs 4.25/wk required (76%).
    expect(goalPace(goal, 13, 30, today).status).toBe("at_risk");
  });

  it("handles completion and missing deadlines", () => {
    expect(goalPace(goal, 30, 30, today).status).toBe("done");
    expect(goalPace({ ...goal, deadline: null }, 3, 30, today).status).toBe("none");
    expect(goalPace({ ...goal, deadline: addDays(today, -1) }, 3, 30, today).status).toBe("behind");
  });
});
