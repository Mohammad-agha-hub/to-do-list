"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, Check, Flag, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { send } from "@/lib/client/api";
import { keys, useAreas, useBootstrap, useGoal, useTaskActions } from "@/lib/client/hooks";
import { formatDay, formatShort } from "@/lib/shared/dates";
import type { GoalDetail, Milestone, ProgressLog } from "@/lib/shared/types";
import { GoalProgressChart } from "@/components/charts/GoalProgressChart";
import { formatAmount, goalPillStatus, PACE_META, PacePill } from "@/components/GoalBits";
import { GoalSheet } from "@/components/GoalSheet";
import { TaskRow } from "@/components/TaskRow";
import { useTaskUI } from "@/components/TaskSheets";
import { useToast } from "@/components/Toast";
import { AreaIcon, EmptyState, ProgressRing, Segmented, Skeleton } from "@/components/ui";

export default function GoalPage() {
  return (
    <Suspense>
      <GoalView />
    </Suspense>
  );
}

function GoalView() {
  const id = Number(useSearchParams().get("id"));
  const { data: g, isLoading, error } = useGoal(id);
  const areas = useAreas();
  const [editing, setEditing] = useState(false);

  if (!id || error) return <EmptyState icon={Flag} title="Goal not found" action={<Link href="/goals" className="btn-soft">Back to goals</Link>} />;
  if (isLoading || !g) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const area = areas.byId(g.area_id);
  const pace = goalPillStatus(g);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/goals" className="btn-ghost -ml-3 px-3">
          <ArrowLeft className="size-4" /> Goals
        </Link>
        <button className="btn-ghost -mr-3 px-3" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Edit
        </button>
      </div>

      <header className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `${area?.color ?? "#64748b"}1f` }}>
          <AreaIcon area={area} className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-semibold tracking-tight">{g.title}</h1>
          {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
        </div>
      </header>

      <section className="card flex items-center gap-5 p-5">
        <ProgressRing value={g.progress} color={PACE_META[pace].color} size={104}>
          <span className="text-xl font-semibold tabular-nums">{Math.round(g.progress * 100)}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2">
          <PacePill status={pace} />
          <p className="text-sm font-medium tabular-nums">
            {g.type === "task_based" ? `${g.done} of ${g.total} tasks done` : `${formatAmount(g.done, "")} of ${formatAmount(g.total, g.unit)}`}
          </p>
          <p className="text-xs text-muted">
            {g.deadline ? `Due ${formatShort(g.deadline)}` : "No deadline"}
            {g.pace.daysLeft !== null && g.pace.daysLeft >= 0 && ` · ${g.pace.daysLeft} days left`}
          </p>
        </div>
      </section>
      {g.status === "active" && g.pace.status !== "done" && (
        <p className={clsx("-mt-2 rounded-xl px-3.5 py-2.5 text-sm", PACE_META[g.pace.status].soft)}>{g.pace.label}</p>
      )}

      {g.type === "numeric" && <LogEntry goal={g} />}

      <section className="card p-4">
        <h2 className="section-title mb-3">Progress over time</h2>
        <GoalProgressChart data={g.chart} total={g.total} unit={g.type === "task_based" ? "tasks" : g.unit} start={g.start_date} deadline={g.deadline} />
      </section>

      <Milestones goal={g} />
      <LinkedTasks goal={g} />
      {g.type === "numeric" && g.logs.length > 0 && <Logs goal={g} />}

      {editing && <GoalSheet goal={g} onClose={() => setEditing(false)} />}
    </div>
  );
}

function useGoalRefresh(id: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.goal(id) });
    qc.invalidateQueries({ queryKey: keys.goals });
  };
}

function LogEntry({ goal }: { goal: GoalDetail }) {
  const qc = useQueryClient();
  const refresh = useGoalRefresh(goal.id);
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const n = Number(delta);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!n) return;
    qc.setQueryData<GoalDetail>(keys.goal(goal.id), (g) => g && { ...g, done: g.done + n, current_value: g.current_value + n, progress: Math.min(1, (g.done + n) / (g.total || 1)) });
    setDelta("");
    setNote("");
    try {
      await send("POST", `/api/goals/${goal.id}/logs`, { delta: n, note });
      toast(`Logged ${n > 0 ? "+" : ""}${formatAmount(n, goal.unit)}`);
    } catch (err) {
      toast((err as Error).message);
    }
    refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="section-title">Log progress</h2>
      <div className="flex gap-2">
        <div className="relative w-32 shrink-0">
          <input className="input pr-12" type="number" step="any" inputMode="decimal" placeholder="+0" value={delta} onChange={(e) => setDelta(e.target.value)} aria-label={`Amount in ${goal.unit || "units"}`} />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{goal.unit}</span>
        </div>
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary shrink-0 px-3.5" disabled={!n} aria-label="Log">
          <Plus className="size-4" />
        </button>
      </div>
    </form>
  );
}

