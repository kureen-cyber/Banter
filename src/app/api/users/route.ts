import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import { searchUsers, startConversation } from "@/lib/local/queries";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const users = await searchUsers(q, profile.id);
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { userId?: string };
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const conversationId = await startConversation(profile.id, body.userId);
  return NextResponse.json({ conversationId });
}
