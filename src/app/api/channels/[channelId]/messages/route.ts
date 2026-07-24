import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  canPostToChannel,
  createMessage,
  getChannel,
  joinChannel,
  listMessages,
} from "@/lib/local/queries";

type Params = { params: Promise<{ channelId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  if (!channel || channel.archived_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await joinChannel(channelId, profile.id);
  const [messages, postCheck] = await Promise.all([
    listMessages({ channelId }),
    canPostToChannel(channelId, profile.id),
  ]);
  return NextResponse.json({
    channel,
    messages,
    canPost: postCheck.ok,
  });
}

export async function POST(request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  if (!channel || channel.archived_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json()) as {
    body?: string;
    parentId?: string | null;
  };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  await joinChannel(channelId, profile.id);
  const allowed = await canPostToChannel(channelId, profile.id);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason }, { status: 403 });
  }

  const message = await createMessage({
    senderId: profile.id,
    body: body.body,
    channelId,
    parentId: body.parentId ?? null,
  });
  return NextResponse.json({ message });
}
