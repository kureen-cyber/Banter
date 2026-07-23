import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  listChannels,
  listConversations,
  unreadCount,
} from "@/lib/local/queries";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [channels, conversations, unread] = await Promise.all([
    listChannels(),
    listConversations(profile.id),
    unreadCount(profile.id),
  ]);

  return NextResponse.json({
    profile,
    channels,
    conversations,
    unreadCount: unread,
  });
}
