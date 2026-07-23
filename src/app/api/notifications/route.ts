import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/local/auth";
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/local/queries";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notifications = await listNotifications(profile.id);
  return NextResponse.json({ notifications });
}

export async function PATCH() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markNotificationsRead(profile.id);
  return NextResponse.json({ ok: true });
}
