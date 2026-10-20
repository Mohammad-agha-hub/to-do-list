import { describe, expect, it } from "vitest";
import { focusedMinutes, nextPhase, pause, remainingMs, resume, startPhase } from "./focus";

const L = { focus: 25, break: 5, longBreak: 15, cycles: 4 };
const MIN = 60_000;

describe("focus timer", () => {
  it("computes remaining time from timestamps, not ticks", () => {
    const s = startPhase(1, "focus", 0, L, 0);
    expect(remainingMs(s, 10 * MIN)).toBe(15 * MIN);
    // A locked screen for an hour just means it's finished.
    expect(remainingMs(s, 60 * MIN)).toBe(0);
  });

  it("pauses don't count as focused time", () => {
    let s = startPhase(1, "focus", 0, L, 0);
    s = pause(s, 10 * MIN);
    expect(remainingMs(s, 30 * MIN)).toBe(15 * MIN);
    s = resume(s, 30 * MIN);
    expect(remainingMs(s, 35 * MIN)).toBe(10 * MIN);
    expect(focusedMinutes(s, 35 * MIN)).toBeCloseTo(15);
    expect(focusedMinutes(s, 90 * MIN)).toBeCloseTo(25); // capped at the phase end
  });

  it("chains phases from when the last one ended, with a long break every N", () => {
    let s = startPhase(1, "focus", 0, L, 0);
    s = nextPhase(s, L);
    expect(s).toMatchObject({ phase: "break", cycle: 1, phaseStartedAt: 25 * MIN });
    s = nextPhase(nextPhase(nextPhase(nextPhase(nextPhase(nextPhase(s, L), L), L), L), L), L);
    expect(s).toMatchObject({ phase: "long_break", cycle: 4 });
  });

  it("caps focus blocks at the task's remaining estimate, then stops", () => {
    const b = { budgetMs: 30 * MIN, spentMs: 0 };
    let s = startPhase(1, "focus", 0, L, 0, b);
    expect(remainingMs(s, 0)).toBe(25 * MIN);
    s = nextPhase(s, L);
    expect(s).toMatchObject({ phase: "break", spentMs: 25 * MIN });
    s = nextPhase(s, L);
    expect(s).toMatchObject({ phase: "focus", totalMs: 5 * MIN });
    s = nextPhase(s, L);
    expect(s).toMatchObject({ phase: "focus", estimateMet: true, budgetMs: null, endsAt: null });
  });
});
