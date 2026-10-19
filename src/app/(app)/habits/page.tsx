"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Flame, Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { send } from "@/lib/client/api";
import { haptic } from "@/lib/client/celebrate";
import { invalidateTaskViews, keys, useAreas, useHabits } from "@/lib/client/hooks";
import { formatShort } from "@/lib/shared/dates";
import { describeRule } from "@/lib/shared/metrics";
import type { DotStatus, Habit, HabitSummary } from "@/lib/shared/types";
import { HabitSheet } from "@/components/HabitSheet";
import { useToast } from "@/components/Toast";
import { AreaIcon, EmptyState, PageHeader, Skeleton } from "@/components/ui";

const DOT: Record<DotStatus, string> = {
  done: "bg-primary",
  missed: "bg-danger/35",
  pending: "border-2 border-primary/50 bg-transparent",
  off: "bg-track",
  before: "bg-transparent",
};

export default function HabitsPage() {
  const { data, isLoading } = useHabits();
  const areas = useAreas();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Habit | null | "new">(null);

  async function toggleToday(h: HabitSummary) {
    if (!h.todayTaskId) return;
    haptic();
    const done = !h.todayDone;
    // Optimistic: flip today's dot and adjust the streak.
    qc.setQueryData<HabitSummary[]>(keys.habits, (list) =>
      list?.map((x) =>
        x.id !== h.id
          ? x
          : {
              ...x,
              todayDone: done,
              current: Math.max(0, x.current + (done ? 1 : -1)),
              best: Math.max(x.best, x.current + (done ? 1 : 0)),
              weekDone: x.weekDone + (done ? 1 : -1),
              strip: x.strip.map((s, i) => (i === x.strip.length - 1 ? { ...s, status: done ? "done" : x.rule.type === "weekly" ? "off" : "pending" } : s)),
            },
      ),
    );
    try {
      await send("PATCH", `/api/tasks/${h.todayTaskId}`, { status: done ? "done" : "todo" });
    } catch (e) {
      toast((e as Error).message);
    }
    invalidateTaskViews(qc);
  }

  const active = data?.filter((h) => h.active) ?? [];
  const paused = data?.filter((h) => !h.active) ?? [];

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle={data ? `${active.filter((h) => h.todayDone).length} of ${active.filter((h) => h.todayTaskId).length} done today` : undefined}
        action={
          <button className="btn-soft" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> New
          </button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={Flame}
          title="No habits yet"
          body="Habits create a task on each scheduled day. Start with one small thing you want to do daily."
          action={
            <button className="btn-primary" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add a habit
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {active.map((h) => (
          <HabitCard key={h.id} habit={h} area={areas.byId(h.area_id)} onToggle={() => toggleToday(h)} onEdit={() => setEditing(h)} />
        ))}
      </div>

      {paused.length > 0 && (
        <>
          <h2 className="section-title mt-8 mb-3">Paused</h2>
          <div className="space-y-3 opacity-70">
            {paused.map((h) => (
              <HabitCard key={h.id} habit={h} area={areas.byId(h.area_id)} onEdit={() => setEditing(h)} />
            ))}
          </div>
        </>
      )}

      {editing && <HabitSheet habit={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function HabitCard({
  habit: h,
  area,
  onToggle,
  onEdit,
}: {
  habit: HabitSummary;
  area?: ReturnType<ReturnType<typeof useAreas>["byId"]>;
  onToggle?: () => void;
  onEdit: () => void;
}) {
  const unit = h.unit === "weeks" ? "wk" : "d";
  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <button onClick={onEdit} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${area?.color ?? "#64748b"}1f` }}>
            <AreaIcon area={area} className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{h.title}</p>
            <p className="text-xs text-muted">
              {describeRule(h.rule)}
              {h.rule.type === "weekly" && ` · ${h.weekDone}/${h.rule.count} this week`}
              {h.estimate_min ? ` · ${h.estimate_min}m` : ""}
            </p>
          </div>
        </button>
        {onToggle && h.todayTaskId ? (
          <button
            onClick={onToggle}
            aria-label={h.todayDone ? `Undo ${h.title} today` : `Mark ${h.title} done today`}
            aria-pressed={h.todayDone}
            className={clsx(
              "grid size-11 shrink-0 place-items-center rounded-2xl border-2 transition active:scale-90",
              h.todayDone ? "border-primary bg-primary text-on-primary" : "border-line text-muted hover:border-primary hover:text-primary",
            )}
          >
            <Check className={clsx("size-5", h.todayDone && "animate-pop")} strokeWidth={3} />
          </button>
        ) : (
          onToggle && <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-muted">Rest day</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Flame className={clsx("size-4", h.current > 0 ? "text-warning" : "text-muted")} />
          <span className="text-sm font-semibold tabular-nums">
            {h.current}
            {unit}
          </span>
          <span className="text-xs text-muted">streak</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <Trophy className="size-3.5" />
          <span className="text-xs">
            best {h.best}
            {unit}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]" aria-label="Last 30 days">
        {h.strip.map((s) => (
          <span key={s.date} title={`${formatShort(s.date)}: ${s.status}`} className={clsx("aspect-square rounded-full", DOT[s.status])} />
        ))}
      </div>
    </article>
  );
}
