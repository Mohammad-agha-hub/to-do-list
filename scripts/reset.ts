// Wipes all data and restores the default areas.
//   npm run reset             → local dev database
//   npm run reset -- --remote → the deployed app (asks for confirmation)
import { createInterface } from "node:readline/promises";
import { openSqlite } from "../src/lib/server/sqlite";
import { applyToD1, dumpSql, isRemote } from "./d1";

const remote = isRemote();
if (remote) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("This deletes ALL data in the deployed Momentum app. Type 'delete' to continue: ");
  rl.close();
  if (answer.trim() !== "delete") process.exit(1);
}
const { conn } = openSqlite();
applyToD1(dumpSql(conn), remote);
console.log(`Reset ${remote ? "deployed" : "local"} database.`);
