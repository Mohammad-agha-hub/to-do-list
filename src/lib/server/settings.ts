import { db } from "./db";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "@/lib/shared/schemas";
import { logicalDate } from "@/lib/shared/dates";

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'meta:%'").all() as { key: string; value: string }[];
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.key] = JSON.parse(r.value);
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const upsert = db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db().transaction(() => {
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) upsert.run(k, JSON.stringify(v));
  })();
  return getSettings();
}

export function getMeta(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(`meta:${key}`) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setMeta(key: string, value: string) {
  db()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`meta:${key}`, value);
}

/** Today's logical date, respecting the day-start hour. */
export function today(at = new Date()): string {
  return logicalDate(at, getSettings().day_start_hour);
}
