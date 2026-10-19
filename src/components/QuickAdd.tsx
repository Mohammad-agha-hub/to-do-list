"use client";

import clsx from "clsx";
import { CalendarDays, Check, Clock, CornerDownLeft, Flag, Inbox, Target } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAreas, useBootstrap, useTaskActions } from "@/lib/client/hooks";
import { formatDay } from "@/lib/shared/dates";
import { parseQuickAdd, type ChipKind } from "@/lib/shared/parser";
import { useToast } from "./Toast";
import { AreaIcon, Sheet } from "./ui";

export type QuickAddDefaults = {
  scheduled_date?: string | null;
  area_id?: number | null;
  goal_id?: number | null;
};

const CHIP_ICON: Record<Exclude<ChipKind, "area">, typeof Flag> = {
  priority: Flag,
  date: CalendarDays,
  estimate: Clock,
  goal: Target,
};

const HELPERS = ["#area", "!1", "today", "tomorrow", "~30m", "@goal"];

export function QuickAddSheet({ defaults, onClose }: { defaults: QuickAddDefaults; onClose: () => void }) {
  const { data: boot } = useBootstrap();
  const areas = useAreas();
  const { create } = useTaskActions();
  const toast = useToast();
  const [text, setText] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const today = boot?.today ?? "";

  const parsed = useMemo(
    () => parseQuickAdd(text, { areas: areas.list, goals: boot?.goals ?? [], today }),
    [text, areas.list, boot?.goals, today],
  );

  const date = parsed.scheduled_date !== undefined ? parsed.scheduled_date : (defaults.scheduled_date ?? null);
  const goal = boot?.goals.find((g) => g.id === (parsed.goal_id ?? defaults.goal_id));
  const areaId = parsed.area_id ?? defaults.area_id ?? goal?.area_id ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title.trim()) return;
    const title = parsed.title.trim();
    setText("");
    setAdded((a) => [title, ...a].slice(0, 4));
    input.current?.focus();
    try {
      await create({
        title,
        area_id: areaId,
        goal_id: goal?.id ?? null,
        priority: parsed.priority ?? 2,
        estimate_min: parsed.estimate_min ?? null,
        scheduled_date: date,
      });
    } catch (err) {
      toast(`Couldn't add: ${(err as Error).message}`);
    }
  }

  function insert(token: string) {
    const base = token.startsWith("#") || token.startsWith("@") ? token[0] : token;
    setText((t) => (t && !t.endsWith(" ") ? t + " " : t) + base + (base.length === 1 ? "" : " "));
    input.current?.focus();
  }

  return (
    <Sheet open onClose={onClose} title="Quick add">
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <input
            ref={input}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="edit ep 4 #hazarakids !1 tomorrow ~2h"
            className="input pr-12 text-base"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="sentences"
            aria-label="New task"
          />
          <button
            type="submit"
            disabled={!parsed.title.trim()}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-primary text-on-primary transition disabled:opacity-30"
            aria-label="Add task"
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>

        {/* Live parsed result */}
        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
          <span className="chip bg-primary-soft text-primary">
            {date ? <CalendarDays className="size-3" /> : <Inbox className="size-3" />}
            {date ? formatDay(date, today) : "Inbox"}
          </span>
          {parsed.chips
            .filter((c) => c.kind !== "date")
            .map((c) => {
              if (c.kind === "area") {
                const area = areas.byId(parsed.area_id ?? null);
                return (
                  <span key={c.kind} className="chip animate-pop bg-surface-2 text-fg">
                    <AreaIcon area={area} className="size-3" />
                    {c.label}
                  </span>
                );
              }
              const Icon = CHIP_ICON[c.kind];
              return (
                <span
                  key={c.kind}
                  className={clsx(
                    "chip animate-pop max-w-[220px] bg-surface-2",
                    c.kind === "priority" && parsed.priority === 1 ? "text-danger" : "text-fg",
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </span>
              );
            })}
          {!parsed.area_id && areaId && (
            <span className="chip bg-surface-2 text-muted">
              <AreaIcon area={areas.byId(areaId)} className="size-3" />
              {areas.byId(areaId)?.name}
            </span>
          )}
        </div>

        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          {HELPERS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => insert(h)}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-muted transition hover:border-primary hover:text-primary"
            >
              {h}
            </button>
          ))}
        </div>

        {added.length > 0 && (
          <ul className="space-y-1 pt-1">
            {added.map((t, i) => (
              <li key={`${t}-${i}`} className="animate-fade flex items-center gap-2 text-sm text-muted">
                <Check className="size-3.5 text-success" /> {t}
              </li>
            ))}
          </ul>
        )}
      </form>
    </Sheet>
  );
}
