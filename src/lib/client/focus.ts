"use client";

// Pomodoro state machine driven entirely by timestamps, so it stays correct when the
// screen locks or the tab is suspended: remaining = endsAt - now, never a counted interval.

export type Phase = "focus" | "break" | "long_break";

export type FocusState = {
  taskId: number | null;
  phase: Phase;
  /** Completed focus blocks in this run, for the long-break cadence. */
  cycle: number;
  /** When the current phase started (ms). */
  phaseStartedAt: number;
  /** Set while running. */
  endsAt: number | null;
  /** Set while paused. */
  pausedRemaining: number | null;
  /** Focus time already banked before a pause, in ms (pauses don't count). */
  bankedMs: number;
  /** When the current unpaused stretch began (ms). */
  runningSince: number | null;
  /** Full length of the current phase (ms). Missing on states saved by older versions. */
  totalMs?: number;
  /** The task's estimated focus time left when this run started (ms); null means no cap. */
  budgetMs?: number | null;
  /** Focus time completed in earlier blocks of this run (ms). */
  spentMs?: number;
  /** The last block used up the estimate; the timer waits for the user. */
  estimateMet?: boolean;
};

export type Budget = { budgetMs: number | null; spentMs: number };

export type Lengths = { focus: number; break: number; longBreak: number; cycles: number };

const KEY = "momentum:focus";

export function loadFocus(): FocusState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusState) : null;
  } catch {
    return null;
  }
}

export function saveFocus(s: FocusState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function phaseMs(phase: Phase, l: Lengths) {
  return (phase === "focus" ? l.focus : phase === "break" ? l.break : l.longBreak) * 60_000;
}

export function budgetOf(s: FocusState): Budget {
  return { budgetMs: s.budgetMs ?? null, spentMs: s.spentMs ?? 0 };
}

/** A focus block never runs past what's left of the task's estimate. */
function lengthMs(phase: Phase, l: Lengths, b: Budget) {
  const full = phaseMs(phase, l);
  if (phase !== "focus" || b.budgetMs === null) return full;
  const left = b.budgetMs - b.spentMs;
  return left > 0 ? Math.min(full, left) : full;
}

export function startPhase(
  taskId: number | null,
  phase: Phase,
  cycle: number,
  l: Lengths,
  at = Date.now(),
  b: Budget = { budgetMs: null, spentMs: 0 },
): FocusState {
  const totalMs = lengthMs(phase, l, b);
  return { taskId, phase, cycle, phaseStartedAt: at, endsAt: at + totalMs, pausedRemaining: null, bankedMs: 0, runningSince: at, totalMs, ...b };
}

export function totalMs(s: FocusState, l: Lengths) {
  return s.totalMs ?? phaseMs(s.phase, l);
}

export function remainingMs(s: FocusState, now = Date.now()) {
  if (s.pausedRemaining !== null) return s.pausedRemaining;
  return Math.max(0, (s.endsAt ?? now) - now);
}

export function pause(s: FocusState, now = Date.now()): FocusState {
  if (s.pausedRemaining !== null) return s;
  return { ...s, pausedRemaining: remainingMs(s, now), endsAt: null, bankedMs: s.bankedMs + (now - (s.runningSince ?? now)), runningSince: null };
}

export function resume(s: FocusState, now = Date.now()): FocusState {
  if (s.pausedRemaining === null) return s;
  return { ...s, endsAt: now + s.pausedRemaining, pausedRemaining: null, runningSince: now };
}

/** Focus minutes actually spent in the current phase, excluding pauses. */
export function focusedMinutes(s: FocusState, now = Date.now()) {
  const until = s.endsAt !== null ? Math.min(now, s.endsAt) : now;
  const live = s.runningSince !== null ? until - s.runningSince : 0;
  return (s.bankedMs + Math.max(0, live)) / 60_000;
}

/** The phase that follows a finished one, starting exactly when the previous one ended. */
export function nextPhase(s: FocusState, l: Lengths): FocusState {
  const endedAt = s.endsAt ?? Date.now();
  const b = budgetOf(s);
  if (s.phase === "focus") {
    const cycle = s.cycle + 1;
    const spentMs = b.spentMs + focusedMinutes(s, endedAt) * 60_000;
    // Estimate used up (within a minute): stop here instead of starting a break and another block.
    if (b.budgetMs !== null && b.budgetMs - spentMs < 60_000) {
      return { ...pause(startPhase(s.taskId, "focus", cycle, l, endedAt, { budgetMs: null, spentMs }), endedAt), estimateMet: true };
    }
    return startPhase(s.taskId, cycle % l.cycles === 0 ? "long_break" : "break", cycle, l, endedAt, { ...b, spentMs });
  }
  return startPhase(s.taskId, "focus", s.cycle, l, endedAt, b);
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
