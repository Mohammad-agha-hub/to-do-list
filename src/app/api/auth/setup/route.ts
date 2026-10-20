import { NextResponse } from "next/server";
import { z } from "zod";
import { MIN_PASSWORD, createPassword, createSessionToken, sessionCookie } from "@/lib/server/auth";

const Body = z.object({ password: z.string().min(MIN_PASSWORD).max(200) });

/** Public, first run only: creates the password. Refused once a password exists. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Use at least ${MIN_PASSWORD} characters` }, { status: 400 });
  if (!(await createPassword(parsed.data.password))) {
    return NextResponse.json({ error: "A password is already set" }, { status: 409 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(await createSessionToken()));
  return res;
}
