// Wipes all data (in place, so a running server keeps working) and restores the default areas.
import "dotenv/config";
import { TABLES, dbPath, openDb } from "../src/lib/server/db";

export function resetDatabase() {
  const file = dbPath();
  const conn = openDb(file);
  conn.pragma("foreign_keys = OFF");
  conn.transaction(() => {
    for (const t of TABLES) conn.exec(`DROP TABLE IF EXISTS ${t}`);
  })();
  conn.pragma("foreign_keys = ON");
  conn.close();
  openDb(file).close(); // recreates the schema and default areas
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Reset ${resetDatabase()}`);
}
