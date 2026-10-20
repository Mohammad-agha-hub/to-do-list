"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ClipboardCheck, Compass, Moon, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { send } from "@/lib/client/api";
import { keys } from "@/lib/client/hooks";
import { formatShort } from "@/lib/shared/dates";
import type { TodayData } from "@/lib/shared/types";
import { useToast } from "../Toast";

const ENERGY = ["😴", "🥱", "🙂", "😊", "⚡️"];
const MOOD = ["😞", "😕", "😐", "🙂", "😄"];

/** Weekly review banner and the end-of-day reflection card. */
export function DayPrompts({ data }: { data: TodayData }) {
  return (
    <>
      {data.reviewDue && <ReviewBanner week={data.reviewDue} />}
      {data.weekFocus && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-primary-soft px-4 py-3 text-sm">
          <Compass className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold text-primary">This week: </span>
            {data.weekFocus}
          </span>
        </p>
      )}
      {data.reflectionDue && <ReflectionCard today={data.today} />}
    </>
  );
}

function ReviewBanner({ week }: { week: string }) {
  const qc = useQueryClient();
  const dismiss = async () => {
    qc.setQueryData<TodayData>(keys.today, (d) => d && { ...d, reviewDue: null });
    await send("POST", "/api/prompts/dismiss", { kind: "review", key: week });
  };
  return (
    <div className="card animate-fade flex items-center gap-3 p-3.5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <ClipboardCheck className="size-5" />
      </div>
      <Link href={`/review?week=${week}`} className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Weekly review is ready</p>
        <p className="text-xs text-muted">Week of {formatShort(week)} · about 5 minutes</p>
      </Link>
      <Link href={`/review?week=${week}`} className="btn-primary px-3 py-2">
        Start
      </Link>
      <button onClick={dismiss} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}

function Scale({ value, onChange, faces, label }: { value: number | null; onChange: (v: number) => void; faces: string[]; label: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {faces.map((f, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            aria-label={`${label} ${i + 1} of 5`}
            onClick={() => onChange(i + 1)}
            className={clsx(
              "grid h-10 flex-1 place-items-center rounded-xl border text-lg transition",
              value === i + 1 ? "border-primary bg-primary-soft scale-105" : "border-line grayscale-[0.6] hover:grayscale-0",
            )}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReflectionCard({ today, onDone }: { today: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const hide = () => qc.setQueryData<TodayData>(keys.today, (d) => d && { ...d, reflectionDue: false });

  async function save() {
    hide();
    onDone?.();
    await send("PUT", `/api/day/${today}`, { energy, mood, reflection: note.trim() });
    qc.invalidateQueries({ queryKey: keys.stats });
    toast("Saved. Rest well.");
  }

  return (
    <section className="card animate-fade space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Moon className="size-4 text-primary" />
        <h2 className="flex-1 text-sm font-semibold">How was today?</h2>
        <button
          onClick={() => {
            hide();
            send("POST", "/api/prompts/dismiss", { kind: "reflection", key: today });
          }}
          className="rounded-lg p-1 text-muted hover:bg-surface-2"
          aria-label="Skip reflection"
        >
          <X className="size-4" />
        </button>
      </div>
      <Scale label="Energy" value={energy} onChange={setEnergy} faces={ENERGY} />
      <Scale label="Mood" value={mood} onChange={setMood} faces={MOOD} />
      <input className="input" placeholder="One line about today (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-primary w-full" disabled={!energy && !mood && !note.trim()} onClick={save}>
        Save reflection
      </button>
    </section>
  );
}
