import { notFound, redirect } from "next/navigation";
import { ChatPane } from "@/components/chat-pane";
import { requireUser } from "@/lib/data";
import {
  getConversationOther,
  listMessages,
  markConversationRead,
} from "@/lib/local/queries";

type Props = { params: Promise<{ conversationId: string }> };

export default async function DmPage({ params }: Props) {
  const { conversationId } = await params;
  const { user, profile } = await requireUser();
  if (!user || !profile) redirect("/login");

  let membership = await getConversationOther(conversationId, user.id);
  if (!membership) {
    // Brief wait + fresh re-read if create just landed on another isolate.
    await new Promise((r) => setTimeout(r, 200));
    membership = await getConversationOther(conversationId, user.id);
  }
  if (!membership) notFound();

  await markConversationRead(conversationId, user.id);
  const messages = await listMessages({ conversationId });
  const otherUser = membership.other_user;

  return (
    <ChatPane
      currentUser={profile}
      conversationId={conversationId}
      title={otherUser?.display_name ?? "Direct message"}
      subtitle={otherUser?.email}
      initialMessages={messages}
    />
  );
}
