import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momentum-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

// Imported after DATABASE_PATH is set so the singleton opens the temp DB.
const { db } = await import("./db");
const { ensureDay, todayData } = await import("./day");
const { createTask, updateTask, getTask } = await import("./tasks");
const { createHabit, listHabits } = await import("./habits");

/** 10:00 Karachi time on a given date. */
const at = (date: string) => new Date(`${date}T05:00:00Z`);

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterAll(() => {
  vi.useRealTimers();
  db().close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("rollover", () => {
  it("carries unfinished tasks to today and counts the carries", () => {
    vi.setSystemTime(at("2026-10-19"));
    ensureDay();
    const open = createTask({ title: "Write report", notes: "", area_id: null, goal_id: null, milestone_id: null, priority: 2, estimate_min: 30, due_date: null, scheduled_date: "2026-10-19", is_top3: true });
    const finished = createTask({ title: "Done thing", notes: "", area_id: null, goal_id: null, milestone_id: null, priority: 2, estimate_min: null, due_date: null, scheduled_date: "2026-10-19", is_top3: false });
    updateTask(finished.id, { status: "done" });

    vi.setSystemTime(at("2026-10-20"));
    expect(ensureDay()).toBe("2026-10-20");
    const moved = getTask(open.id);
    expect(moved.scheduled_date).toBe("2026-10-20");
    expect(moved.carried_over_count).toBe(1);
    expect(moved.is_top3).toBe(false); // Top 3 is per day
    expect(getTask(finished.id).scheduled_date).toBe("2026-10-19");

    // Skipping two days still counts as one carry per rollover run.
    vi.setSystemTime(at("2026-10-22"));
    ensureDay();
    expect(getTask(open.id)).toMatchObject({ scheduled_date: "2026-10-22", carried_over_count: 2 });
    expect(todayData().tasks.map((t) => t.id)).toContain(open.id);
  });

  it("only runs once per day", () => {
    ensureDay();
    ensureDay();
    const { n } = db().prepare("SELECT COUNT(*) AS n FROM carry_log").get() as { n: number };
    expect(n).toBe(2);
  });

  it("respects the day-start hour", () => {
    // 01:30 Karachi on the 23rd is still the 22nd with the default 4am day start.
    vi.setSystemTime(new Date("2026-10-22T20:30:00Z"));
    expect(ensureDay()).toBe("2026-10-22");
  });

  it("creates habit instances and doesn't carry missed ones", () => {
    vi.setSystemTime(at("2026-10-22"));
    const habit = createHabit({ title: "Stretch", area_id: null, goal_id: null, rule: { type: "daily" }, estimate_min: 10, active: true });
    const instance = () =>
      db().prepare("SELECT * FROM tasks WHERE recurrence_id = ? ORDER BY scheduled_date").all(habit.id) as { scheduled_date: string; status: string }[];
    expect(instance().map((t) => t.scheduled_date)).toEqual(["2026-10-22"]);

    vi.setSystemTime(at("2026-10-23"));
    ensureDay();
    // Yesterday's missed instance stays on its day (it's a miss, not a carry); today's is new.
    expect(instance().map((t) => [t.scheduled_date, t.status])).toEqual([
      ["2026-10-22", "todo"],
      ["2026-10-23", "todo"],
    ]);
    const h = listHabits("2026-10-23").find((x) => x.id === habit.id)!;
    expect(h.current).toBe(0);
    expect(h.strip.slice(-2).map((s) => s.status)).toEqual(["missed", "pending"]);
  });
});
