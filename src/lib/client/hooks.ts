"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { get, nextTempId, send } from "./api";
import { celebrate } from "./celebrate";
import { addDays } from "@/lib/shared/dates";
import type {
  Area,
  Bootstrap,
  GoalDetail,
  GoalSummary,
  HabitSummary,
  ReviewData,
  StatsData,
  Task,
  TodayData,
} from "@/lib/shared/types";
import type { z } from "zod";
import type { TaskInput, TaskPatch } from "@/lib/shared/schemas";

export const keys = {
  bootstrap: ["bootstrap"] as const,
  today: ["today"] as const,
  inbox: ["tasks", "inbox"] as const,
  upcoming: ["tasks", "upcoming"] as const,
  goals: ["goals"] as const,
  goal: (id: number) => ["goal", id] as const,
  habits: ["habits"] as const,
  stats: ["stats"] as const,
  review: (week: string) => ["review", week] as const,
};

export const useBootstrap = () => useQuery({ queryKey: keys.bootstrap, queryFn: () => get<Bootstrap>("/api/bootstrap") });
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => get<TodayData>("/api/today") });
export const useInbox = () => useQuery({ queryKey: keys.inbox, queryFn: () => get<Task[]>("/api/tasks?view=inbox") });
export const useUpcoming = () => useQuery({ queryKey: keys.upcoming, queryFn: () => get<Task[]>("/api/tasks?view=upcoming") });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: () => get<GoalSummary[]>("/api/goals") });
export const useGoal = (id: number) =>
  useQuery({ queryKey: keys.goal(id), queryFn: () => get<GoalDetail>(`/api/goals/${id}`), enabled: id > 0 });
export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: () => get<HabitSummary[]>("/api/habits") });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => get<StatsData>("/api/stats") });
export const useReview = (week: string) =>
  useQuery({ queryKey: keys.review(week), queryFn: () => get<ReviewData>(`/api/reviews/${week}`), enabled: Boolean(week) });

export function useAreas() {
  const { data } = useBootstrap();
  return useMemo(() => {
    const list = data?.areas ?? [];
    const map = new Map<number, Area>(list.map((a) => [a.id, a]));
    return { list, active: list.filter((a) => !a.archived), byId: (id: number | null) => (id ? map.get(id) : undefined) };
  }, [data?.areas]);
}

/** Refetch everything derived from tasks, without blocking the UI. */
export function invalidateTaskViews(qc: QueryClient) {
  for (const key of [keys.today, ["tasks"], keys.goals, ["goal"], keys.habits, keys.stats, ["review"]]) {
    qc.invalidateQueries({ queryKey: key });
  }
}

/** Puts a task into (or removes it from) every cached list it belongs to. */
function placeTask(qc: QueryClient, task: Task, remove = false) {
  const today = qc.getQueryData<Bootstrap>(keys.bootstrap)?.today ?? qc.getQueryData<TodayData>(keys.today)?.today;
  const upsert = (list: Task[], belongs: boolean) => {
    const rest = list.filter((t) => t.id !== task.id);
    return belongs && !remove ? [...rest, task] : rest;
  };
  qc.setQueryData<TodayData>(keys.today, (d) =>
    d && {
      ...d,
      tasks: upsert(d.tasks, task.status === "todo" && task.scheduled_date === d.today),
      done: upsert(d.done, task.status === "done" && task.completed_date === d.today),
    },
  );
  qc.setQueryData<Task[]>(keys.inbox, (l) => l && upsert(l, task.status === "todo" && !task.scheduled_date));
  if (today) {
    qc.setQueryData<Task[]>(
      keys.upcoming,
      (l) =>
        l &&
        upsert(l, task.status === "todo" && !!task.scheduled_date && task.scheduled_date > today && task.scheduled_date <= addDays(today, 7)),
    );
  }
  if (task.goal_id) {
    qc.setQueryData<GoalDetail>(keys.goal(task.goal_id), (g) => g && { ...g, tasks: upsert(g.tasks, true) });
  }
}

