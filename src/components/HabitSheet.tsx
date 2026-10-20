"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { send } from "@/lib/client/api";
import { invalidateTaskViews, useAreas, useBootstrap } from "@/lib/client/hooks";
import { WEEKDAY_SHORT } from "@/lib/shared/dates";
import type { RecurrenceRule } from "@/lib/shared/schemas";
import type { Habit } from "@/lib/shared/types";
import { useToast } from "./Toast";
import { Field, Segmented, Sheet } from "./ui";

type RuleType = RecurrenceRule["type"];

export function HabitSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const areas = useAreas();
  const { data: boot } = useBootstrap();
  const [title, setTitle] = useState(habit?.title ?? "");
  const [areaId, setAreaId] = useState<number | null>(habit?.area_id ?? null);
  const [goalId, setGoalId] = useState<number | null>(habit?.goal_id ?? null);
  const [estimate, setEstimate] = useState<number | null>(habit?.estimate_min ?? null);
  const [active, setActive] = useState(habit?.active ?? true);
  const [type, setType] = useState<RuleType>(habit?.rule.type ?? "daily");
  const [days, setDays] = useState<number[]>(habit?.rule.type === "weekdays" ? habit.rule.days : [1, 2, 3, 4, 5]);
  // Kept as raw text while typing; clamping per keystroke made it impossible to clear and retype.
  const [everyText, setEveryText] = useState(String(habit?.rule.type === "interval" ? habit.rule.every : 2));
  const [countText, setCountText] = useState(String(habit?.rule.type === "weekly" ? habit.rule.count : 3));
  const every = clampInt(everyText, 2, 90, 2);
  const count = clampInt(countText, 1, 7, 3);

  const rule: RecurrenceRule =
    type === "daily"
      ? { type }
      : type === "weekdays"
        ? { type, days: [...days].sort() }
        : type === "interval"
          ? { type, every }
          : { type, count };

  const valid = title.trim() && (type !== "weekdays" || days.length > 0);

  async function save() {
    if (!valid) return;
    onClose();
    const payload = { title: title.trim(), area_id: areaId, goal_id: goalId, estimate_min: estimate, active, rule };
    try {
      if (habit) await send("PATCH", `/api/habits/${habit.id}`, payload);
      else await send("POST", "/api/habits", payload);
      toast(habit ? "Habit updated" : "Habit added. Today's instance is on your list.");
    } catch (e) {
      toast((e as Error).message);
    }
    invalidateTaskViews(qc);
  }

  async function remove() {
    if (!habit) return;
    onClose();
    await send("DELETE", `/api/habits/${habit.id}`);
    toast("Habit deleted");
    invalidateTaskViews(qc);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      footer={
        <div className="flex gap-2">
          {habit && (
            <button className="btn-ghost text-danger" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </button>
          )}
          <button className="btn-primary ml-auto" disabled={!valid} onClick={save}>
            {habit ? "Save" : "Add habit"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <input className="input text-base font-medium" placeholder="e.g. Anki review" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!habit} />

        <Field label="Repeat">
          <Segmented
            className="w-full"
            value={type}
            onChange={setType}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekdays", label: "Days" },
              { value: "interval", label: "Every N" },
              { value: "weekly", label: "× / week" },
            ]}
          />
        </Field>
        {type === "weekdays" && (
          <div className="flex gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => {
              const on = days.includes(i + 1);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== i + 1) : [...ds, i + 1]))}
                  className={clsx(
                    "h-10 flex-1 rounded-xl text-xs font-semibold transition",
                    on ? "bg-primary text-on-primary" : "bg-surface-2 text-muted",
                  )}
                >
                  {d[0]}
                  <span className="sr-only">{d.slice(1)}</span>
                </button>
              );
            })}
          </div>
        )}
        {type === "interval" && (
          <label className="flex items-center gap-2 text-sm">
            Every
            <input
              type="number"
              min={2}
              max={90}
              inputMode="numeric"
              className="input w-20"
              value={everyText}
              onChange={(e) => setEveryText(e.target.value)}
              onBlur={() => setEveryText(String(every))}
            />
            days
          </label>
        )}
        {type === "weekly" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              max={7}
              inputMode="numeric"
              className="input w-20"
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onBlur={() => setCountText(String(count))}
            />
            times a week, any days
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <select className="input" value={areaId ?? ""} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">None</option>
              {areas.active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minutes">
            <input
              className="input"
              type="number"
              min={0}
              inputMode="numeric"
              value={estimate ?? ""}
              onChange={(e) => setEstimate(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            />
          </Field>
        </div>
        <Field label="Supports goal">
          <select className="input" value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {(boot?.goals ?? [])
              .filter((g) => g.status === "active" || g.id === goalId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        </Field>
        {habit && (
          <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
            <span>
              Active
              <span className="block text-xs text-muted">Paused habits don&apos;t create tasks</span>
            </span>
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
        )}
      </div>
    </Sheet>
  );
}

function clampInt(text: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(text));
  return text.trim() === "" || !Number.isFinite(n) ? fallback : Math.min(max, Math.max(min, n));
}
