"use client";

import clsx from "clsx";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Inbox,
  Pencil,
  SkipForward,
  Star,
  SunMedium,
  Timer,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { useAreas, useBootstrap, useGoal, useTaskActions } from "@/lib/client/hooks";
import { addDays, formatDay, weekStart } from "@/lib/shared/dates";
import type { Task } from "@/lib/shared/types";
import { QuickAddSheet, type QuickAddDefaults } from "./QuickAdd";
import { useToast } from "./Toast";
import { Field, Segmented, Sheet } from "./ui";

type TaskUI = {
  openActions: (task: Task) => void;
  openEdit: (task: Task) => void;
  openQuickAdd: (defaults?: QuickAddDefaults) => void;
};

const TaskUIContext = createContext<TaskUI>({ openActions: () => {}, openEdit: () => {}, openQuickAdd: () => {} });
export const useTaskUI = () => useContext(TaskUIContext);

export function TaskUIProvider({ children }: { children: React.ReactNode }) {
  const [actionsFor, setActionsFor] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddDefaults | null>(null);

  const value: TaskUI = {
    openActions: useCallback((t: Task) => setActionsFor(t), []),
    openEdit: useCallback((t: Task) => setEditing(t), []),
    openQuickAdd: useCallback((d?: QuickAddDefaults) => setQuickAdd(d ?? {}), []),
  };

  return (
    <TaskUIContext.Provider value={value}>
      {children}
      {actionsFor && (
        <TaskActionsSheet
          task={actionsFor}
          onClose={() => setActionsFor(null)}
          onEdit={() => {
            setEditing(actionsFor);
            setActionsFor(null);
          }}
        />
      )}
      {editing && <TaskEditSheet key={editing.id} task={editing} onClose={() => setEditing(null)} />}
      {quickAdd && <QuickAddSheet defaults={quickAdd} onClose={() => setQuickAdd(null)} />}
    </TaskUIContext.Provider>
  );
}

/** Reschedule + undo, shared by the action sheet and swipe-left. */
export function useReschedule() {
  const { update } = useTaskActions();
  const toast = useToast();
  return useCallback(
    async (task: Task, date: string | null, label: string) => {
      const before = { scheduled_date: task.scheduled_date, is_top3: task.is_top3 };
      const saved = await update(task, { scheduled_date: date });
      toast(`Moved to ${label}`, { label: "Undo", onClick: () => update(saved, before) });
    },
    [update, toast],
  );
}

function TaskActionsSheet({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: () => void }) {
  const router = useRouter();
  const { data: boot } = useBootstrap();
  const { update, remove, create } = useTaskActions();
  const reschedule = useReschedule();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const today = boot?.today ?? "";
  const nextWeek = addDays(weekStart(today), 7);

  const act = (fn: () => unknown) => () => {
    onClose();
    Promise.resolve(fn()).catch((e) => toast(e.message ?? "Something went wrong"));
  };

  const Item = ({ icon: Icon, label, onClick, danger, hint }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean; hint?: string }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] transition hover:bg-surface-2",
        danger && "text-danger",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title={<span className="line-clamp-2">{task.title}</span>}>
      {picking ? (
        <div className="space-y-3 pt-1">
          <input
            type="date"
            className="input"
            min={today}
            defaultValue={task.scheduled_date ?? addDays(today, 1)}
            onChange={(e) => e.target.value && act(() => reschedule(task, e.target.value, formatDay(e.target.value, today)))()}
            autoFocus
          />
          <button className="btn-ghost w-full" onClick={() => setPicking(false)}>
            Back
          </button>
        </div>
      ) : (
        <div className="-mx-2 space-y-0.5">
          {task.status !== "done" && <Item icon={Timer} label="Start focus" onClick={act(() => router.push(`/focus?task=${task.id}`))} />}
          <Item icon={Pencil} label="Edit" onClick={onEdit} />
          {task.status !== "done" && (
            <Item
              icon={Star}
              label={task.is_top3 ? "Remove from Top 3" : "Add to Top 3"}
              onClick={act(() => update(task, { is_top3: !task.is_top3, scheduled_date: task.is_top3 ? undefined : today }))}
            />
          )}
          <div className="my-1.5 border-t border-line" />
          <p className="section-title px-3 pt-1 pb-1">Reschedule</p>
          <div className="grid grid-cols-4 gap-1.5 px-2 pb-2">
            {[
              { icon: SunMedium, label: "Today", date: today },
              { icon: ArrowRight, label: "Tomorrow", date: addDays(today, 1) },
              { icon: CalendarPlus, label: "Next week", date: nextWeek },
              { icon: Inbox, label: "Inbox", date: null },
            ].map((o) => (
              <button
                key={o.label}
                disabled={o.date === task.scheduled_date}
                onClick={act(() => reschedule(task, o.date, o.label === "Inbox" ? "Inbox" : formatDay(o.date!, today)))}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 py-3 text-xs font-medium transition hover:bg-primary-soft hover:text-primary disabled:opacity-40"
              >
                <o.icon className="size-[18px]" />
                {o.label}
              </button>
            ))}
          </div>
          <Item icon={CalendarDays} label="Pick a date…" onClick={() => setPicking(true)} />
          <div className="my-1.5 border-t border-line" />
          {task.status === "todo" && (
            <Item
              icon={SkipForward}
              label="Skip"
              hint={task.recurrence_id ? "Counts as missed" : undefined}
              onClick={act(async () => {
                const saved = await update(task, { status: "skipped" });
                toast("Skipped", { label: "Undo", onClick: () => update(saved, { status: "todo" }) });
              })}
            />
          )}
          <Item
            icon={Trash2}
            label="Delete"
            danger
            onClick={act(async () => {
              await remove(task);
              const { id: _id, ...rest } = task;
              toast("Deleted", {
                label: "Undo",
                onClick: () =>
                  create({
                    title: rest.title,
                    notes: rest.notes,
                    area_id: rest.area_id,
                    goal_id: rest.goal_id,
                    milestone_id: rest.milestone_id,
                    priority: rest.priority,
                    estimate_min: rest.estimate_min,
                    due_date: rest.due_date,
                    scheduled_date: rest.scheduled_date,
                  }),
              });
            })}
          />
        </div>
      )}
    </Sheet>
  );
}

