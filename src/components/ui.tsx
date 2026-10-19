"use client";

import clsx from "clsx";
import {
  BookOpen,
  Briefcase,
  Circle,
  Clapperboard,
  Code2,
  Compass,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  Languages,
  Music,
  Palette,
  Plane,
  Sprout,
  Star,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { Area } from "@/lib/shared/types";

export const AREA_ICONS: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
  clapperboard: Clapperboard,
  briefcase: Briefcase,
  compass: Compass,
  languages: Languages,
  dumbbell: Dumbbell,
  heart: Heart,
  book: BookOpen,
  home: Home,
  code: Code2,
  music: Music,
  palette: Palette,
  plane: Plane,
  wallet: Wallet,
  star: Star,
  sprout: Sprout,
  users: Users,
  circle: Circle,
};

export const AREA_COLORS = ["#3b82f6", "#0ea5e9", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1", "#64748b"];

export function AreaIcon({ area, className = "size-4" }: { area?: Area; className?: string }) {
  const Icon = AREA_ICONS[area?.icon ?? "circle"] ?? Circle;
  return <Icon className={className} style={{ color: area?.color ?? "var(--muted)" }} aria-hidden />;
}

export function AreaBadge({ area, className }: { area?: Area; className?: string }) {
  if (!area) return null;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs text-muted", className)}>
      <span className="size-1.5 rounded-full" style={{ background: area.color }} />
      {area.name}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal aria-labelledby={title ? titleId : undefined}>
      <div className="animate-fade absolute inset-0 bg-[#06111f]/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        className={clsx(
          "animate-sheet pb-safe relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-card lg:animate-fade lg:rounded-3xl",
          wide ? "max-w-[560px]" : "max-w-[480px]",
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line lg:hidden" />
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2 lg:pt-5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 112,
  stroke = 10,
  children,
  color = "var(--primary)",
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color = "var(--primary)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-track", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex rounded-xl bg-surface-2 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            o.value === value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-surface-2", className)} />;
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export const PRIORITY_COLOR: Record<number, string> = { 1: "var(--danger)", 2: "var(--primary)", 3: "var(--muted)" };
