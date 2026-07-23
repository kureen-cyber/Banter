import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import { linkGithubHandle } from "@/lib/local/identity";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { githubHandle?: string };
    const updated = await linkGithubHandle(
      profile.id,
      body.githubHandle ?? "",
    );
    return NextResponse.json({ profile: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not link GitHub";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
