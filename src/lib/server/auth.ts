// Single-user session: a signed, expiring token in an httpOnly cookie.
// Uses Web Crypto so it runs the same on Node and on Cloudflare Workers.

export const SESSION_COOKIE = "momentum_session";
export const SESSION_DAYS = 60;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return "dev-only-secret";
  }
  return s;
}

function toBase64Url(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${exp}.${await sign(exp)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !safeEqual(sig, await sign(exp))) return false;
  return Number(exp) > Date.now();
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? (process.env.NODE_ENV === "production" ? null : "momentum");
  if (!expected) return false;
  // Compare HMACs so timing doesn't depend on where the strings differ.
  return safeEqual(await sign(`pw:${input}`), await sign(`pw:${expected}`));
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  return verifySessionToken(readCookie(req, SESSION_COOKIE));
}
