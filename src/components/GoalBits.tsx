import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Circle, CircleSlash, PauseCircle, TrendingDown, TrendingUp } from "lucide-react";
import type { Goal, GoalPillStatus, PaceStatus } from "@/lib/shared/types";

export const PACE_META: Record<GoalPillStatus, { label: string; color: string; soft: string; icon: typeof Circle }> = {
  on_track: { label: "On track", color: "var(--success)", soft: "bg-success-soft text-success", icon: TrendingUp },
  at_risk: { label: "At risk", color: "var(--warning)", soft: "bg-warning-soft text-warning", icon: AlertTriangle },
  behind: { label: "Behind", color: "var(--danger)", soft: "bg-danger-soft text-danger", icon: TrendingDown },
  done: { label: "Reached", color: "var(--success)", soft: "bg-success-soft text-success", icon: CheckCircle2 },
  empty: { label: "No tasks yet", color: "var(--primary)", soft: "bg-surface-2 text-muted", icon: Circle },
  none: { label: "No deadline", color: "var(--primary)", soft: "bg-surface-2 text-muted", icon: Circle },
  paused: { label: "Paused", color: "var(--muted)", soft: "bg-surface-2 text-muted", icon: PauseCircle },
  abandoned: { label: "Abandoned", color: "var(--muted)", soft: "bg-surface-2 text-muted", icon: CircleSlash },
};

export function goalPillStatus(g: Pick<Goal, "status"> & { pace: { status: PaceStatus } }): GoalPillStatus {
  return g.status === "active" ? g.pace.status : g.status === "completed" ? "done" : g.status;
}

/** Status pill: always icon + label, never color alone. */
export function PacePill({ status, className }: { status: GoalPillStatus; className?: string }) {
  const m = PACE_META[status];
  return (
    <span className={clsx("chip shrink-0", m.soft, className)}>
      <m.icon className="size-3" />
      {m.label}
    </span>
  );
}

export function formatAmount(n: number, unit: string) {
  const v = Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit ? `${v} ${unit}` : v;
}
