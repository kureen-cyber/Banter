import { notFound, redirect } from "next/navigation";
import { ChatPane } from "@/components/chat-pane";
import { requireUser } from "@/lib/data";
import {
  canPostToChannel,
  getChannel,
  getMemberRole,
  joinChannel,
  listMessages,
} from "@/lib/local/queries";

type Props = { params: Promise<{ channelId: string }> };

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params;
  const { user, profile } = await requireUser();
  if (!user || !profile) redirect("/login");

  const channel = await getChannel(channelId);
  if (!channel || channel.archived_at) notFound();

  await joinChannel(channelId, user.id);
  const [messages, postCheck, role] = await Promise.all([
    listMessages({ channelId }),
    canPostToChannel(channelId, user.id),
    getMemberRole(channelId, user.id),
  ]);

  const canManage = role === "owner" || role === "admin";

  return (
    <ChatPane
      currentUser={profile}
      channelId={channelId}
      title={`# ${channel.name}`}
      subtitle={channel.description ?? undefined}
      initialMessages={messages}
      canPost={postCheck.ok}
      canManageChannel={canManage}
      channelSlug={channel.slug}
    />
  );
}
