import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setDb } from "./db";
import { openSqlite } from "./sqlite";
import { ensureDay, todayData } from "./day";
import { createTask, getTask, updateTask } from "./tasks";
import { createHabit, listHabits } from "./habits";

const { conn, db } = openSqlite();

/** 10:00 Karachi time on a given date. */
const at = (date: string) => new Date(`${date}T05:00:00Z`);
const newTask = (title: string, date: string, extra: { is_top3?: boolean } = {}) =>
  createTask({ title, notes: "", area_id: null, goal_id: null, milestone_id: null, priority: 2, estimate_min: 30, due_date: null, scheduled_date: date, is_top3: false, ...extra });
const carries = () => (conn.prepare("SELECT COUNT(*) AS n FROM carry_log").get() as { n: number }).n;

beforeAll(() => {
  setDb(db);
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterAll(() => {
  vi.useRealTimers();
  setDb(null);
  conn.close();
});

describe("rollover", () => {
  it("carries unfinished tasks to today and counts the carries", async () => {
    vi.setSystemTime(at("2026-10-19"));
    await ensureDay();
    const open = await newTask("Write report", "2026-10-19", { is_top3: true });
    const finished = await newTask("Done thing", "2026-10-19");
    await updateTask(finished.id, { status: "done" });

    vi.setSystemTime(at("2026-10-20"));
    expect(await ensureDay()).toBe("2026-10-20");
    const moved = await getTask(open.id);
    expect(moved.scheduled_date).toBe("2026-10-20");
    expect(moved.carried_over_count).toBe(1);
    expect(moved.is_top3).toBe(false); // Top 3 is per day
    expect((await getTask(finished.id)).scheduled_date).toBe("2026-10-19");

    // Skipping two days still counts as one carry per rollover run.
    vi.setSystemTime(at("2026-10-22"));
    await ensureDay();
    expect(await getTask(open.id)).toMatchObject({ scheduled_date: "2026-10-22", carried_over_count: 2 });
    expect((await todayData()).tasks.map((t) => t.id)).toContain(open.id);
  });

  it("only runs once per day", async () => {
    await ensureDay();
    await ensureDay();
    expect(carries()).toBe(2);
  });

  it("is safe when two requests start the new day at the same time", async () => {
    const t = await newTask("Parallel", "2026-10-22");
    vi.setSystemTime(at("2026-10-23"));
    await Promise.all([ensureDay(), ensureDay(), todayData()]);
    expect(await getTask(t.id)).toMatchObject({ scheduled_date: "2026-10-23", carried_over_count: 1 });
    const logs = conn.prepare("SELECT COUNT(*) AS n FROM carry_log WHERE task_id = ?").get(t.id) as { n: number };
    expect(logs.n).toBe(1);
  });

  it("respects the day-start hour", async () => {
    // 01:30 Karachi on the 24th is still the 23rd with the default 4am day start.
    vi.setSystemTime(new Date("2026-10-23T20:30:00Z"));
    expect(await ensureDay()).toBe("2026-10-23");
  });

  it("creates habit instances and doesn't carry missed ones", async () => {
    vi.setSystemTime(at("2026-10-23"));
    const habit = await createHabit({ title: "Stretch", area_id: null, goal_id: null, rule: { type: "daily" }, estimate_min: 10, active: true });
    const instances = () =>
      conn.prepare("SELECT scheduled_date, status FROM tasks WHERE recurrence_id = ? ORDER BY scheduled_date").all(habit.id) as {
        scheduled_date: string;
        status: string;
      }[];
    expect(instances().map((t) => t.scheduled_date)).toEqual(["2026-10-23"]);

    vi.setSystemTime(at("2026-10-24"));
    await ensureDay();
    // Yesterday's missed instance stays on its day (it's a miss, not a carry); today's is new.
    expect(instances().map((t) => [t.scheduled_date, t.status])).toEqual([
      ["2026-10-23", "todo"],
      ["2026-10-24", "todo"],
    ]);
    const h = (await listHabits("2026-10-24")).find((x) => x.id === habit.id)!;
    expect(h.current).toBe(0);
    expect(h.strip.slice(-2).map((s) => s.status)).toEqual(["missed", "pending"]);
  });

  it("keeps Top 3 wins in sync", async () => {
    const a = await newTask("A", "2026-10-24", { is_top3: true });
    const b = await newTask("B", "2026-10-24", { is_top3: true });
    await updateTask(a.id, { status: "done" });
    const log = () => conn.prepare("SELECT top3_done, top3_count FROM day_logs WHERE date = '2026-10-24'").get();
    expect(log()).toEqual({ top3_done: 0, top3_count: 2 });
    await updateTask(b.id, { status: "done" });
    expect(log()).toEqual({ top3_done: 1, top3_count: 2 });
  });
});
