// Local SQLite implementation of the Db interface, for tests and scripts only.
// The app itself never imports this (it runs on D1), so better-sqlite3 stays out of the Worker bundle.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { toPositional, type Db } from "./db";

export function applyMigrations(conn: Database.Database) {
  const dir = path.join(process.cwd(), "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    conn.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
}

export function sqliteAdapter(conn: Database.Database): Db {
  conn.pragma("foreign_keys = ON");
  const run = (sql: string, params?: unknown) => {
    const [text, values] = toPositional(sql, params as never);
    const info = conn.prepare(text).run(...values);
    return { lastId: Number(info.lastInsertRowid), changes: info.changes };
  };
  return {
    all: async (sql, params) => {
      const [text, values] = toPositional(sql, params);
      return conn.prepare(text).all(...values) as never[];
    },
    get: async (sql, params) => {
      const [text, values] = toPositional(sql, params);
      return conn.prepare(text).get(...values) as never;
    },
    run: async (sql, params) => run(sql, params),
    batch: async (stmts) => conn.transaction(() => stmts.map((s) => run(s.sql, s.params)))(),
  };
}

/** A fresh in-memory (or file) database with the schema applied. */
export function openSqlite(file = ":memory:") {
  const conn = new Database(file);
  applyMigrations(conn);
  return { conn, db: sqliteAdapter(conn) };
}
