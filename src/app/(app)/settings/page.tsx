"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Archive, ArchiveRestore, Download, KeyRound, Laptop, Moon, Plus, Sun, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { send } from "@/lib/client/api";
import { invalidateTaskViews, keys, useBootstrap } from "@/lib/client/hooks";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/client/theme";
import type { Settings } from "@/lib/shared/schemas";
import type { Area, Bootstrap } from "@/lib/shared/types";
import { useToast } from "@/components/Toast";
import { AREA_COLORS, AREA_ICONS, PageHeader, Segmented, Sheet, Skeleton } from "@/components/ui";

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section>
      <h2 className="section-title mb-2 px-1">{title}</h2>
      <div className="card divide-y divide-line">{children}</div>
      {hint && <p className="mt-2 px-1 text-xs text-muted">{hint}</p>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ value, onCommit, min, max, step = 1, suffix }: { value: number; onCommit: (n: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Math.min(max, Math.max(min, Number(text)));
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setText(String(value));
  };
  return (
    <span className="flex items-center gap-1.5">
      <input
        className="input w-20 text-right tabular-nums"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      {suffix && <span className="w-8 text-xs text-muted">{suffix}</span>}
    </span>
  );
}

export default function SettingsPage() {
  const { data: boot } = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>("system");
  const [editingArea, setEditingArea] = useState<Area | "new" | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setTheme(getStoredTheme()), []);

  if (!boot) return <Skeleton className="h-96" />;
  const s = boot.settings;

  async function save(patch: Partial<Settings>) {
    qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => b && { ...b, settings: { ...b.settings, ...patch } });
    try {
      await send("PATCH", "/api/settings", patch);
      toast("Saved");
    } catch (e) {
      toast((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: keys.bootstrap });
    qc.invalidateQueries({ queryKey: keys.today });
  }

  function chooseTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
    send("PATCH", "/api/settings", { theme: t }).catch(() => null);
  }

  async function toggleArchive(a: Area) {
    await send("PATCH", `/api/areas/${a.id}`, { archived: !a.archived });
    qc.invalidateQueries({ queryKey: keys.bootstrap });
  }

  async function importFile(file: File) {
    try {
      const json = JSON.parse(await file.text());
      if (!confirm("Replace ALL current data with this backup? This can't be undone.")) return;
      const res = await send<{ imported: Record<string, number> }>("POST", "/api/backup", json);
      toast(`Restored ${res?.imported.tasks ?? 0} tasks`);
      qc.invalidateQueries();
      invalidateTaskViews(qc);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <Section title="Appearance">
        <div className="p-3">
          <Segmented
            className="w-full"
            value={theme}
            onChange={chooseTheme}
            options={[
              { value: "light", label: <span className="flex items-center justify-center gap-1.5"><Sun className="size-4" /> Light</span> },
              { value: "dark", label: <span className="flex items-center justify-center gap-1.5"><Moon className="size-4" /> Dark</span> },
              { value: "system", label: <span className="flex items-center justify-center gap-1.5"><Laptop className="size-4" /> System</span> },
            ]}
          />
        </div>
      </Section>

      <Section title="Day" hint="Times are Asia/Karachi. Before the day-start hour, it still counts as the previous day.">
        <Row label="Available hours" hint="Warns when today's estimates exceed this">
          <NumberInput value={s.available_hours} min={0.5} max={18} step={0.5} suffix="h" onCommit={(n) => save({ available_hours: n })} />
        </Row>
        <Row label="Day starts at">
          <select className="input w-28" value={s.day_start_hour} onChange={(e) => save({ day_start_hour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Midnight" : `${h}:00 am`}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Evening reflection from">
          <select className="input w-28" value={s.reflection_hour} onChange={(e) => save({ reflection_hour: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
              <option key={h} value={h}>
                {h > 12 ? `${h - 12}:00 pm` : "12:00 pm"}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Focus timer">
        <Row label="Focus">
          <NumberInput value={s.pomodoro_focus} min={1} max={120} suffix="min" onCommit={(n) => save({ pomodoro_focus: n })} />
        </Row>
        <Row label="Short break">
          <NumberInput value={s.pomodoro_break} min={1} max={60} suffix="min" onCommit={(n) => save({ pomodoro_break: n })} />
        </Row>
        <Row label="Long break">
          <NumberInput value={s.pomodoro_long_break} min={1} max={60} suffix="min" onCommit={(n) => save({ pomodoro_long_break: n })} />
        </Row>
        <Row label="Long break every">
          <NumberInput value={s.pomodoro_cycles} min={1} max={12} suffix="blocks" onCommit={(n) => save({ pomodoro_cycles: n })} />
        </Row>
      </Section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="section-title">Areas</h2>
          <button className="text-xs font-medium text-primary" onClick={() => setEditingArea("new")}>
            <Plus className="mr-0.5 inline size-3.5" /> Add area
          </button>
        </div>
        <div className="card divide-y divide-line">
          {boot.areas.map((a) => {
            const Icon = AREA_ICONS[a.icon] ?? AREA_ICONS.circle;
            return (
              <div key={a.id} className={clsx("flex items-center gap-3 px-4 py-2.5", a.archived && "opacity-50")}>
                <button onClick={() => setEditingArea(a)} className="flex flex-1 items-center gap-3 text-left">
                  <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${a.color}1f`, color: a.color }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{a.name}</span>
                  {a.archived && <span className="text-xs text-muted">Archived</span>}
                </button>
                <button onClick={() => toggleArchive(a)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label={a.archived ? `Restore ${a.name}` : `Archive ${a.name}`}>
                  {a.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Section title="Backup" hint="Exports everything as JSON. Importing replaces all current data.">
        <a href="/api/backup" download className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:bg-surface-2">
          <Download className="size-4 text-primary" /> Export backup
        </a>
        <button onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-surface-2">
          <Upload className="size-4 text-primary" /> Import backup…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </Section>

      <Section title="Security">
        <button onClick={() => setChangingPassword(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-surface-2">
          <KeyRound className="size-4 text-primary" /> Change password
        </button>
      </Section>

      {changingPassword && <PasswordSheet onClose={() => setChangingPassword(false)} />}
      {editingArea && <AreaSheet area={editingArea === "new" ? null : editingArea} onClose={() => setEditingArea(null)} />}
    </div>
  );
}

function AreaSheet({ area, onClose }: { area: Area | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(area?.name ?? "");
  const [color, setColor] = useState(area?.color ?? AREA_COLORS[0]);
  const [icon, setIcon] = useState(area?.icon ?? "circle");

  async function save() {
    onClose();
    try {
      if (area) await send("PATCH", `/api/areas/${area.id}`, { name: name.trim(), color, icon });
      else await send("POST", "/api/areas", { name: name.trim(), color, icon });
    } catch (e) {
      toast((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: keys.bootstrap });
  }

  async function remove() {
    if (!area || !confirm(`Delete "${area.name}"? Its tasks and goals stay, without an area. Archiving keeps history tidier.`)) return;
    onClose();
    await send("DELETE", `/api/areas/${area.id}`);
    qc.invalidateQueries({ queryKey: keys.bootstrap });
    invalidateTaskViews(qc);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={area ? "Edit area" : "New area"}
      footer={
        <div className="flex gap-2">
          {area && (
            <button className="btn-ghost text-danger" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </button>
          )}
          <button className="btn-primary ml-auto" disabled={!name.trim()} onClick={save}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <input className="input text-base font-medium" placeholder="Area name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!area} maxLength={40} />
        <div>
          <p className="label">Color</p>
          <div className="flex flex-wrap gap-2">
            {AREA_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
                className={clsx("size-8 rounded-full transition", c === color && "ring-2 ring-fg ring-offset-2 ring-offset-surface")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="label">Icon</p>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(AREA_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                onClick={() => setIcon(key)}
                aria-label={key}
                aria-pressed={key === icon}
                className={clsx("grid h-10 place-items-center rounded-xl border transition", key === icon ? "border-primary bg-primary-soft" : "border-line")}
                style={{ color }}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const valid = current && password.length >= 8 && password === confirm;

  async function save() {
    setError("");
    try {
      await send("POST", "/api/auth/password", { current, password });
      onClose();
      toast("Password changed");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change password"
      footer={
        <button className="btn-primary w-full" disabled={!valid} onClick={save}>
          Save new password
        </button>
      }
    >
      <div className="space-y-3 pt-1">
        <input className="input" type="password" autoComplete="current-password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {password && confirm && password !== confirm && <p className="text-sm text-danger">The new passwords don&apos;t match.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
