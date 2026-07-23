import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  getChannels,
  getConversationsFor,
  getUnreadCount,
  requireUser,
} from "@/lib/data";
import { clearSessionCookie } from "@/lib/local/auth";
import { touchPresence } from "@/lib/local/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireUser();
  if (!user || !profile) {
    // Break redirect loops from stale JWTs (cookie valid, user gone from DB)
    await clearSessionCookie();
    redirect("/login");
  }

  const [channels, conversations, unread] = await Promise.all([
    getChannels(),
    getConversationsFor(user.id),
    getUnreadCount(user.id),
    touchPresence(user.id),
  ]);

  return (
    <AppShell
      profile={profile}
      channels={channels}
      conversations={conversations}
      unreadCount={unread}
    >
      {children}
    </AppShell>
  );
}
