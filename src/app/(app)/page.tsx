"use client";

import clsx from "clsx";
import { AlertTriangle, ChevronDown, Inbox, Plus, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAreas, useBootstrap, useTaskActions, useToday } from "@/lib/client/hooks";
import { addDays, formatDay, formatMinutes, localHour, WEEKDAY_LONG, weekday } from "@/lib/shared/dates";
import type { Goal, Task } from "@/lib/shared/types";
import { CarryPrompt } from "@/components/today/CarryPrompt";
import { Top3Picker } from "@/components/today/Top3Picker";
import { SortableTaskGroup } from "@/components/today/SortableTaskGroup";
import { DayPrompts } from "@/components/today/DayPrompts";
import { TaskRow } from "@/components/TaskRow";
import { useReschedule, useTaskUI } from "@/components/TaskSheets";
import { AreaIcon, EmptyState, ProgressBar, ProgressRing, Skeleton } from "@/components/ui";

function greeting() {
  const h = localHour();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function TodayPage() {
  const { data, isLoading, error } = useToday();
  const { data: boot } = useBootstrap();
  const areas = useAreas();
  const { toggle } = useTaskActions();
  const { openActions, openEdit, openQuickAdd } = useTaskUI();
  const reschedule = useReschedule();
  const [pickingTop3, setPickingTop3] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const goalsById = useMemo(() => new Map<number, Goal>((boot?.goals ?? []).map((g) => [g.id, g])), [boot?.goals]);

  if (isLoading || !data) {
    return error ? (
      <EmptyState icon={AlertTriangle} title="Couldn't load today" body={(error as Error).message} />
    ) : (
      <div className="space-y-4">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-36" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { today, tasks, done } = data;
  // Stable order, so checking one off doesn't make the list jump.
  const top3 = [...tasks, ...done].filter((t) => t.is_top3).sort((a, b) => a.priority - b.priority || a.id - b.id);
  const rest = tasks.filter((t) => !t.is_top3);
  const total = tasks.length + done.length;
  const won = top3.length > 0 && top3.every((t) => t.status === "done");
  const over = data.plannedMin - data.availableMin;

  const rowProps = (t: Task) => ({
    task: t,
    area: areas.byId(t.area_id),
    goal: t.goal_id ? goalsById.get(t.goal_id) : undefined,
    today,
    onToggle: toggle,
    onEdit: openEdit,
    onActions: openActions,
    onSwipeLeft: (task: Task) => reschedule(task, addDays(today, 1), "tomorrow"),
  });

  // Group remaining tasks by area, in area order; tasks without an area go last.
  const groups = [...areas.list.map((a) => a.id), null]
    .map((id) => ({ id, tasks: rest.filter((t) => (t.area_id ?? null) === id) }))
    .filter((g) => g.tasks.length);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">{greeting()}</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{WEEKDAY_LONG[weekday(today) - 1]}</h1>
        <p className="text-sm text-muted">{formatDay(today).split(", ")[1]}</p>
      </header>

      {/* Progress */}
      <section className="card flex items-center gap-5 p-5">
        <ProgressRing value={total ? done.length / total : 0} color={won ? "var(--success)" : undefined}>
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums">{total ? Math.round((done.length / total) * 100) : 0}%</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-lg font-semibold">
              {done.length} of {total} done
            </p>
            <p className="text-sm text-muted">{total === 0 ? "Nothing planned yet" : tasks.length === 0 ? "All clear. Nice work!" : `${tasks.length} to go`}</p>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>{formatMinutes(data.plannedMin)} planned</span>
              <span>{formatMinutes(data.availableMin)} available</span>
            </div>
            <ProgressBar value={data.availableMin ? data.plannedMin / data.availableMin : 0} color={over > 0 ? "var(--warning)" : undefined} />
          </div>
        </div>
      </section>
      {over > 0 && (
        <p className="-mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Overplanned by {formatMinutes(over)}. Consider moving something to tomorrow (swipe left).
        </p>
      )}

      <DayPrompts data={data} />

      {/* Top 3 */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-1.5">
            <Star className="size-3.5 fill-primary text-primary" /> Top 3
          </h2>
          {top3.length > 0 && (
            <button className="text-xs font-medium text-primary" onClick={() => setPickingTop3(true)}>
              Change
            </button>
          )}
        </div>
        {top3.length === 0 ? (
          <button
            onClick={() => (tasks.length ? setPickingTop3(true) : openQuickAdd({ scheduled_date: today }))}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft/50 p-4 text-left transition hover:border-primary/60"
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
              <Star className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Pick today&apos;s Top 3</p>
              <p className="text-sm text-muted">
                {tasks.length ? "Choose the three things that would make today a win." : "Add a few tasks first, then choose your Top 3."}
              </p>
            </div>
          </button>
        ) : (
          <div className={clsx("space-y-2 rounded-3xl p-1.5 transition", won && "bg-success-soft")}>
            {won && (
              <p className="flex items-center gap-2 px-2.5 pt-1.5 pb-1 text-sm font-semibold text-success">
                <Trophy className="size-4" /> Top 3 done. Today is a win!
              </p>
            )}
            {top3.map((t) => (
              <TaskRow key={t.id} {...rowProps(t)} showArea />
            ))}
          </div>
        )}
      </section>

      <CarryPrompt tasks={tasks} today={today} />

      {/* Everything else, by area */}
      {groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map((g) => {
            const area = areas.byId(g.id);
            return (
              <section key={g.id ?? "none"}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <AreaIcon area={area} />
                  {area?.name ?? "No area"}
                  <span className="text-xs font-normal text-muted">{g.tasks.length}</span>
                </h2>
                <SortableTaskGroup tasks={g.tasks} rowProps={rowProps} />
              </section>
            );
          })}
        </div>
      ) : (
        tasks.length === 0 &&
        done.length === 0 && (
          <EmptyState
            icon={Plus}
            title="A blank page"
            body="Add what you want to get done today, or pull something in from your inbox."
            action={
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => openQuickAdd({ scheduled_date: today })}>
                  <Plus className="size-4" /> Add task
                </button>
                <Link href="/backlog" className="btn-soft">
                  <Inbox className="size-4" /> Inbox
                </Link>
              </div>
            }
          />
        )
      )}

      {/* Done today */}
      {done.filter((t) => !t.is_top3).length > 0 && (
        <section>
          <button onClick={() => setShowDone((s) => !s)} className="section-title flex w-full items-center gap-1.5 py-1" aria-expanded={showDone}>
            <ChevronDown className={clsx("size-4 transition", !showDone && "-rotate-90")} />
            Done today · {done.filter((t) => !t.is_top3).length}
          </button>
          {showDone && (
            <div className="animate-fade mt-2 space-y-2">
              {done
                .filter((t) => !t.is_top3)
                .map((t) => (
                  <TaskRow key={t.id} {...rowProps(t)} onSwipeLeft={undefined} showArea />
                ))}
            </div>
          )}
        </section>
      )}

      {pickingTop3 && <Top3Picker tasks={[...tasks, ...done.filter((t) => t.is_top3)]} onClose={() => setPickingTop3(false)} areas={areas} />}
    </div>
  );
}
