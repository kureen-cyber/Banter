import { notFound, redirect } from "next/navigation";
import { ChatPane } from "@/components/chat-pane";
import { requireUser } from "@/lib/data";
import {
  getChannel,
  joinChannel,
  listMessages,
} from "@/lib/local/queries";

type Props = { params: Promise<{ channelId: string }> };

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params;
  const { user, profile } = await requireUser();
  if (!user || !profile) redirect("/login");

  const channel = await getChannel(channelId);
  if (!channel) notFound();

  await joinChannel(channelId, user.id);
  const messages = await listMessages({ channelId });

  return (
    <ChatPane
      currentUser={profile}
      channelId={channelId}
      title={`# ${channel.name}`}
      subtitle={channel.description ?? undefined}
      initialMessages={messages}
    />
  );
}
