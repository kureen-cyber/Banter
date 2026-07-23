import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/local/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
