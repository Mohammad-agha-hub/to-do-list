"use client";

import { CalendarRange, ChevronRight, ClipboardCheck, Inbox, LogOut, Moon, Settings, Timer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBootstrap, useInbox, useUpcoming } from "@/lib/client/hooks";
import { ReflectionCard } from "@/components/today/DayPrompts";
import { PageHeader } from "@/components/ui";

export default function MorePage() {
  const { data: inbox } = useInbox();
  const { data: upcoming } = useUpcoming();
  const { data: boot } = useBootstrap();
  const [reflecting, setReflecting] = useState(false);

  const links = [
    { href: "/backlog", label: "Inbox", hint: inbox ? `${inbox.length} undated` : "", icon: Inbox },
    { href: "/upcoming", label: "Upcoming", hint: upcoming ? `${upcoming.length} in the next 7 days` : "", icon: CalendarRange },
    { href: "/review", label: "Weekly review", hint: "Look back, plan ahead", icon: ClipboardCheck },
    { href: "/focus", label: "Free focus", hint: "Pomodoro without a task", icon: Timer },
    { href: "/settings", label: "Settings", hint: "Areas, timer, theme, backup", icon: Settings },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Don't leave cached data on the device after signing out.
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    location.href = "/login";
  }

  return (
    <div className="space-y-5">
      <PageHeader title="More" />
      <nav className="card divide-y divide-line overflow-hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <l.icon className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-medium">{l.label}</span>
              {l.hint && <span className="text-xs text-muted">{l.hint}</span>}
            </span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        ))}
        <button onClick={() => setReflecting((r) => !r)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-surface-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
            <Moon className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-medium">Reflect on today</span>
            <span className="text-xs text-muted">Energy, mood and one line</span>
          </span>
        </button>
      </nav>
      {reflecting && boot && <ReflectionCard today={boot.today} onDone={() => setReflecting(false)} />}
      <button onClick={logout} className="btn-ghost w-full">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}
