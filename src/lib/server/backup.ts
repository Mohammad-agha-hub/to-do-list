import { z } from "zod";
import { TABLES, db, type Stmt } from "./db";
import { HttpError } from "./http";

export const BackupFile = z.object({
  app: z.literal("momentum"),
  version: z.literal(1),
  exported_at: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export async function exportBackup() {
  const conn = await db();
  const rows = await Promise.all(TABLES.map((t) => conn.all(`SELECT * FROM ${t}`)));
  const tables = Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
  return { app: "momentum" as const, version: 1 as const, exported_at: new Date().toISOString(), tables };
}

// D1 allows at most 100 bound parameters per statement.
const MAX_PARAMS = 100;

/** Replaces all data with the backup's contents, in one atomic batch. */
export async function importBackup(file: z.infer<typeof BackupFile>) {
  const unknown = Object.keys(file.tables).filter((t) => !(TABLES as readonly string[]).includes(t));
  if (unknown.length) throw new HttpError(400, `Unknown tables: ${unknown.join(", ")}`);

  const conn = await db();
  const stmts: Stmt[] = [{ sql: "PRAGMA defer_foreign_keys = ON" }];
  for (const t of [...TABLES].reverse()) stmts.push({ sql: `DELETE FROM ${t}` });

  for (const t of TABLES) {
    const rows = file.tables[t] ?? [];
    if (!rows.length) continue;
    const columns = (await conn.all<{ name: string }>(`SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name);
    const cols = columns.filter((c) => rows.some((r) => c in r));
    // Multi-row inserts, chunked to stay under the parameter limit.
    const perStmt = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
    for (let i = 0; i < rows.length; i += perStmt) {
      const chunk = rows.slice(i, i + perStmt);
      stmts.push({
        sql: `INSERT INTO ${t} (${cols.join(", ")}) VALUES ${chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ")}`,
        params: chunk.flatMap((r) => cols.map((c) => (r[c] === undefined ? null : r[c]))),
      });
    }
  }
  await conn.batch(stmts);
  return Object.fromEntries(TABLES.map((t) => [t, (file.tables[t] ?? []).length]));
}
