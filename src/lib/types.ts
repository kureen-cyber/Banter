export type {
  PresenceStatus,
  NotificationType,
  Profile,
  Channel,
  Message,
  Notification,
} from "@/lib/local/types";

export type { MessageWithSender, ConversationSummary as Conversation } from "@/lib/local/queries";

export type PmWebhookEvent = {
  event:
    | "task.created"
    | "task.updated"
    | "task.assigned"
    | "task.commented"
    | "deadline.approaching";
  task_id: string;
  project_id: string;
  project_name?: string;
  task_title: string;
  actor_id?: string;
  actor_name?: string;
  assignee_ids?: string[];
  comment?: string;
  due_at?: string;
};