function Milestones({ goal }: { goal: GoalDetail }) {
  const qc = useQueryClient();
  const refresh = useGoalRefresh(goal.id);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const done = goal.milestones.filter((m) => m.done).length;

  const patchLocal = (fn: (ms: Milestone[]) => Milestone[]) =>
    qc.setQueryData<GoalDetail>(keys.goal(goal.id), (g) => g && { ...g, milestones: fn(g.milestones) });

  async function toggle(m: Milestone) {
    patchLocal((ms) => ms.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)));
    await send("PATCH", `/api/milestones/${m.id}`, { done: !m.done });
    refresh();
  }
  async function remove(m: Milestone) {
    patchLocal((ms) => ms.filter((x) => x.id !== m.id));
    await send("DELETE", `/api/milestones/${m.id}`);
    refresh();
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await send("POST", `/api/goals/${goal.id}/milestones`, { title: title.trim(), due_date: due || null });
    setTitle("");
    setDue("");
    refresh();
  }

  return (
    <section className="card p-4">
      <h2 className="section-title mb-3 flex items-center justify-between">
        Milestones
        {goal.milestones.length > 0 && (
          <span className="tabular-nums">
            {done}/{goal.milestones.length}
          </span>
        )}
      </h2>
      <ul className="space-y-1">
        {goal.milestones.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 rounded-xl px-1 py-1.5">
            <button
              onClick={() => toggle(m)}
              aria-label={m.done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
              className={clsx(
                "grid size-5 shrink-0 place-items-center rounded-md border-2 transition",
                m.done ? "border-success bg-success text-white" : "border-line hover:border-primary",
              )}
            >
              {m.done && <Check className="animate-pop size-3" strokeWidth={3} />}
            </button>
            <span className={clsx("flex-1 text-sm", m.done && "text-muted line-through")}>{m.title}</span>
            {m.due_date && <span className="text-xs text-muted">{formatShort(m.due_date)}</span>}
            <button onClick={() => remove(m)} className="rounded p-1 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={`Delete milestone ${m.title}`}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <input className="input col-span-2 sm:col-span-1" placeholder="Add a milestone" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Milestone due date" />
        <button className="btn-soft shrink-0 px-3" disabled={!title.trim()} aria-label="Add milestone">
          <Plus className="size-4" />
        </button>
      </form>
    </section>
  );
}

function LinkedTasks({ goal }: { goal: GoalDetail }) {
  const areas = useAreas();
  const { toggle } = useTaskActions();
  const { openActions, openEdit, openQuickAdd } = useTaskUI();
  const [tab, setTab] = useState<"open" | "done">("open");
  const open = goal.tasks.filter((t) => t.status === "todo");
  const done = goal.tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const list = tab === "open" ? open : done;
  const today = useBootstrap().data?.today;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="section-title flex-1">Linked tasks</h2>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: `Open ${open.length}` },
            { value: "done", label: `Done ${done.length}` },
          ]}
        />
      </div>
      <div className="space-y-2">
        {list.map((t) => (
          <TaskRow key={t.id} task={t} area={areas.byId(t.area_id)} showDate today={today} onToggle={toggle} onEdit={openEdit} onActions={openActions} />
        ))}
        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            {tab === "open" ? "No open tasks. Break the next step into a task." : "Nothing finished yet. The first one is the hardest."}
          </p>
        )}
        <button className="btn-ghost w-full border border-dashed border-line" onClick={() => openQuickAdd({ goal_id: goal.id, area_id: goal.area_id, scheduled_date: null })}>
          <ListChecks className="size-4" /> Add task to this goal
        </button>
      </div>
    </section>
  );
}

function Logs({ goal }: { goal: GoalDetail }) {
  const qc = useQueryClient();
  const refresh = useGoalRefresh(goal.id);
  async function remove(l: ProgressLog) {
    qc.setQueryData<GoalDetail>(keys.goal(goal.id), (g) => g && { ...g, logs: g.logs.filter((x) => x.id !== l.id) });
    await send("DELETE", `/api/progress-logs/${l.id}`);
    refresh();
  }
  return (
    <section className="card p-4">
      <h2 className="section-title mb-2">Recent entries</h2>
      <ul className="divide-y divide-line">
        {goal.logs.slice(0, 12).map((l) => (
          <li key={l.id} className="group flex items-center gap-3 py-2 text-sm">
            <span className={clsx("w-16 font-medium tabular-nums", l.delta > 0 ? "text-success" : "text-danger")}>
              {l.delta > 0 ? "+" : ""}
              {formatAmount(l.delta, "")}
            </span>
            <span className="flex-1 truncate text-muted">{l.note}</span>
            <span className="text-xs text-muted">{formatDay(l.date)}</span>
            <button onClick={() => remove(l)} className="rounded p-1 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Delete entry">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
