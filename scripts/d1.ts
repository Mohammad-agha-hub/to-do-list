// Helpers for loading data into D1 (local dev database or the deployed one).
import type Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TABLES } from "../src/lib/server/db";

const sqlValue = (v: unknown) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

/** SQL that replaces every table's contents with what's in `conn`. */
export function dumpSql(conn: Database.Database): string {
  const out = ["PRAGMA defer_foreign_keys = ON;"];
  for (const t of [...TABLES].reverse()) out.push(`DELETE FROM ${t};`);
  for (const t of TABLES) {
    for (const row of conn.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[]) {
      const cols = Object.keys(row);
      out.push(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => sqlValue(row[c])).join(", ")});`);
    }
  }
  return out.join("\n") + "\n";
}

export function wrangler(...args: string[]) {
  execFileSync("sh", ["scripts/node22.sh", "node_modules/wrangler/bin/wrangler.js", ...args], { stdio: "inherit" });
}

/** Runs SQL against the D1 database: `--local` (default) or `--remote` (the deployed app). */
export function applyToD1(sql: string, remote: boolean) {
  const file = path.join(".wrangler", "momentum-load.sql");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sql);
  wrangler("d1", "migrations", "apply", "DB", remote ? "--remote" : "--local");
  wrangler("d1", "execute", "DB", remote ? "--remote" : "--local", `--file=${file}`, "-y");
  fs.rmSync(file);
}

export const isRemote = () => process.argv.includes("--remote");
