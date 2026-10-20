import { db } from "./db";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "@/lib/shared/schemas";
import { logicalDate } from "@/lib/shared/dates";

const UPSERT = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";

export async function getSettings(): Promise<Settings> {
  const rows = await (await db()).all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key NOT LIKE 'meta:%'");
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.key] = JSON.parse(r.value);
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await (await db()).batch(
    Object.entries(patch)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => ({ sql: UPSERT, params: [k, JSON.stringify(v)] })),
  );
  return getSettings();
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await (await db()).get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [`meta:${key}`]);
  return row ? row.value : null;
}

export function setMetaStmt(key: string, value: string) {
  return { sql: UPSERT, params: [`meta:${key}`, value] };
}

export async function setMeta(key: string, value: string) {
  const s = setMetaStmt(key, value);
  await (await db()).run(s.sql, s.params);
}

/** Today's logical date, respecting the day-start hour. */
export async function today(at = new Date()): Promise<string> {
  return logicalDate(at, (await getSettings()).day_start_hour);
}
