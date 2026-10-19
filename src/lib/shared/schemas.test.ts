import { describe, expect, it } from "vitest";
import { GoalPatch, HabitPatch, TaskInput, TaskPatch } from "./schemas";

describe("patch schemas", () => {
  it("only contain the keys that were sent", () => {
    expect(TaskPatch.parse({ is_top3: true })).toEqual({ is_top3: true });
    expect(GoalPatch.parse({ status: "paused" })).toEqual({ status: "paused" });
    expect(HabitPatch.parse({ active: false })).toEqual({ active: false });
  });

  it("still validate the values", () => {
    expect(TaskPatch.safeParse({ priority: 7 }).success).toBe(false);
    expect(TaskPatch.safeParse({ scheduled_date: "tomorrow" }).success).toBe(false);
    expect(TaskPatch.parse({ scheduled_date: null })).toEqual({ scheduled_date: null });
  });

  it("inputs keep their defaults", () => {
    expect(TaskInput.parse({ title: "x" })).toMatchObject({ priority: 2, scheduled_date: null, is_top3: false });
  });
});
