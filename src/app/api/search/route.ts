import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import { searchMessages } from "@/lib/local/queries";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const messages = await searchMessages(q);
  return NextResponse.json({ messages, q });
}
