import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  appendBanterlinaMessages,
  askBanterlina,
  clearBanterlinaMessages,
  listBanterlinaMessages,
} from "@/lib/banterlina";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messages = await listBanterlinaMessages(profile.id);
  return NextResponse.json({ messages });
}

export async function DELETE() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearBanterlinaMessages(profile.id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const history = await listBanterlinaMessages(profile.id);
  try {
    const reply = await askBanterlina(
      history.map((m) => ({ role: m.role, content: m.content })),
      message,
    );
    const created = await appendBanterlinaMessages(profile.id, [
      { role: "user", content: message },
      { role: "assistant", content: reply },
    ]);
    return NextResponse.json({
      userMessage: created[0],
      assistantMessage: created[1],
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Banterlina failed";
    return NextResponse.json({ error }, { status: 502 });
  }
}
