"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, RotateCw, Target } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { send } from "@/lib/client/api";
import { celebrate } from "@/lib/client/celebrate";
import { invalidateTaskViews, keys, useAreas, useBootstrap, useReview, useTaskActions } from "@/lib/client/hooks";
import { addDays, formatShort, WEEKDAY_SHORT, weekStart, weekday } from "@/lib/shared/dates";
import type { ReviewData, Task } from "@/lib/shared/types";
import { PacePill } from "@/components/GoalBits";
import { useToast } from "@/components/Toast";
import { AreaBadge, AreaIcon, PageHeader, Skeleton } from "@/components/ui";

/** Sunday reviews this week; any other day reviews last week. */
function defaultReviewWeek(today: string) {
  return weekday(today) === 7 ? weekStart(today) : addDays(weekStart(today), -7);
}

export default function ReviewPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}

function Review() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: boot } = useBootstrap();
  const today = boot?.today ?? "";
  const week = params.get("week") ?? (today ? defaultReviewWeek(today) : "");
  const { data, isLoading } = useReview(week);
  const go = (w: string) => router.replace(`/review?week=${w}`);
  const canGoNext = today && addDays(week, 7) <= weekStart(today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly review"
        subtitle={week ? `${formatShort(week)} – ${formatShort(addDays(week, 6))}` : undefined}
        action={
          week && (
            <div className="flex gap-1">
              <button className="btn-ghost px-2.5" onClick={() => go(addDays(week, -7))} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </button>
              <button className="btn-ghost px-2.5" onClick={() => go(addDays(week, 7))} disabled={!canGoNext} aria-label="Next week">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )
        }
      />
      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <ReviewBody key={week} data={data} today={today} />
      )}
    </div>
  );
}

