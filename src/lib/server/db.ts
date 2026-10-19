import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('task_based','numeric')),
  target_value REAL,
  current_value REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','abandoned')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurrences (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  rule TEXT NOT NULL,
  estimate_min INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  estimate_min INTEGER,
  actual_min INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  scheduled_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done','skipped')),
  is_top3 INTEGER NOT NULL DEFAULT 0,
  carried_over_count INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  completed_date TEXT,
  recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS tasks_scheduled ON tasks(scheduled_date, status);
CREATE INDEX IF NOT EXISTS tasks_completed ON tasks(completed_date);
CREATE INDEX IF NOT EXISTS tasks_goal ON tasks(goal_id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_day ON tasks(recurrence_id, scheduled_date) WHERE recurrence_id IS NOT NULL;

-- Each time an unfinished task rolls from one day to the next.
CREATE TABLE IF NOT EXISTS carry_log (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS carry_from ON carry_log(from_date);

CREATE TABLE IF NOT EXISTS progress_logs (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  delta REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_min REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS day_logs (
  date TEXT PRIMARY KEY,
  top3_done INTEGER NOT NULL DEFAULT 0,
  top3_count INTEGER NOT NULL DEFAULT 0,
  reflection TEXT NOT NULL DEFAULT '',
  energy INTEGER,
  mood INTEGER
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  week_start TEXT PRIMARY KEY,
  wins TEXT NOT NULL DEFAULT '',
  slipped TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  next_week_focus TEXT NOT NULL DEFAULT '',
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

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

export const DEFAULT_AREAS = [
  { name: "School", color: "#3b82f6", icon: "graduation-cap" },
  { name: "Hazara Kids", color: "#f59e0b", icon: "clapperboard" },
  { name: "Clients", color: "#8b5cf6", icon: "briefcase" },
  { name: "Mehwar", color: "#10b981", icon: "compass" },
  { name: "German", color: "#ef4444", icon: "languages" },
  { name: "Fitness", color: "#06b6d4", icon: "dumbbell" },
  { name: "Personal", color: "#ec4899", icon: "heart" },
];

export function dbPath(): string {
  return path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "momentum.db"));
}

export function openDb(file = dbPath()): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM areas").get() as { n: number };
  if (n === 0) seedAreas(db);
  return db;
}

export function seedAreas(db: Database.Database) {
  const insert = db.prepare("INSERT INTO areas (name, color, icon, sort_order) VALUES (?, ?, ?, ?)");
  DEFAULT_AREAS.forEach((a, i) => insert.run(a.name, a.color, a.icon, i));
}

const globalForDb = globalThis as unknown as { __momentumDb?: Database.Database };

export function db(): Database.Database {
  if (!globalForDb.__momentumDb) globalForDb.__momentumDb = openDb();
  return globalForDb.__momentumDb;
}

/** Converts SQLite 0/1 columns to booleans. */
export function bools<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) if (k in out) out[k] = Boolean(out[k]);
  return out as T;
}
