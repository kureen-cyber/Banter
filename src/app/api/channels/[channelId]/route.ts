import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  archiveChannel,
  getChannel,
  updateChannel,
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
  return NextResponse.json({ channel });
}

export async function PATCH(request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { channelId } = await params;
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    const channel = await updateChannel(channelId, profile.id, body);
    return NextResponse.json({ channel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = /admin/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { channelId } = await params;
  try {
    const channel = await archiveChannel(channelId, profile.id);
    return NextResponse.json({ channel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Archive failed";
    const status = /admin|cannot/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
