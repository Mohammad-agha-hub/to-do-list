// Deletes the database and recreates an empty one with the default areas.
import "dotenv/config";
import fs from "node:fs";
import { dbPath, openDb } from "../src/lib/server/db";

export function resetDatabase() {
  const file = dbPath();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  openDb(file).close();
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Reset ${resetDatabase()}`);
}
