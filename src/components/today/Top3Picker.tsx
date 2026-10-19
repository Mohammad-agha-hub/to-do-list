"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { useTaskActions, type useAreas } from "@/lib/client/hooks";
import type { Task } from "@/lib/shared/types";
import { useToast } from "../Toast";
import { AreaBadge, Sheet } from "../ui";

export function Top3Picker({ tasks, onClose, areas }: { tasks: Task[]; onClose: () => void; areas: ReturnType<typeof useAreas> }) {
  const { update } = useTaskActions();
  const toast = useToast();
  const [picked, setPicked] = useState<Set<number>>(() => new Set(tasks.filter((t) => t.is_top3).map((t) => t.id)));
  const sorted = [...tasks].sort((a, b) => Number(b.is_top3) - Number(a.is_top3) || a.priority - b.priority);

  function flip(id: number) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      else toast("Top 3 means three. Unpick one first.");
      return next;
    });
  }

  async function save() {
    onClose();
    await Promise.all(tasks.filter((t) => t.is_top3 !== picked.has(t.id)).map((t) => update(t, { is_top3: picked.has(t.id) })));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Today's Top 3"
      footer={
        <button className="btn-primary w-full" onClick={save} disabled={picked.size === 0}>
          {picked.size === 3 ? "Lock in my Top 3" : `Save (${picked.size}/3)`}
        </button>
      }
    >
      <p className="mb-3 text-sm text-muted">If you only finished these, today would still be a good day.</p>
      <ul className="space-y-1.5">
        {sorted.map((t) => {
          const on = picked.has(t.id);
          return (
            <li key={t.id}>
              <button
                onClick={() => flip(t.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  on ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2",
                )}
              >
                <span
                  className={clsx(
                    "grid size-5 shrink-0 place-items-center rounded-md border-2 transition",
                    on ? "border-primary bg-primary text-on-primary" : "border-line",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t.title}</span>
                  <AreaBadge area={areas.byId(t.area_id)} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
