import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import { createChannel, listChannels } from "@/lib/local/queries";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const channels = await listChannels();
  return NextResponse.json({ channels });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const channel = await createChannel({
      name: body.name,
      description: body.description,
      createdBy: profile.id,
    });
    return NextResponse.json({ channel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
