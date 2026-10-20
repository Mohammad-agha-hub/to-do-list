import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDb } from "./db";
import { openSqlite } from "./sqlite";
import { changePassword, checkPassword, createPassword, createSessionToken, needsSetup, shouldRenew, verifySessionToken } from "./auth";

const { conn, db } = openSqlite();
const env = process.env as Record<string, string | undefined>;
const before = { NODE_ENV: env.NODE_ENV, APP_PASSWORD: env.APP_PASSWORD, SESSION_SECRET: env.SESSION_SECRET };

beforeAll(() => {
  setDb(db);
  // Behave like the deployed app: no env secrets, production mode.
  env.NODE_ENV = "production";
  delete env.APP_PASSWORD;
  delete env.SESSION_SECRET;
});
afterAll(() => {
  Object.assign(env, before);
  setDb(null);
  conn.close();
});

describe("first-run password", () => {
  it("asks for setup until a password exists, and nothing logs in before that", async () => {
    expect(await needsSetup()).toBe(true);
    expect(await checkPassword("anything")).toBe(false);
  });

  it("only the first setup wins", async () => {
    expect(await createPassword("correct horse")).toBe(true);
    expect(await createPassword("attacker pass")).toBe(false);
    expect(await needsSetup()).toBe(false);
    expect(await checkPassword("correct horse")).toBe(true);
    expect(await checkPassword("attacker pass")).toBe(false);
  });

  it("never stores the password in plain text", () => {
    const row = conn.prepare("SELECT value FROM settings WHERE key = 'meta:password_hash'").get() as { value: string };
    expect(row.value).toMatch(/^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(row.value).not.toContain("correct horse");
  });

  it("can change the password", async () => {
    await changePassword("battery staple");
    expect(await checkPassword("correct horse")).toBe(false);
    expect(await checkPassword("battery staple")).toBe(true);
  });

  it("signs sessions with a generated key and rejects tampering", async () => {
    const token = await createSessionToken();
    const exp = await verifySessionToken(token);
    expect(exp).toBeGreaterThan(Date.now() + 390 * 86_400_000); // remembered for about a year
    expect(shouldRenew(exp!)).toBe(false);
    expect(shouldRenew(Date.now() + 100 * 86_400_000)).toBe(true);
    const [e, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(e) + 1}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${e}.x${sig.slice(1)}`)).toBeNull();
    const secret = conn.prepare("SELECT value FROM settings WHERE key = 'meta:session_secret'").get() as { value: string };
    expect(secret.value).toMatch(/^[0-9a-f]{64}$/);
  });
});