function findTask(qc: QueryClient, id: number): Task | undefined {
  const today = qc.getQueryData<TodayData>(keys.today);
  const pools = [today?.tasks, today?.done, qc.getQueryData<Task[]>(keys.inbox), qc.getQueryData<Task[]>(keys.upcoming)];
  for (const p of pools) {
    const t = p?.find((x) => x.id === id);
    if (t) return t;
  }
}

type Patch = z.infer<typeof TaskPatch>;

export function useTaskActions() {
  const qc = useQueryClient();

  const update = useCallback(
    async (task: Task, patch: Patch) => {
      const today = qc.getQueryData<TodayData>(keys.today)?.today ?? "";
      const next: Task = { ...task, ...(patch as Partial<Task>) };
      if (patch.status === "done" && task.status !== "done") {
        next.completed_date = today;
        next.completed_at = new Date().toISOString();
      } else if (patch.status && patch.status !== "done") {
        next.completed_date = null;
        next.completed_at = null;
      }
      if (patch.scheduled_date !== undefined && patch.scheduled_date !== task.scheduled_date && patch.is_top3 === undefined) {
        next.is_top3 = false;
      }
      placeTask(qc, next);

      // Top 3 all done → confetti.
      if (patch.status === "done" && task.is_top3) {
        const d = qc.getQueryData<TodayData>(keys.today);
        const top3 = d ? [...d.tasks, ...d.done].filter((t) => t.is_top3) : [];
        if (top3.length > 0 && top3.every((t) => t.status === "done")) celebrate();
      }

      try {
        const saved = await send<Task>("PATCH", `/api/tasks/${task.id}`, patch);
        // If it was queued offline, keep the optimistic state; a refetch would return stale cache.
        if (saved) {
          placeTask(qc, saved);
          invalidateTaskViews(qc);
        }
        return saved ?? next;
      } catch (e) {
        placeTask(qc, task); // roll back
        throw e;
      }
    },
    [qc],
  );

  const create = useCallback(
    async (input: z.input<typeof TaskInput>) => {
      const tempId = nextTempId();
      const temp: Task = {
        id: tempId,
        title: input.title,
        notes: input.notes ?? "",
        area_id: input.area_id ?? null,
        goal_id: input.goal_id ?? null,
        milestone_id: input.milestone_id ?? null,
        priority: (input.priority ?? 2) as 1 | 2 | 3,
        estimate_min: input.estimate_min ?? null,
        actual_min: 0,
        due_date: input.due_date ?? null,
        scheduled_date: input.scheduled_date ?? null,
        status: "todo",
        is_top3: input.is_top3 ?? false,
        carried_over_count: 0,
        completed_at: null,
        completed_date: null,
        recurrence_id: null,
        sort_order: 9999,
        created_at: new Date().toISOString(),
      };
      placeTask(qc, temp);
      try {
        const saved = await send<Task>("POST", "/api/tasks", input, tempId);
        if (saved) {
          placeTask(qc, temp, true);
          placeTask(qc, saved);
          invalidateTaskViews(qc);
        }
        return saved ?? temp;
      } catch (e) {
        placeTask(qc, temp, true);
        throw e;
      }
    },
    [qc],
  );

  const remove = useCallback(
    async (task: Task) => {
      placeTask(qc, task, true);
      try {
        if (await send("DELETE", `/api/tasks/${task.id}`)) invalidateTaskViews(qc);
      } catch (e) {
        placeTask(qc, task);
        throw e;
      }
    },
    [qc],
  );

  const reorder = useCallback(
    async (ordered: Task[]) => {
      ordered.forEach((t, i) => placeTask(qc, { ...t, sort_order: i + 1 }));
      await send("POST", "/api/tasks/reorder", { ids: ordered.map((t) => t.id).filter((id) => id > 0) });
    },
    [qc],
  );

  const toggle = useCallback(
    (task: Task) => update(task, { status: task.status === "done" ? "todo" : "done" }),
    [update],
  );

  return { update, create, remove, reorder, toggle, find: (id: number) => findTask(qc, id) };
}
