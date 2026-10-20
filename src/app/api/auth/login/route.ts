import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_DAYS, checkPassword, createSessionToken } from "@/lib/server/auth";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(await checkPassword(parsed.data.password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
