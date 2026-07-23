import { getCurrentProfile } from "@/lib/local/auth";
import {
  listChannels,
  listConversations,
  unreadCount,
} from "@/lib/local/queries";

export async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) return { user: null, profile: null };
  return { user: { id: profile.id }, profile };
}

export async function getChannels() {
  return listChannels();
}

export async function getConversationsFor(userId: string) {
  return listConversations(userId);
}

export async function getUnreadCount(userId: string) {
  return unreadCount(userId);
}
