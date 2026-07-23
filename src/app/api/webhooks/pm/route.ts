import { NextResponse } from "next/server";
import { newId, updateDb } from "@/lib/local/db";
import { pmTaskDeepLink } from "@/lib/pm";
import type { NotificationType, PmWebhookEvent } from "@/lib/types";

/**
 * Optional PM integration — wire this later when the PM auth/API is known.
 * Banter runs fully without calling this endpoint.
 */
function mapEvent(event: PmWebhookEvent["event"]): NotificationType {
  switch (event) {
    case "task.assigned":
      return "task_assigned";
    case "task.commented":
      return "task_comment";
    case "deadline.approaching":
      return "deadline";
    default:
      return "task_updated";
  }
}

function titleFor(payload: PmWebhookEvent): string {
  const actor = payload.actor_name ?? "Someone";
  switch (payload.event) {
    case "task.assigned":
      return `${actor} assigned you: ${payload.task_title}`;
    case "task.commented":
      return `${actor} commented on ${payload.task_title}`;
    case "task.created":
      return `${actor} created task: ${payload.task_title}`;
    case "deadline.approaching":
      return `Deadline approaching: ${payload.task_title}`;
    default:
      return `${actor} updated ${payload.task_title}`;
  }
}

export async function POST(request: Request) {
  const secret = process.env.PM_WEBHOOK_SECRET;
  const header = request.headers.get("x-pm-webhook-secret");

  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PmWebhookEvent;
  try {
    payload = (await request.json()) as PmWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.task_id || !payload.project_id || !payload.task_title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const recipientIds = payload.assignee_ids?.filter(Boolean) ?? [];
  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, created: 0 });
  }

  const deepLink = pmTaskDeepLink(payload.project_id, payload.task_id);
  await updateDb((db) => {
    for (const user_id of recipientIds) {
      db.notifications.push({
        id: newId(),
        user_id,
        type: mapEvent(payload.event),
        title: titleFor(payload),
        body: payload.comment ?? payload.project_name ?? null,
        link: "/app/notifications",
        pm_deep_link: deepLink,
        read_at: null,
        created_at: new Date().toISOString(),
      });
    }
  });

  return NextResponse.json({ ok: true, created: recipientIds.length });
}
