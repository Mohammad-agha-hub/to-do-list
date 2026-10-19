"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client/api";
import { keys, useAreas, useBootstrap } from "@/lib/client/hooks";
import type { Goal, GoalStatus, GoalType } from "@/lib/shared/types";
import { useToast } from "./Toast";
import { Field, Segmented, Sheet } from "./ui";

export function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const areas = useAreas();
  const { data: boot } = useBootstrap();
  const [form, setForm] = useState({
    title: goal?.title ?? "",
    description: goal?.description ?? "",
    area_id: goal?.area_id ?? null,
    type: (goal?.type ?? "task_based") as GoalType,
    target_value: goal?.target_value ?? null,
    current_value: goal?.current_value ?? 0,
    unit: goal?.unit ?? "",
    start_date: goal?.start_date ?? boot?.today ?? "",
    deadline: goal?.deadline ?? null,
    status: (goal?.status ?? "active") as GoalStatus,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.start_date && (form.type === "task_based" || (form.target_value ?? 0) > 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.goals });
    qc.invalidateQueries({ queryKey: ["goal"] });
    qc.invalidateQueries({ queryKey: keys.bootstrap });
  };

  async function save() {
    if (!valid) return;
    const payload = {
      ...form,
      title: form.title.trim(),
      target_value: form.type === "numeric" ? form.target_value : null,
      // current_value on numeric goals changes through log entries, except when creating.
      current_value: goal ? undefined : form.current_value,
    };
    onClose();
    try {
      const saved = goal ? await send<Goal>("PATCH", `/api/goals/${goal.id}`, payload) : await send<Goal>("POST", "/api/goals", payload);
      refresh();
      if (!goal && saved) router.push(`/goal?id=${saved.id}`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function remove() {
    if (!goal) return;
    onClose();
    await send("DELETE", `/api/goals/${goal.id}`);
    refresh();
    toast("Goal deleted. Its tasks were kept.");
    router.push("/goals");
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      footer={
        <div className="flex gap-2">
          {goal && (
            <button className="btn-ghost text-danger" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </button>
          )}
          <button className="btn-primary ml-auto" disabled={!valid} onClick={save}>
            {goal ? "Save" : "Create goal"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <input className="input text-base font-medium" placeholder="e.g. Publish 12 episodes" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus={!goal} />
        <textarea className="input min-h-16" placeholder="Why it matters (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} />

        <Field label="Measured by">
          <Segmented
            className="w-full"
            value={form.type}
            onChange={(v) => set("type", v)}
            options={[
              { value: "task_based", label: "Linked tasks" },
              { value: "numeric", label: "A number" },
            ]}
          />
        </Field>
        {form.type === "numeric" && (
          <div className="grid grid-cols-3 gap-3">
            {!goal && (
              <Field label="Start at">
                <input className="input" type="number" value={form.current_value} onChange={(e) => set("current_value", Number(e.target.value) || 0)} />
              </Field>
            )}
            <Field label="Target">
              <input
                className="input"
                type="number"
                min={0}
                value={form.target_value ?? ""}
                onChange={(e) => set("target_value", e.target.value === "" ? null : Number(e.target.value))}
              />
            </Field>
            <Field label="Unit">
              <input className="input" placeholder="km" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
            </Field>
          </div>
        )}
        {form.type === "task_based" && <p className="-mt-2 text-xs text-muted">Progress = done linked tasks ÷ all linked tasks. Link tasks with @goal in quick add.</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input className="input" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </Field>
          <Field label="Deadline">
            <input className="input" type="date" value={form.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} />
          </Field>
        </div>
        <Field label="Area">
          <select className="input" value={form.area_id ?? ""} onChange={(e) => set("area_id", e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {areas.active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {goal && (
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value as GoalStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
