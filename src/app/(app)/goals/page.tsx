"use client";

import clsx from "clsx";
import { ChevronDown, Plus, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAreas, useGoals } from "@/lib/client/hooks";
import { formatShort } from "@/lib/shared/dates";
import type { GoalSummary } from "@/lib/shared/types";
import { formatAmount, goalPillStatus, PACE_META, PacePill } from "@/components/GoalBits";
import { GoalSheet } from "@/components/GoalSheet";
import { AreaIcon, EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui";

export default function GoalsPage() {
  const { data, isLoading } = useGoals();
  const [creating, setCreating] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const active = data?.filter((g) => g.status === "active") ?? [];
  const other = data?.filter((g) => g.status !== "active") ?? [];
  const behind = active.filter((g) => g.pace.status === "behind").length;

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle={data && active.length ? `${active.length} active${behind ? ` · ${behind} behind pace` : " · all on pace"}` : undefined}
        action={
          <button className="btn-soft" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New
          </button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          body="A goal gives your daily tasks a direction. Create one, then link tasks to it with @goal."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Create a goal
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {active.map((g) => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </div>

      {other.length > 0 && (
        <section className="mt-8">
          <button className="section-title flex items-center gap-1.5" onClick={() => setShowOther((s) => !s)} aria-expanded={showOther}>
            <ChevronDown className={clsx("size-4 transition", !showOther && "-rotate-90")} />
            Paused, completed &amp; abandoned · {other.length}
          </button>
          {showOther && (
            <div className="mt-3 space-y-3">
              {other.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          )}
        </section>
      )}

      {creating && <GoalSheet goal={null} onClose={() => setCreating(false)} />}
    </div>
  );
}

function GoalCard({ goal: g }: { goal: GoalSummary }) {
  const areas = useAreas();
  const area = areas.byId(g.area_id);
  const pace = goalPillStatus(g);
  const amounts = g.type === "task_based" ? `${g.done}/${g.total} tasks` : `${formatAmount(g.done, "")}/${formatAmount(g.total, g.unit)}`;

  return (
    <Link href={`/goal?id=${g.id}`} className={clsx("card block p-4 transition hover:border-primary/40", g.status !== "active" && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${area?.color ?? "#64748b"}1f` }}>
          <AreaIcon area={area} className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-semibold">{g.title}</p>
          <p className="text-xs text-muted">
            {g.status !== "active" ? g.status[0].toUpperCase() + g.status.slice(1) : g.deadline ? `Due ${formatShort(g.deadline)}` : "No deadline"}
            {g.status === "active" && g.pace.daysLeft !== null && g.pace.daysLeft >= 0 && ` · ${g.pace.daysLeft} days left`}
          </p>
        </div>
        <PacePill status={pace} />
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums">{Math.round(g.progress * 100)}%</span>
        <span className="text-xs text-muted tabular-nums">{amounts}</span>
      </div>
      <ProgressBar value={g.progress} color={PACE_META[pace].color} className="mt-1.5" />
      {g.status === "active" && g.pace.status !== "done" && <p className="mt-2.5 text-xs text-muted">{g.pace.label}</p>}
    </Link>
  );
}
