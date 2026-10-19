import { z } from "zod";
import { TABLES, db } from "./db";
import { HttpError } from "./http";

export const BackupFile = z.object({
  app: z.literal("momentum"),
  version: z.literal(1),
  exported_at: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export function exportBackup() {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = db().prepare(`SELECT * FROM ${t}`).all();
  return { app: "momentum" as const, version: 1 as const, exported_at: new Date().toISOString(), tables };
}

/** Replaces all data with the backup's contents, in one transaction. */
export function importBackup(file: z.infer<typeof BackupFile>) {
  const unknown = Object.keys(file.tables).filter((t) => !(TABLES as readonly string[]).includes(t));
  if (unknown.length) throw new HttpError(400, `Unknown tables: ${unknown.join(", ")}`);

  const conn = db();
  conn.pragma("foreign_keys = OFF");
  try {
    conn.transaction(() => {
      for (const t of [...TABLES].reverse()) conn.prepare(`DELETE FROM ${t}`).run();
      for (const t of TABLES) {
        const rows = file.tables[t] ?? [];
        if (!rows.length) continue;
        const columns = (conn.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
        for (const row of rows) {
          const cols = Object.keys(row).filter((c) => columns.includes(c));
          conn.prepare(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => "@" + c).join(", ")})`).run(
            Object.fromEntries(cols.map((c) => [c, row[c] as never])),
          );
        }
      }
      const violations = conn.pragma("foreign_key_check") as unknown[];
      if (violations.length) throw new HttpError(400, "Backup has broken references");
    })();
  } finally {
    conn.pragma("foreign_keys = ON");
  }
  return Object.fromEntries(TABLES.map((t) => [t, (file.tables[t] ?? []).length]));
}
