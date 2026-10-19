"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, Plus, RefreshCw } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { flushQueue, onQueueChange, pendingCount } from "@/lib/client/api";
import { invalidateTaskViews, useBootstrap } from "@/lib/client/hooks";
import { addDays } from "@/lib/shared/dates";
import { useTaskUI } from "./TaskSheets";

function FabInner({ variant }: { variant: "fab" | "sidebar" }) {
  const { openQuickAdd } = useTaskUI();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: boot } = useBootstrap();
  const today = boot?.today ?? null;

  const defaults = () => {
    if (pathname.startsWith("/backlog")) return { scheduled_date: null };
    if (pathname.startsWith("/upcoming") && today) return { scheduled_date: addDays(today, 1) };
    if (pathname.startsWith("/goal") && params.get("id")) return { scheduled_date: null, goal_id: Number(params.get("id")) };
    return { scheduled_date: today };
  };

  // "n" or "q" opens quick add on desktop.
  useEffect(() => {
    if (variant !== "fab") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "n" || e.key === "q") {
        e.preventDefault();
        openQuickAdd(defaults());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (pathname.startsWith("/focus")) return null;

  if (variant === "sidebar") {
    return (
      <button className="btn-primary mt-6 w-full justify-start" onClick={() => openQuickAdd(defaults())}>
        <Plus className="size-4" /> New task
        <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[11px]">N</kbd>
      </button>
    );
  }
  return (
    <button
      onClick={() => openQuickAdd(defaults())}
      aria-label="Quick add task"
      className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-2xl bg-primary text-on-primary shadow-[0_10px_30px_-8px_rgb(43_140_235/0.6)] transition hover:bg-primary-strong active:scale-95 lg:hidden"
    >
      <Plus className="size-6" strokeWidth={2.4} />
    </button>
  );
}

export function QuickAddFab(props: { variant: "fab" | "sidebar" }) {
  return (
    <Suspense>
      <FabInner {...props} />
    </Suspense>
  );
}

/** Shows offline / pending-sync state and replays queued changes when back online. */
export function SyncStatus() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(pendingCount());
    const sync = async () => {
      if (await flushQueue()) invalidateTaskViews(qc);
    };
    const up = () => {
      setOnline(true);
      sync();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const unsub = onQueueChange(setPending);
    sync();
    const interval = setInterval(() => navigator.onLine && pendingCount() && sync(), 15_000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      unsub();
      clearInterval(interval);
    };
  }, [qc]);

  if (online && !pending) return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning lg:mb-0">
      {online ? <RefreshCw className="size-3.5 animate-spin" /> : <CloudOff className="size-3.5" />}
      {online ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…` : `Offline${pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : " · changes will sync later"}`}
    </div>
  );
}
