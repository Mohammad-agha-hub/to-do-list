"use client";

import clsx from "clsx";
import { ArrowRight, Check, Clock, GripVertical, MoreHorizontal, Repeat, RotateCw, Star, Target } from "lucide-react";
import { useRef, useState } from "react";
import { haptic } from "@/lib/client/celebrate";
import { formatDay, formatMinutes } from "@/lib/shared/dates";
import type { Area, Goal, Task } from "@/lib/shared/types";
import { AreaBadge, PRIORITY_COLOR } from "./ui";

type Props = {
  task: Task;
  area?: Area;
  goal?: Goal;
  today?: string;
  showArea?: boolean;
  showDate?: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onActions: (task: Task) => void;
  onSwipeLeft?: (task: Task) => void;
  swipeLeftLabel?: string;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement> & { ref?: (el: HTMLElement | null) => void };
};

const SWIPE_TRIGGER = 80;

export function TaskRow({
  task,
  area,
  goal,
  today,
  showArea,
  showDate,
  onToggle,
  onEdit,
  onActions,
  onSwipeLeft,
  swipeLeftLabel = "Tomorrow",
  dragHandle,
}: Props) {
  const [dx, setDx] = useState(0);
  const [checking, setChecking] = useState(false);
  const start = useRef<{ x: number; y: number; type: string } | null>(null);
  const swiping = useRef(false);
  const longPressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const done = task.status === "done" || checking;

  function toggle() {
    if (task.status === "done") return onToggle(task);
    setChecking(true);
    haptic();
    // Let the check animation play before the row moves to "Done".
    setTimeout(() => {
      onToggle(task);
      setChecking(false);
    }, 380);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-no-gesture]")) return;
    start.current = { x: e.clientX, y: e.clientY, type: e.pointerType };
    swiping.current = false;
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      haptic(18);
      onActions(task);
    }, 500);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) clearTimeout(timer.current);
    if (!swiping.current && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
      swiping.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (swiping.current) {
      const maxRight = task.status === "done" ? 0 : 140;
      const maxLeft = onSwipeLeft ? 140 : 0;
      setDx(Math.max(-maxLeft, Math.min(maxRight, ddx)));
    }
  }

  function onPointerUp() {
    clearTimeout(timer.current);
    if (swiping.current) {
      if (dx > SWIPE_TRIGGER) toggle();
      else if (dx < -SWIPE_TRIGGER && onSwipeLeft) {
        haptic();
        onSwipeLeft(task);
      }
      setDx(0);
    }
    start.current = null;
  }

  function onClick() {
    if (longPressed.current || swiping.current) {
      longPressed.current = false;
      swiping.current = false;
      return;
    }
    onEdit(task);
  }

  const overdue = task.due_date && today && task.due_date < today && task.status !== "done";

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe backgrounds */}
      {dx !== 0 && (
        <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-medium">
          <span className={clsx("flex items-center gap-2 text-success transition", dx > SWIPE_TRIGGER ? "opacity-100" : "opacity-50")}>
            <Check className="size-4" /> Done
          </span>
          <span className={clsx("flex items-center gap-2 text-primary transition", dx < -SWIPE_TRIGGER ? "opacity-100" : "opacity-50")}>
            {swipeLeftLabel} <ArrowRight className="size-4" />
          </span>
        </div>
      )}
      <div
        className={clsx(
          "group relative flex touch-pan-y items-start gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 select-none",
          dx === 0 && "transition-transform duration-200",
          dx > 0 && "bg-success-soft",
        )}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          if (start.current?.type !== "touch" && !longPressed.current) onActions(task);
        }}
      >
        <button
          data-no-gesture
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
          className={clsx(
            "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition",
            done ? "border-success bg-success text-white" : "hover:bg-primary-soft",
          )}
          style={done ? undefined : { borderColor: PRIORITY_COLOR[task.priority] }}
        >
          {done && <Check className="animate-pop size-3.5" strokeWidth={3.2} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={clsx("text-[15px] leading-snug transition", done && "text-muted line-through decoration-muted/60")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted empty:hidden">
            {task.is_top3 && (
              <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                <Star className="size-3 fill-current" /> Top 3
              </span>
            )}
            {showArea && <AreaBadge area={area} />}
            {task.recurrence_id && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" /> Habit
              </span>
            )}
            {task.estimate_min ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatMinutes(task.estimate_min)}
                {task.actual_min > 0 && <span className="opacity-70">· {formatMinutes(task.actual_min)} spent</span>}
              </span>
            ) : null}
            {task.carried_over_count > 0 && (
              <span
                className={clsx(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium",
                  task.carried_over_count >= 3 ? "bg-warning-soft text-warning" : "bg-surface-2",
                )}
                title={`Carried over ${task.carried_over_count} times`}
              >
                <RotateCw className="size-3" />
                {task.carried_over_count}
              </span>
            )}
            {goal && (
              <span className="inline-flex max-w-[160px] items-center gap-1 truncate">
                <Target className="size-3 shrink-0" />
                <span className="truncate">{goal.title}</span>
              </span>
            )}
            {showDate && task.scheduled_date && today && <span>{formatDay(task.scheduled_date, today)}</span>}
            {task.due_date && task.status !== "done" && (
              <span className={clsx(overdue && "font-medium text-danger")}>Due {today ? formatDay(task.due_date, today) : task.due_date}</span>
            )}
          </div>
        </div>

        <button
          data-no-gesture
          className="-mr-1 hidden rounded-lg p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 lg:block"
          onClick={(e) => {
            e.stopPropagation();
            onActions(task);
          }}
          aria-label="More actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {dragHandle && (
          <button
            data-no-gesture
            {...dragHandle}
            onClick={(e) => e.stopPropagation()}
            className="-mr-1.5 cursor-grab touch-none rounded-lg p-1 text-muted/60 hover:bg-surface-2 hover:text-muted active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
