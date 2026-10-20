// Database access. In the app this is Cloudflare D1 (async SQLite); tests and scripts plug in a
// local SQLite file through `setDb`. The schema lives in /migrations.

export type Params = unknown[] | Record<string, unknown>;
export type Stmt = { sql: string; params?: Params };
export type RunResult = { lastId: number; changes: number };

export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T | undefined>;
  run(sql: string, params?: Params): Promise<RunResult>;
  /** Runs all statements atomically, in order. */
  batch(stmts: Stmt[]): Promise<RunResult[]>;
}

export const TABLES = [
  "areas",
  "goals",
  "milestones",
  "recurrences",
  "tasks",
  "carry_log",
  "progress_logs",
  "focus_sessions",
  "day_logs",
  "weekly_reviews",
  "settings",
] as const;

/**
 * D1 only supports positional parameters, so `@name` placeholders are rewritten to `?`.
 * Booleans become 0/1 and undefined becomes NULL.
 */
export function toPositional(sql: string, params?: Params): [string, unknown[]] {
  const norm = (v: unknown) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
  if (!params) return [sql, []];
  if (Array.isArray(params)) return [sql, params.map(norm)];
  const values: unknown[] = [];
  const text = sql.replace(/@(\w+)/g, (_, name: string) => {
    values.push(norm(params[name]));
    return "?";
  });
  return [text, values];
}

type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): D1StmtLike };
  batch(stmts: D1StmtLike[]): Promise<{ meta: { last_row_id: number; changes: number } }[]>;
};
type D1StmtLike = {
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { last_row_id: number; changes: number } }>;
};

export function d1Adapter(d1: D1Like): Db {
  const prep = (sql: string, params?: Params) => {
    const [text, values] = toPositional(sql, params);
    return d1.prepare(text).bind(...values);
  };
  const meta = (m: { last_row_id: number; changes: number }) => ({ lastId: Number(m.last_row_id), changes: m.changes });
  return {
    all: async (sql, params) => (await prep(sql, params).all<never>()).results,
    get: async (sql, params) => (await prep(sql, params).first<never>()) ?? undefined,
    run: async (sql, params) => meta((await prep(sql, params).run()).meta),
    batch: async (stmts) => (stmts.length ? (await d1.batch(stmts.map((s) => prep(s.sql, s.params)))).map((r) => meta(r.meta)) : []),
  };
}

let override: Db | null = null;

/** Tests and scripts use this to point the server code at a local SQLite file. */
export function setDb(db: Db | null) {
  override = db;
}

export async function db(): Promise<Db> {
  if (override) return override;
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as { DB?: D1Like }).DB;
  if (!binding) throw new Error("D1 binding `DB` is missing. Check wrangler.jsonc.");
  return d1Adapter(binding);
}

/** Converts SQLite 0/1 columns to booleans. */
export function bools<T>(row: T, keys: string[]): T {
  const out = { ...(row as Record<string, unknown>) };
  for (const k of keys) if (k in out) out[k] = Boolean(out[k]);
  return out as T;
}
