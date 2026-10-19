"use client";

import { CalendarClock, Play, RotateCw, Scissors, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTaskActions } from "@/lib/client/hooks";
import type { Task } from "@/lib/shared/types";
import { useTaskUI } from "../TaskSheets";
import { useToast } from "../Toast";
import { Sheet } from "../ui";

const DISMISS_KEY = "momentum:carry-dismissed";

/** Gentle nudge for tasks that have slipped 3+ times: do it, break it down, reschedule or drop it. */
export function CarryPrompt({ tasks, today }: { tasks: Task[]; today: string }) {
  const router = useRouter();
  const { update } = useTaskActions();
  const { openActions } = useTaskUI();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [breaking, setBreaking] = useState<Task | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? "{}");
      if (saved.date === today) setDismissed(saved.ids ?? []);
    } catch {
      /* ignore */
    }
  }, [today]);

  const task = tasks.find((t) => t.carried_over_count >= 3 && !t.recurrence_id && !dismissed.includes(t.id));
  if (!task && !breaking) return null;

  const dismiss = (id: number) => {
    const ids = [...dismissed, id];
    setDismissed(ids);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify({ date: today, ids }));
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {task && (
        <section className="card animate-fade border-warning/30 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
              <RotateCw className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">&ldquo;{task.title}&rdquo; has slipped {task.carried_over_count} times</p>
              <p className="mt-0.5 text-sm text-muted">No judgement. What would help?</p>
            </div>
            <button className="-mt-1 -mr-1 rounded-lg p-1 text-muted hover:bg-surface-2" onClick={() => dismiss(task.id)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              { icon: Play, label: "Do it", onClick: () => router.push(`/focus?task=${task.id}`) },
              { icon: Scissors, label: "Break down", onClick: () => setBreaking(task) },
              { icon: CalendarClock, label: "Reschedule", onClick: () => openActions(task) },
              {
                icon: X,
                label: "Drop",
                onClick: async () => {
                  const saved = await update(task, { status: "skipped" });
                  toast("Dropped. One less thing.", { label: "Undo", onClick: () => update(saved, { status: "todo" }) });
                },
              },
            ].map((b) => (
              <button
                key={b.label}
                onClick={b.onClick}
                className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 py-2.5 text-xs font-medium transition hover:bg-primary-soft hover:text-primary"
              >
                <b.icon className="size-4" />
                {b.label}
              </button>
            ))}
          </div>
        </section>
      )}
      {breaking && <BreakDownSheet task={breaking} today={today} onClose={() => setBreaking(null)} />}
    </>
  );
}

function BreakDownSheet({ task, today, onClose }: { task: Task; today: string; onClose: () => void }) {
  const { create, update } = useTaskActions();
  const toast = useToast();
  const [text, setText] = useState("");
  const steps = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  async function save() {
    onClose();
    for (const title of steps) {
      await create({
        title,
        area_id: task.area_id,
        goal_id: task.goal_id,
        milestone_id: task.milestone_id,
        priority: task.priority,
        scheduled_date: today,
        estimate_min: task.estimate_min ? Math.max(5, Math.round(task.estimate_min / steps.length)) : null,
      });
    }
    await update(task, { status: "skipped", notes: `${task.notes}\n\nBroken down into: ${steps.join("; ")}`.trim() });
    toast(`Split into ${steps.length} smaller step${steps.length === 1 ? "" : "s"}`);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Break it down"
      footer={
        <button className="btn-primary w-full" disabled={!steps.length} onClick={save}>
          Replace with {steps.length || ""} step{steps.length === 1 ? "" : "s"}
        </button>
      }
    >
      <p className="mb-3 text-sm text-muted">
        What&apos;s the very first small step of &ldquo;{task.title}&rdquo;? One step per line. They&apos;ll be added for today.
      </p>
      <textarea
        autoFocus
        className="input min-h-36"
        placeholder={"Open the sheet\nList missing donors\nEmail Sana for numbers"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </Sheet>
  );
}