function ReviewBody({ data, today }: { data: ReviewData; today: string }) {
  const areas = useAreas();
  const max = Math.max(1, ...data.completedByArea.map((r) => r.count));

  return (
    <>
      {data.review?.completed_at && (
        <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" /> Reviewed. You can still edit it.
        </p>
      )}

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="section-title">Completed</h2>
          <span className="text-2xl font-semibold tabular-nums">{data.completedTotal}</span>
        </div>
        {data.completedByArea.length ? (
          <ul className="space-y-2">
            {data.completedByArea.map((r) => {
              const area = areas.byId(r.area_id);
              return (
                <li key={r.area_id ?? 0} className="flex items-center gap-2.5 text-sm">
                  <AreaIcon area={area} className="size-3.5" />
                  <span className="w-28 truncate">{area?.name ?? "No area"}</span>
                  <div className="h-2 flex-1 rounded-full bg-track">
                    <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: area?.color ?? "var(--muted)" }} />
                  </div>
                  <span className="w-6 text-right font-medium tabular-nums">{r.count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing completed this week. A quiet week is data too.</p>
        )}
      </section>

      {data.slipped.length > 0 && (
        <section className="card p-4">
          <h2 className="section-title mb-3">Slipped</h2>
          <ul className="space-y-2">
            {data.slipped.slice(0, 8).map((s) => (
              <li key={s.task_id} className="flex items-center gap-2.5 text-sm">
                <span className={clsx("chip shrink-0", s.carries >= 3 ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted")}>
                  <RotateCw className="size-3" />
                  {s.carries}
                </span>
                <span className={clsx("flex-1 truncate", s.status === "done" && "text-muted line-through")}>{s.title}</span>
                <AreaBadge area={areas.byId(s.area_id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.goalsBehind.length > 0 && (
        <section className="card p-4">
          <h2 className="section-title mb-3">Goals needing attention</h2>
          <ul className="space-y-3">
            {data.goalsBehind.map((g) => (
              <li key={g.id}>
                <Link href={`/goal?id=${g.id}`} className="flex items-start gap-2.5">
                  <Target className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{g.title}</span>
                    <span className="text-xs text-muted">{g.pace.label}</span>
                  </span>
                  <PacePill status={g.pace.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Reflection data={data} />
      <PlanNextWeek data={data} today={today} />
    </>
  );
}

const FIELDS = [
  { key: "wins", label: "Wins", placeholder: "What went well? Big or small." },
  { key: "slipped", label: "What slipped", placeholder: "What didn't happen, and why?" },
  { key: "next_week_focus", label: "Next week's focus", placeholder: "One sentence. It'll show on Today all week." },
  { key: "notes", label: "Notes", placeholder: "Anything else (optional)" },
] as const;

type Fields = Record<(typeof FIELDS)[number]["key"], string>;

function Reflection({ data }: { data: ReviewData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Fields>({
    wins: data.review?.wins ?? "",
    slipped: data.review?.slipped ?? "",
    next_week_focus: data.review?.next_week_focus ?? "",
    notes: data.review?.notes ?? "",
  });
  const dirty = useRef(false);

  // Autosave drafts so nothing is lost if the app closes.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => send("PUT", `/api/reviews/${data.weekStart}`, { ...form, complete: false }).catch(() => null), 800);
    return () => clearTimeout(t);
  }, [form, data.weekStart]);

  async function finish() {
    await send("PUT", `/api/reviews/${data.weekStart}`, { ...form, complete: true });
    qc.invalidateQueries({ queryKey: keys.review(data.weekStart) });
    qc.invalidateQueries({ queryKey: keys.today });
    celebrate();
    toast("Week reviewed. Nice.");
  }

  return (
    <section className="card space-y-4 p-4">
      <h2 className="section-title">Reflect</h2>
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1.5 block text-sm font-medium">{f.label}</span>
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => {
              dirty.current = true;
              setForm((s) => ({ ...s, [f.key]: e.target.value }));
            }}
          />
        </label>
      ))}
      <button className="btn-primary w-full" onClick={finish}>
        <ClipboardCheck className="size-4" /> {data.review?.completed_at ? "Save review" : "Finish review"}
      </button>
    </section>
  );
}

function PlanNextWeek({ data, today }: { data: ReviewData; today: string }) {
  const areas = useAreas();
  const qc = useQueryClient();
  const { update } = useTaskActions();
  const nextStart = addDays(data.weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(nextStart, i)).filter((d) => d >= today);

  async function schedule(task: Task, date: string) {
    // Move the task between the backlog and next-week lists right away.
    qc.setQueryData<ReviewData>(keys.review(data.weekStart), (d) =>
      d && {
        ...d,
        backlog: d.backlog.filter((t) => t.id !== task.id),
        nextWeek: [...d.nextWeek.filter((t) => t.id !== task.id), { ...task, scheduled_date: date }].sort((a, b) =>
          (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""),
        ),
      },
    );
    await update(task, { scheduled_date: date });
    invalidateTaskViews(qc);
  }

  if (!days.length) return null;

  return (
    <section className="card p-4">
      <h2 className="section-title mb-1">Plan the coming week</h2>
      <p className="mb-4 text-sm text-muted">Tap a day to schedule something from your inbox.</p>

      {data.nextWeek.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {data.nextWeek.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 text-sm">
              <span className="w-9 shrink-0 text-xs font-semibold text-primary">{WEEKDAY_SHORT[weekday(t.scheduled_date!) - 1]}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <AreaBadge area={areas.byId(t.area_id)} />
            </li>
          ))}
        </ul>
      )}

      {data.backlog.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {data.backlog.slice(0, 25).map((t) => (
            <li key={t.id} className="py-2.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{t.title}</span>
                <AreaBadge area={areas.byId(t.area_id)} />
              </div>
              <div className="flex gap-1">
                {days.map((d) => (
                  <button
                    key={d}
                    onClick={() => schedule(t, d)}
                    className="flex-1 rounded-lg bg-surface-2 py-1.5 text-[11px] font-medium text-muted transition hover:bg-primary-soft hover:text-primary"
                    aria-label={`Schedule ${t.title} for ${formatShort(d)}`}
                  >
                    {WEEKDAY_SHORT[weekday(d) - 1].slice(0, 2)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Inbox is empty. Everything has a day.</p>
      )}
    </section>
  );
}
