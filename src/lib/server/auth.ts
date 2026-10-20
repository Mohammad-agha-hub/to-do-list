// Single-user auth: a signed, expiring token in an httpOnly cookie.
//
// Nothing has to be configured on the server. The signing key is generated on first use and
// kept in the database; the password is created by the user on first visit and stored only as a
// salted PBKDF2 hash. APP_PASSWORD / SESSION_SECRET env vars still override both if set.
// Uses Web Crypto so it runs the same on Node and on Cloudflare Workers.

import { db } from "./db";

export const SESSION_COOKIE = "momentum_session";
// "Remember this device": sessions last ~a year (Chrome caps cookies at 400 days) and are renewed
// while you use the app, so a signed-in device stays signed in until you sign out.
export const SESSION_DAYS = 395;
const RENEW_AFTER_DAYS = 7;
export const MIN_PASSWORD = 8;

const enc = new TextEncoder();
// Kept modest: Workers on the free plan get ~10ms of CPU per request.
const PBKDF2_ITERATIONS = 10_000;

function hex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readMeta(key: string): Promise<string | null> {
  const row = await (await db()).get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [`meta:${key}`]);
  return row?.value ?? null;
}

/** Inserts only if missing, then reads back, so concurrent first requests agree on one value. */
async function readOrCreateMeta(key: string, create: () => string): Promise<string> {
  const conn = await db();
  await conn.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [`meta:${key}`, create()]);
  return (await readMeta(key))!;
}

let cachedSecret: string | null = null;
async function secret(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  cachedSecret ??= await readOrCreateMeta("session_secret", () => hex(crypto.getRandomValues(new Uint8Array(32))));
  return cachedSecret;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(await secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${exp}.${await sign(exp)}`;
}

/** Returns the session's expiry (ms) if the token is valid, otherwise null. */
export async function verifySessionToken(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !safeEqual(sig, await sign(exp))) return null;
  return Number(exp) > Date.now() ? Number(exp) : null;
}

/** True when a valid session is old enough that it should be re-issued with a fresh expiry. */
export function shouldRenew(exp: number): boolean {
  return exp - Date.now() < (SESSION_DAYS - RENEW_AFTER_DAYS) * 86_400_000;
}

// ---------- Password ----------

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return hex(bits);
}

/** Stored as "pbkdf2$<iterations>$<salt>$<hash>". */
async function hashPassword(password: string): Promise<string> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}

function envPassword(): string | null {
  return process.env.APP_PASSWORD ?? null;
}

/** True when no password exists yet and the first visitor should create one. */
export async function needsSetup(): Promise<boolean> {
  if (envPassword() || process.env.NODE_ENV !== "production") return false;
  return !(await readMeta("password_hash"));
}

export async function checkPassword(input: string): Promise<boolean> {
  const stored = await readMeta("password_hash");
  if (stored) {
    const [, iter, salt, hash] = stored.split("$");
    return safeEqual(await pbkdf2(input, salt, Number(iter)), hash);
  }
  // In development without a stored password, "momentum" works so local setup stays simple.
  const expected = envPassword() ?? (process.env.NODE_ENV === "production" ? null : "momentum");
  if (!expected) return false;
  // Compare HMACs so timing doesn't depend on where the strings differ.
  return safeEqual(await sign(`pw:${input}`), await sign(`pw:${expected}`));
}

/** First-run: stores the password only if none exists. Returns false if someone already set one. */
export async function createPassword(password: string): Promise<boolean> {
  if (!(await needsSetup())) return false;
  const { changes } = await (await db()).run("INSERT OR IGNORE INTO settings (key, value) VALUES ('meta:password_hash', ?)", [
    await hashPassword(password),
  ]);
  return changes === 1;
}

export async function changePassword(password: string) {
  await (await db()).run(
    "INSERT INTO settings (key, value) VALUES ('meta:password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [await hashPassword(password)],
  );
}

// ---------- Requests ----------

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
}

export async function sessionExpiry(req: Request): Promise<number | null> {
  return verifySessionToken(readCookie(req, SESSION_COOKIE));
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}
