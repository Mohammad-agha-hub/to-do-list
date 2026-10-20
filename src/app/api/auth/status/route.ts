import { NextResponse } from "next/server";
import { needsSetup } from "@/lib/server/auth";

/** Public: tells the login page whether to show "create your password". */
export async function GET() {
  return NextResponse.json({ setup: await needsSetup() }, { headers: { "Cache-Control": "no-store" } });
}