export function TaskEditSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: boot } = useBootstrap();
  const areas = useAreas();
  const { update, remove } = useTaskActions();
  const toast = useToast();
  const [form, setForm] = useState({
    title: task.title,
    notes: task.notes,
    area_id: task.area_id,
    goal_id: task.goal_id,
    milestone_id: task.milestone_id,
    priority: task.priority,
    estimate_min: task.estimate_min,
    actual_min: task.actual_min,
    scheduled_date: task.scheduled_date,
    due_date: task.due_date,
    is_top3: task.is_top3,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const goals = (boot?.goals ?? []).filter((g) => g.status === "active" || g.id === form.goal_id);
  const { data: goalDetail } = useGoal(form.goal_id ?? 0);
  const milestones = form.goal_id ? (goalDetail?.milestones ?? []) : [];

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.title.trim()) return;
    onClose();
    try {
      // Only send time spent if it was edited, so focus minutes logged meanwhile aren't overwritten.
      const { actual_min, ...rest } = form;
      await update(task, { ...rest, title: form.title.trim(), ...(actual_min !== task.actual_min && { actual_min }) });
    } catch (err) {
      toast((err as Error).message);
    }
  }

  const num = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v))));

  return (
    <Sheet
      open
      onClose={onClose}
      title={task.recurrence_id ? "Edit habit task" : "Edit task"}
      footer={
        <div className="flex gap-2">
          <button
            className="btn-ghost text-danger"
            onClick={() => {
              onClose();
              remove(task).then(() => toast("Deleted"));
            }}
          >
            <Trash2 className="size-4" /> Delete
          </button>
          <button className="btn-primary ml-auto" onClick={() => save()} disabled={!form.title.trim()}>
            Save
          </button>
        </div>
      }
    >
      <form onSubmit={save} className="space-y-4 pt-1">
        <input className="input text-base font-medium" value={form.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" />
        <textarea
          className="input min-h-20 resize-y"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />

        <Field label="Priority">
          <Segmented
            className="w-full"
            value={form.priority}
            onChange={(v) => set("priority", v)}
            options={[
              { value: 1 as const, label: "High" },
              { value: 2 as const, label: "Medium" },
              { value: 3 as const, label: "Low" },
            ]}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <select className="input" value={form.area_id ?? ""} onChange={(e) => set("area_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">None</option>
              {areas.list
                .filter((a) => !a.archived || a.id === form.area_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Estimate (min)">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.estimate_min ?? ""}
              onChange={(e) => set("estimate_min", num(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Goal">
          <select
            className="input"
            value={form.goal_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, goal_id: e.target.value ? Number(e.target.value) : null, milestone_id: null }))}
          >
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        {milestones.length > 0 && (
          <Field label="Milestone">
            <select className="input" value={form.milestone_id ?? ""} onChange={(e) => set("milestone_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Scheduled">
            <input className="input" type="date" value={form.scheduled_date ?? ""} onChange={(e) => set("scheduled_date", e.target.value || null)} />
          </Field>
          <Field label="Due">
            <input className="input" type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Time spent (min)">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.actual_min}
              onChange={(e) => set("actual_min", num(e.target.value) ?? 0)}
            />
          </Field>
          <label className="flex items-end">
            <span
              className={clsx(
                "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                form.is_top3 ? "border-primary bg-primary-soft text-primary" : "border-line text-muted",
              )}
            >
              <input type="checkbox" className="sr-only" checked={form.is_top3} onChange={(e) => set("is_top3", e.target.checked)} />
              <Star className={clsx("size-4", form.is_top3 && "fill-current")} /> Top 3
            </span>
          </label>
        </div>
        {task.carried_over_count > 0 && <p className="text-xs text-muted">Carried over {task.carried_over_count}×.</p>}
      </form>
    </Sheet>
  );
}
