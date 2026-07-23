import { extractMentions } from "@/lib/utils";
import { newId, readDb, toProfile, updateDb } from "@/lib/local/db";
import type {
  Channel,
  Message,
  Notification,
  Profile,
} from "@/lib/local/types";

export type MessageWithSender = Message & {
  sender?: Profile;
  reply_count?: number;
};

export type ConversationSummary = {
  id: string;
  created_at: string;
  other_user?: Profile;
};

export async function listChannels(): Promise<Channel[]> {
  const db = await readDb();
  return [...db.channels].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getChannel(id: string) {
  const db = await readDb();
  return db.channels.find((c) => c.id === id) ?? null;
}

export async function joinChannel(channelId: string, userId: string) {
  await updateDb((db) => {
    const exists = db.channel_members.some(
      (m) => m.channel_id === channelId && m.user_id === userId,
    );
    if (!exists) {
      db.channel_members.push({
        channel_id: channelId,
        user_id: userId,
        role: "member",
        joined_at: new Date().toISOString(),
      });
    }
  });
}

export async function listConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  const db = await readDb();
  const mine = db.conversation_participants.filter((p) => p.user_id === userId);
  return mine.map((p) => {
    const conv = db.conversations.find((c) => c.id === p.conversation_id);
    const other = db.conversation_participants.find(
      (x) => x.conversation_id === p.conversation_id && x.user_id !== userId,
    );
    const otherUser = other
      ? db.users.find((u) => u.id === other.user_id)
      : undefined;
    return {
      id: p.conversation_id,
      created_at: conv?.created_at ?? "",
      other_user: otherUser ? toProfile(otherUser) : undefined,
    };
  });
}

export async function startConversation(userId: string, otherUserId: string) {
  const db = await readDb();
  const myIds = new Set(
    db.conversation_participants
      .filter((p) => p.user_id === userId)
      .map((p) => p.conversation_id),
  );
  const existing = db.conversation_participants.find(
    (p) => p.user_id === otherUserId && myIds.has(p.conversation_id),
  );
  if (existing) return existing.conversation_id;

  const id = newId();
  const now = new Date().toISOString();
  await updateDb((d) => {
    d.conversations.push({ id, created_at: now });
    d.conversation_participants.push(
      { conversation_id: id, user_id: userId, last_read_at: now },
      { conversation_id: id, user_id: otherUserId, last_read_at: null },
    );
  });
  return id;
}

export async function searchUsers(query: string, excludeUserId: string) {
  const db = await readDb();
  const q = query.trim().toLowerCase();
  return db.users
    .filter(
      (u) =>
        u.id !== excludeUserId &&
        (u.display_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    )
    .slice(0, 8)
    .map(toProfile);
}

function withSenders(
  messages: Message[],
  users: ReturnType<typeof toProfile>[],
  allMessages: Message[],
): MessageWithSender[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  return messages.map((m) => ({
    ...m,
    sender: byId.get(m.sender_id),
    reply_count: allMessages.filter((r) => r.parent_id === m.id).length,
  }));
}

export async function listMessages(opts: {
  channelId?: string;
  conversationId?: string;
}) {
  const db = await readDb();
  const profiles = db.users.map(toProfile);
  const filtered = db.messages
    .filter((m) =>
      opts.channelId
        ? m.channel_id === opts.channelId
        : m.conversation_id === opts.conversationId,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return withSenders(filtered, profiles, db.messages);
}

export async function createMessage(input: {
  senderId: string;
  body: string;
  channelId?: string | null;
  conversationId?: string | null;
  parentId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Message cannot be empty.");

  const message = await updateDb((db) => {
    const sender = db.users.find((u) => u.id === input.senderId);
    if (!sender) throw new Error("Sender not found.");

    const msg: Message = {
      id: newId(),
      channel_id: input.channelId ?? null,
      conversation_id: input.conversationId ?? null,
      parent_id: input.parentId ?? null,
      sender_id: input.senderId,
      body,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    db.messages.push(msg);

    const link = input.channelId
      ? `/app/channels/${input.channelId}`
      : `/app/dm/${input.conversationId}`;

    const mentionNames = extractMentions(body).map((n) => n.toLowerCase());
    if (mentionNames.length) {
      for (const user of db.users) {
        if (user.id === input.senderId) continue;
        if (
          mentionNames.some(
            (n) =>
              user.display_name.toLowerCase().includes(n) ||
              user.display_name.toLowerCase() === n,
          )
        ) {
          db.notifications.push({
            id: newId(),
            user_id: user.id,
            type: "mention",
            title: `${sender.display_name} mentioned you`,
            body: body.slice(0, 140),
            link,
            pm_deep_link: null,
            read_at: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    if (input.conversationId && !input.parentId) {
      const others = db.conversation_participants.filter(
        (p) =>
          p.conversation_id === input.conversationId &&
          p.user_id !== input.senderId,
      );
      for (const p of others) {
        db.notifications.push({
          id: newId(),
          user_id: p.user_id,
          type: "dm",
          title: `DM from ${sender.display_name}`,
          body: body.slice(0, 140),
          link,
          pm_deep_link: null,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (input.parentId) {
      const parent = db.messages.find((m) => m.id === input.parentId);
      if (parent && parent.sender_id !== input.senderId) {
        db.notifications.push({
          id: newId(),
          user_id: parent.sender_id,
          type: "thread_reply",
          title: `${sender.display_name} replied to your thread`,
          body: body.slice(0, 140),
          link,
          pm_deep_link: null,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    return { ...msg, sender: toProfile(sender) } as MessageWithSender;
  });

  return message;
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const db = await readDb();
  return db.notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
}

export async function unreadCount(userId: string) {
  const db = await readDb();
  return db.notifications.filter((n) => n.user_id === userId && !n.read_at)
    .length;
}

export async function markNotificationsRead(userId: string) {
  const now = new Date().toISOString();
  await updateDb((db) => {
    for (const n of db.notifications) {
      if (n.user_id === userId && !n.read_at) n.read_at = now;
    }
  });
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
) {
  await updateDb((db) => {
    const row = db.conversation_participants.find(
      (p) => p.conversation_id === conversationId && p.user_id === userId,
    );
    if (row) row.last_read_at = new Date().toISOString();
  });
}

export async function touchPresence(userId: string) {
  await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.status = "online";
      user.last_seen_at = new Date().toISOString();
    }
  });
}

export async function getConversationOther(
  conversationId: string,
  userId: string,
) {
  const db = await readDb();
  const member = db.conversation_participants.find(
    (p) => p.conversation_id === conversationId && p.user_id === userId,
  );
  if (!member) return null;
  const other = db.conversation_participants.find(
    (p) => p.conversation_id === conversationId && p.user_id !== userId,
  );
  if (!other) return { other_user: undefined as Profile | undefined };
  const user = db.users.find((u) => u.id === other.user_id);
  return { other_user: user ? toProfile(user) : undefined };
}
