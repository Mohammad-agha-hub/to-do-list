import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, createSessionToken, sessionCookie } from "@/lib/server/auth";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(await checkPassword(parsed.data.password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(await createSessionToken()));
  return res;
}
