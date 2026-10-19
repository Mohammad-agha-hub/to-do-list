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
};

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

export function startPhase(taskId: number | null, phase: Phase, cycle: number, l: Lengths, at = Date.now()): FocusState {
  return { taskId, phase, cycle, phaseStartedAt: at, endsAt: at + phaseMs(phase, l), pausedRemaining: null, bankedMs: 0, runningSince: at };
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
  if (s.phase === "focus") {
    const cycle = s.cycle + 1;
    return startPhase(s.taskId, cycle % l.cycles === 0 ? "long_break" : "break", cycle, l, endedAt);
  }
  return startPhase(s.taskId, "focus", s.cycle, l, endedAt);
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
