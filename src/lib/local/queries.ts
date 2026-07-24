import { extractMentions } from "@/lib/utils";
import { newId, readDb, toProfile, updateDb } from "@/lib/local/db";
import type {
  Channel,
  ChannelMember,
  Message,
  Notification,
  Profile,
  UserRecord,
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

export type MessageSearchHit = MessageWithSender & {
  channel?: Pick<Channel, "id" | "name" | "slug"> | null;
  link: string;
};

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "channel"
  );
}

/** Exact / token match for @mentions (no substring false positives). */
export function mentionMatchesUser(
  mention: string,
  user: Pick<UserRecord, "display_name" | "email" | "github_handle">,
): boolean {
  const n = mention.toLowerCase();
  const name = user.display_name.toLowerCase().trim();
  if (name === n) return true;

  const compact = name.replace(/[\s_.-]+/g, "");
  if (compact === n) return true;

  const tokens = name.split(/[\s_.-]+/).filter(Boolean);
  if (tokens.some((t) => t === n)) return true;

  if (user.github_handle?.toLowerCase() === n) return true;

  const local = user.email.split("@")[0]?.toLowerCase();
  if (local && local === n) return true;

  return false;
}

export async function listChannels(): Promise<Channel[]> {
  const db = await readDb();
  return db.channels
    .filter((c) => !c.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getChannel(id: string) {
  const db = await readDb();
  return db.channels.find((c) => c.id === id) ?? null;
}

export async function getMemberRole(
  channelId: string,
  userId: string,
): Promise<ChannelMember["role"] | null> {
  const db = await readDb();
  return (
    db.channel_members.find(
      (m) => m.channel_id === channelId && m.user_id === userId,
    )?.role ?? null
  );
}

/** First cohort user becomes announcements owner so the channel is usable. */
export async function ensureAnnouncementsOwner(userId: string) {
  await updateDb((db) => {
    const announcements = db.channels.find((c) => c.slug === "announcements");
    if (!announcements || announcements.archived_at) return;

    const members = db.channel_members.filter(
      (m) => m.channel_id === announcements.id,
    );
    if (members.some((m) => m.role === "owner" || m.role === "admin")) {
      return;
    }

    const firstUser = [...db.users].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )[0];
    if (!firstUser || firstUser.id !== userId) return;

    const existing = members.find((m) => m.user_id === userId);
    if (existing) {
      existing.role = "owner";
    } else {
      db.channel_members.push({
        channel_id: announcements.id,
        user_id: userId,
        role: "owner",
        joined_at: new Date().toISOString(),
      });
    }
  });
}

export async function canPostToChannel(channelId: string, userId: string) {
  const db = await readDb();
  const channel = db.channels.find((c) => c.id === channelId);
  if (!channel || channel.archived_at) {
    return { ok: false as const, reason: "Channel not found." };
  }

  if (channel.slug === "announcements") {
    await ensureAnnouncementsOwner(userId);
    const role = await getMemberRole(channelId, userId);
    if (role !== "owner" && role !== "admin") {
      return {
        ok: false as const,
        reason: "Only channel admins can post in #announcements.",
      };
    }
  }

  return { ok: true as const };
}

export async function joinChannel(
  channelId: string,
  userId: string,
  role: ChannelMember["role"] = "member",
) {
  await updateDb((db) => {
    const exists = db.channel_members.some(
      (m) => m.channel_id === channelId && m.user_id === userId,
    );
    if (!exists) {
      db.channel_members.push({
        channel_id: channelId,
        user_id: userId,
        role,
        joined_at: new Date().toISOString(),
      });
    }
  });
  const channel = await getChannel(channelId);
  if (channel?.slug === "announcements") {
    await ensureAnnouncementsOwner(userId);
  }
}

export async function createChannel(input: {
  name: string;
  description?: string | null;
  createdBy: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Channel name is too short.");

  return updateDb((db) => {
    let slug = slugify(name);
    const taken = new Set(db.channels.map((c) => c.slug));
    if (taken.has(slug)) {
      let i = 2;
      while (taken.has(`${slug}-${i}`)) i += 1;
      slug = `${slug}-${i}`;
    }
    const now = new Date().toISOString();
    const channel: Channel = {
      id: newId(),
      slug,
      name,
      description: input.description?.trim() || null,
      is_private: false,
      created_by: input.createdBy,
      created_at: now,
      archived_at: null,
    };
    db.channels.push(channel);
    db.channel_members.push({
      channel_id: channel.id,
      user_id: input.createdBy,
      role: "owner",
      joined_at: now,
    });
    return channel;
  });
}

export async function updateChannel(
  channelId: string,
  userId: string,
  patch: { name?: string; description?: string | null },
) {
  return updateDb((db) => {
    const channel = db.channels.find((c) => c.id === channelId);
    if (!channel || channel.archived_at) throw new Error("Channel not found.");

    const member = db.channel_members.find(
      (m) => m.channel_id === channelId && m.user_id === userId,
    );
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only channel admins can rename this channel.");
    }
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length < 2) throw new Error("Channel name is too short.");
      channel.name = name;
    }
    if (patch.description !== undefined) {
      channel.description = patch.description?.trim() || null;
    }
    return channel;
  });
}

export async function archiveChannel(channelId: string, userId: string) {
  return updateDb((db) => {
    const channel = db.channels.find((c) => c.id === channelId);
    if (!channel || channel.archived_at) throw new Error("Channel not found.");
    if (channel.slug === "announcements" || channel.slug === "general") {
      throw new Error("Seeded channels cannot be archived.");
    }
    const member = db.channel_members.find(
      (m) => m.channel_id === channelId && m.user_id === userId,
    );
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only channel admins can archive this channel.");
    }
    channel.archived_at = new Date().toISOString();
    return channel;
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

export async function searchMessages(
  query: string,
  limit = 40,
): Promise<MessageSearchHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const db = await readDb();
  const profiles = new Map(db.users.map((u) => [u.id, toProfile(u)]));
  const channels = new Map(db.channels.map((c) => [c.id, c]));

  return db.messages
    .filter((m) => m.body.toLowerCase().includes(q))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((m) => {
      const channel = m.channel_id ? channels.get(m.channel_id) : undefined;
      const link = m.channel_id
        ? `/app/channels/${m.channel_id}`
        : `/app/dm/${m.conversation_id}`;
      return {
        ...m,
        sender: profiles.get(m.sender_id),
        channel: channel
          ? { id: channel.id, name: channel.name, slug: channel.slug }
          : null,
        link,
        reply_count: db.messages.filter((r) => r.parent_id === m.id).length,
      };
    });
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

    const mentionNames = extractMentions(body);
    if (mentionNames.length) {
      for (const user of db.users) {
        if (user.id === input.senderId) continue;
        if (mentionNames.some((n) => mentionMatchesUser(n, user))) {
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
