export type PresenceStatus = "online" | "away" | "offline";
export type AuthProvider = "banter" | "firebase";

export type NotificationType =
  | "mention"
  | "dm"
  | "thread_reply"
  | "task_assigned"
  | "task_updated"
  | "task_comment"
  | "deadline";

export type UserRecord = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  /** Empty string means Firebase/PM-only account (no Banter password). */
  password_hash: string;
  firebase_uid: string | null;
  github_handle: string | null;
  auth_providers: AuthProvider[];
  status: PresenceStatus;
  last_seen_at: string;
  created_at: string;
};

export type Profile = Omit<UserRecord, "password_hash">;

export type Channel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  /** Soft-delete / hide from sidebar when set. */
  archived_at: string | null;
};

export type ChannelMember = {
  channel_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

export type Conversation = {
  id: string;
  created_at: string;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};

export type Message = {
  id: string;
  channel_id: string | null;
  conversation_id: string | null;
  parent_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  pm_deep_link: string | null;
  read_at: string | null;
  created_at: string;
};

export type BanterlinaMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Database = {
  users: UserRecord[];
  channels: Channel[];
  channel_members: ChannelMember[];
  conversations: Conversation[];
  conversation_participants: ConversationParticipant[];
  messages: Message[];
  notifications: Notification[];
  banterlina_messages: BanterlinaMessage[];
};
