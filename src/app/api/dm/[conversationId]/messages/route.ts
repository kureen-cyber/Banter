import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  createMessage,
  getConversationOther,
  listMessages,
  markConversationRead,
} from "@/lib/local/queries";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { conversationId } = await params;
  const membership = await getConversationOther(conversationId, profile.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await markConversationRead(conversationId, profile.id);
  const messages = await listMessages({ conversationId });
  return NextResponse.json({
    other_user: membership.other_user,
    messages,
  });
}

export async function POST(request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { conversationId } = await params;
  const membership = await getConversationOther(conversationId, profile.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json()) as {
    body?: string;
    parentId?: string | null;
  };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  const message = await createMessage({
    senderId: profile.id,
    body: body.body,
    conversationId,
    parentId: body.parentId ?? null,
  });
  return NextResponse.json({ message });
}
