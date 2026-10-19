"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, Check, Pause, Play, SkipForward, Square, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { get, send } from "@/lib/client/api";
import { celebrate } from "@/lib/client/celebrate";
import {
  focusedMinutes,
  formatClock,
  loadFocus,
  nextPhase,
  pause,
  phaseMs,
  remainingMs,
  resume,
  saveFocus,
  startPhase,
  type FocusState,
  type Lengths,
} from "@/lib/client/focus";
import { invalidateTaskViews, useBootstrap } from "@/lib/client/hooks";
import type { Task } from "@/lib/shared/types";
import { ProgressRing } from "@/components/ui";

const PHASE_LABEL = { focus: "Focus", break: "Short break", long_break: "Long break" } as const;

export default function FocusPage() {
  return (
    <Suspense>
      <Focus />
    </Suspense>
  );
}

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}

function notify(body: string) {
  try {
    navigator.vibrate?.([200, 100, 200]);
    if (document.visibilityState === "visible") chime();
    if ("Notification" in window && Notification.permission === "granted") new Notification("Momentum", { body, icon: "/icons/icon-192.png" });
  } catch {
    /* ignore */
  }
}

function Focus() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: boot } = useBootstrap();
  const [state, setState] = useState<FocusState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [canNotify, setCanNotify] = useState(true);
  const handled = useRef<number | null>(null);

  const lengths: Lengths | null = boot
    ? {
        focus: boot.settings.pomodoro_focus,
        break: boot.settings.pomodoro_break,
        longBreak: boot.settings.pomodoro_long_break,
        cycles: boot.settings.pomodoro_cycles,
      }
    : null;

  const update = useCallback((s: FocusState | null) => {
    saveFocus(s);
    setState(s);
  }, []);

  const taskId = state?.taskId ?? (params.get("task") ? Number(params.get("task")) : null);
  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => get<Task>(`/api/tasks/${taskId}`),
    enabled: Boolean(taskId && taskId > 0),
  });

  const logSession = useCallback(
    async (s: FocusState, endedAt: number) => {
      const minutes = focusedMinutes(s, endedAt);
      if (s.phase !== "focus" || minutes < 1) return;
      await send("POST", "/api/focus", {
        task_id: s.taskId && s.taskId > 0 ? s.taskId : null,
        started_at: new Date(s.phaseStartedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
        duration_min: Math.round(minutes * 10) / 10,
      }).catch(() => null);
      invalidateTaskViews(qc);
    },
    [qc],
  );

  // Start or resume a session once settings are known.
  useEffect(() => {
    if (!lengths || state) return;
    const wanted = params.get("task") ? Number(params.get("task")) : null;
    const existing = loadFocus();
    if (existing && (!params.has("task") || existing.taskId === wanted)) {
      setState(existing);
    } else {
      if (existing) logSession(existing, Math.min(Date.now(), existing.endsAt ?? Date.now()));
      update(startPhase(wanted, "focus", 0, lengths));
    }
    setCanNotify(!("Notification" in window) || Notification.permission !== "default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lengths !== null]);

  // Display tick + catch up after the screen was locked.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  // Phase finished?
  useEffect(() => {
    if (!state || !lengths || state.endsAt === null || remainingMs(state, now) > 0) return;
    if (handled.current === state.phaseStartedAt) return;
    handled.current = state.phaseStartedAt;
    if (state.phase === "focus") {
      logSession(state, state.endsAt);
      notify("Focus block done. Take a break.");
      celebrate();
    } else {
      notify("Break's over. Ready for the next one?");
    }
    let next = nextPhase(state, lengths);
    // If the next phase also elapsed while we were away, wait for the user instead.
    if (next.endsAt !== null && next.endsAt <= Date.now()) {
      next = pause(startPhase(state.taskId, "focus", next.cycle, lengths));
    }
    update(next);
  }, [now, state, lengths, logSession, update]);

  // Keep the screen awake while running.
  const isRunning = state !== null && state.pausedRemaining === null;
  useEffect(() => {
    if (!isRunning || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => null);
    return () => {
      lock?.release().catch(() => null);
    };
  }, [isRunning]);

  const remaining = state ? remainingMs(state, now) : 0;
  useEffect(() => {
    if (state) document.title = `${formatClock(remaining)} · ${PHASE_LABEL[state.phase]}`;
    return () => {
      document.title = "Momentum";
    };
  }, [remaining, state]);

  if (!state || !lengths) return <div className="min-h-dvh bg-bg" />;

  const running = state.pausedRemaining === null;
  const isFocus = state.phase === "focus";
  const total = phaseMs(state.phase, lengths);
  const color = isFocus ? "var(--primary)" : "var(--success)";

  async function stop() {
    if (state) await logSession(state, Date.now());
    update(null);
    router.back();
  }

  async function finishTask() {
    if (!state) return;
    await logSession(state, Date.now());
    if (task) await send("PATCH", `/api/tasks/${task.id}`, { status: "done" });
    update(null);
    invalidateTaskViews(qc);
    celebrate();
    router.replace("/");
  }

  return (
    <main className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-bg px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center justify-between">
        <button onClick={() => router.back()} className="btn-ghost -ml-3 px-3" aria-label="Minimise timer (keeps running)">
          <X className="size-5" />
        </button>
        <div className="flex gap-1.5" aria-label={`Block ${(state.cycle % lengths.cycles) + 1} of ${lengths.cycles}`}>
          {Array.from({ length: lengths.cycles }, (_, i) => (
            <span key={i} className={clsx("size-2 rounded-full", i < state.cycle % lengths.cycles ? "bg-primary" : "bg-track")} />
          ))}
        </div>
        {!canNotify ? (
          <button
            className="btn-ghost -mr-3 px-3"
            onClick={() => Notification.requestPermission().then(() => setCanNotify(true))}
            aria-label="Enable notifications when a block ends"
          >
            <Bell className="size-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>

      <div className="flex flex-col items-center gap-8">
        <p className={clsx("chip text-sm", isFocus ? "bg-primary-soft text-primary" : "bg-success-soft text-success")}>{PHASE_LABEL[state.phase]}</p>
        <ProgressRing value={1 - remaining / total} size={272} stroke={8} color={color}>
          <div className="text-center">
            <div className="text-6xl font-light tracking-tight tabular-nums" role="timer" aria-live="off">
              {formatClock(remaining)}
            </div>
            {!running && <p className="mt-1 text-sm text-muted">Paused</p>}
          </div>
        </ProgressRing>
        <p className="max-w-xs text-center text-lg leading-snug font-medium">{task?.title ?? (taskId ? " " : "Free focus")}</p>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex items-center gap-6">
          <button onClick={stop} className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted transition hover:text-fg active:scale-95" aria-label="Stop and log time">
            <Square className="size-5" />
          </button>
          <button
            onClick={() => update(running ? pause(state) : resume(state))}
            className="grid size-20 place-items-center rounded-full text-on-primary shadow-[0_12px_32px_-10px_rgb(43_140_235/0.7)] transition active:scale-95"
            style={{ background: color }}
            aria-label={running ? "Pause" : "Resume"}
          >
            {running ? <Pause className="size-8" fill="currentColor" /> : <Play className="ml-1 size-8" fill="currentColor" />}
          </button>
          <button
            onClick={() => {
              if (isFocus) logSession(state, Date.now());
              handled.current = state.phaseStartedAt;
              update(isFocus ? nextPhase({ ...state, endsAt: Date.now() }, lengths) : startPhase(state.taskId, "focus", state.cycle, lengths));
            }}
            className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted transition hover:text-fg active:scale-95"
            aria-label={isFocus ? "End block early and take a break" : "Skip break"}
          >
            <SkipForward className="size-5" />
          </button>
        </div>
        {task && task.status !== "done" && (
          <button onClick={finishTask} className="btn-soft">
            <Check className="size-4" /> Mark task done
          </button>
        )}
      </div>
    </main>
  );
}
