import { NextResponse } from "next/server";
import { needsSetup, sessionExpiry } from "@/lib/server/auth";

/** Public: tells the login page whether to show "create your password", or skip it entirely. */
export async function GET(req: Request) {
  const [setup, exp] = await Promise.all([needsSetup(), sessionExpiry(req)]);
  return NextResponse.json({ setup, signedIn: exp !== null }, { headers: { "Cache-Control": "no-store" } });
}
