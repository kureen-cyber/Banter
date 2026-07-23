import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/local/auth";

/** Clears a stale session cookie then sends the user to login (Route Handler only). */
export async function GET(request: Request) {
  await clearSessionCookie();
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "session_reset");
  return NextResponse.redirect(url);
}
