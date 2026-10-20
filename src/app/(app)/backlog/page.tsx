"use client";

import { Inbox, Plus } from "lucide-react";
import { useAreas, useBootstrap, useInbox, useTaskActions } from "@/lib/client/hooks";
import type { Task } from "@/lib/shared/types";
import { TaskRow } from "@/components/TaskRow";
import { useReschedule, useTaskUI } from "@/components/TaskSheets";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";

export default function BacklogPage() {
  const { data, isLoading } = useInbox();
  const { data: boot } = useBootstrap();
  const areas = useAreas();
  const { toggle } = useTaskActions();
  const { openActions, openEdit, openQuickAdd } = useTaskUI();
  const reschedule = useReschedule();
  const today = boot?.today ?? "";
  const goals = new Map((boot?.goals ?? []).map((g) => [g.id, g]));

  const sorted = [...(data ?? [])].sort(
    (a, b) => a.priority - b.priority || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id,
  );

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle={data?.length ? `${data.length} undated task${data.length === 1 ? "" : "s"} · swipe left to do today` : undefined}
        action={
          <button className="btn-soft" onClick={() => openQuickAdd({ scheduled_date: null })}>
            <Plus className="size-4" /> Add
          </button>
        }
      />
      {isLoading && <Skeleton className="h-64" />}
      {data && data.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          body="Capture ideas here without a date. Pull them into a day when you're ready."
          action={
            <button className="btn-primary" onClick={() => openQuickAdd({ scheduled_date: null })}>
              <Plus className="size-4" /> Capture something
            </button>
          }
        />
      )}
      <div className="space-y-2">
        {sorted.map((t: Task) => (
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
      </div>
    </div>
  );
}
