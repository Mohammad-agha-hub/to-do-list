"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useBootstrap } from "@/lib/client/hooks";
import { applyTheme } from "@/lib/client/theme";
import clsx from "clsx";
import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Flame,
  Inbox,
  LayoutGrid,
  Settings,
  SunMedium,
  Target,
} from "lucide-react";
import { Logo } from "./Logo";
import { FocusPill, QuickAddFab, SyncStatus } from "./ShellExtras";
import { TaskUIProvider } from "./TaskSheets";

const MAIN_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/more", label: "More", icon: LayoutGrid },
];

const SECONDARY_NAV = [
  { href: "/backlog", label: "Inbox", icon: Inbox },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange },
  { href: "/review", label: "Weekly review", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MORE_ROUTES = ["/more", ...SECONDARY_NAV.map((n) => n.href)];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_ROUTES.some((r) => pathname.startsWith(r));
  if (href === "/goals") return pathname.startsWith("/goal");
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: boot } = useBootstrap();

  // A device that never picked a theme follows the one saved in settings.
  useEffect(() => {
    try {
      if (boot && !localStorage.getItem("theme") && boot.settings.theme !== "system") applyTheme(boot.settings.theme);
    } catch {
      /* storage blocked */
    }
  }, [boot]);

  return (
    <TaskUIProvider>
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Momentum</span>
        </Link>
        <nav className="space-y-1">
          {MAIN_NAV.filter((n) => n.href !== "/more").map((n) => (
            <SideLink key={n.href} {...n} active={isActive(pathname, n.href)} />
          ))}
        </nav>
        <QuickAddFab variant="sidebar" />
        <div className="section-title mt-8 mb-2 px-3">Plan</div>
        <nav className="space-y-1">
          {SECONDARY_NAV.map((n) => (
            <SideLink key={n.href} {...n} active={pathname.startsWith(n.href)} />
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-3">
          <FocusPill />
          <SyncStatus />
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[480px] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28 lg:max-w-[600px] lg:px-8 lg:pt-10 lg:pb-12">
        <div className="lg:hidden">
          <FocusPill />
          <SyncStatus />
        </div>
        {children}
      </main>
      <QuickAddFab variant="fab" />

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-lg lg:hidden">
        <div className="mx-auto grid max-w-[480px] grid-cols-5">
          {MAIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <span className={clsx("rounded-full px-4 py-1 transition", active && "bg-primary-soft")}>
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </TaskUIProvider>
  );
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className="size-[18px]" />
      {label}
    </Link>
  );
}

export { SECONDARY_NAV };
