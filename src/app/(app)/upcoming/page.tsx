"use client";

import { Plus } from "lucide-react";
import { useAreas, useBootstrap, useTaskActions, useUpcoming } from "@/lib/client/hooks";
import { addDays, formatDay, formatMinutes } from "@/lib/shared/dates";
import { TaskRow } from "@/components/TaskRow";
import { useReschedule, useTaskUI } from "@/components/TaskSheets";
import { PageHeader, Skeleton } from "@/components/ui";

export default function UpcomingPage() {
  const { data, isLoading } = useUpcoming();
  const { data: boot } = useBootstrap();
  const areas = useAreas();
  const { toggle } = useTaskActions();
  const { openActions, openEdit, openQuickAdd } = useTaskUI();
  const reschedule = useReschedule();
  const today = boot?.today ?? "";
  const goals = new Map((boot?.goals ?? []).map((g) => [g.id, g]));
  const available = (boot?.settings.available_hours ?? 6) * 60;
  const days = today ? Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)) : [];

  return (
    <div>
      <PageHeader title="Upcoming" subtitle="The next 7 days · habits are added on the day" />
      {isLoading && <Skeleton className="h-96" />}
      <div className="space-y-6">
        {data &&
          days.map((d) => {
            const tasks = data.filter((t) => t.scheduled_date === d).sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order);
            const planned = tasks.reduce((s, t) => s + (t.estimate_min ?? 0), 0);
            return (
              <section key={d}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">{formatDay(d, today)}</h2>
                  <span className={planned > available ? "text-xs font-medium text-warning" : "text-xs text-muted"}>
                    {planned ? `${formatMinutes(planned)} planned` : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      area={areas.byId(t.area_id)}
                      goal={t.goal_id ? goals.get(t.goal_id) : undefined}
                      today={today}
                      showArea
                      onToggle={toggle}
                      onEdit={openEdit}
                      onActions={openActions}
                      onSwipeLeft={(task) => reschedule(task, today, "Today")}
                      swipeLeftLabel="Today"
                    />
                  ))}
                  <button
                    onClick={() => openQuickAdd({ scheduled_date: d })}
                    className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-line px-3.5 py-2.5 text-sm text-muted transition hover:border-primary/50 hover:text-primary"
                  >
                    <Plus className="size-4" /> Add to {formatDay(d, today)}
                  </button>
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
