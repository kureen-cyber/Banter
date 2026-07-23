"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { MessageSquareText, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type { MessageWithSender } from "@/lib/local/queries";
import { Avatar } from "@/components/avatar";

type ChatMessage = MessageWithSender;

type Props = {
  currentUser: Profile;
  channelId?: string;
  conversationId?: string;
  title: string;
  subtitle?: string;
  initialMessages: ChatMessage[];
};

export function ChatPane({
  currentUser,
  channelId,
  conversationId,
  title,
  subtitle,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [threadRoot, setThreadRoot] = useState<ChatMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChatMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const endpoint = channelId
    ? `/api/channels/${channelId}/messages`
    : `/api/dm/${conversationId}/messages`;

  const topLevel = messages.filter((m) => !m.parent_id);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [topLevel.length]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
      if (threadRoot) {
        setThreadReplies(
          data.messages.filter((m) => m.parent_id === threadRoot.id),
        );
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [endpoint, threadRoot]);

  function openThread(message: ChatMessage) {
    setThreadRoot(message);
    setThreadReplies(messages.filter((m) => m.parent_id === message.id));
  }

  function sendMessage(parentId?: string | null) {
    const text = (parentId ? threadBody : body).trim();
    if (!text) return;

    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, parentId: parentId ?? null }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id)
          ? prev
          : [...prev, data.message],
      );
      if (parentId) {
        setThreadReplies((prev) =>
          prev.some((m) => m.id === data.message.id)
            ? prev
            : [...prev, data.message],
        );
        setThreadBody("");
      } else {
        setBody("");
      }
    });
  }

  function replyCount(id: string) {
    return messages.filter((m) => m.parent_id === id).length;
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-[var(--border)] bg-[var(--panel)] px-5">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-[var(--muted)]">{subtitle}</p>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {topLevel.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-[var(--muted)]">
              <MessageSquareText className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">No messages yet. Start the conversation.</p>
            </div>
          )}
          {topLevel.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              replyCount={replyCount(m.id)}
              onOpenThread={() => openThread(m)}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <Composer
          body={body}
          setBody={setBody}
          pending={pending}
          onSend={() => sendMessage(null)}
          placeholder={`Message ${title}`}
        />
      </section>

      {threadRoot && (
        <aside className="absolute inset-0 z-20 flex w-full flex-col border-l border-[var(--border)] bg-[var(--panel)] md:static md:w-[360px] md:shrink-0">
          <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Thread</h2>
            <button
              type="button"
              onClick={() => {
                setThreadRoot(null);
                setThreadReplies([]);
              }}
              className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
            <MessageRow message={threadRoot} />
            <div className="my-3 border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted)]">
              {threadReplies.length}{" "}
              {threadReplies.length === 1 ? "reply" : "replies"}
            </div>
            {threadReplies.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
          <Composer
            body={threadBody}
            setBody={setThreadBody}
            pending={pending}
            onSend={() => sendMessage(threadRoot.id)}
            placeholder="Reply in thread"
          />
        </aside>
      )}
    </div>
  );
}

function MessageRow({
  message,
  replyCount,
  onOpenThread,
}: {
  message: ChatMessage;
  replyCount?: number;
  onOpenThread?: () => void;
}) {
  const sender = message.sender;
  return (
    <article className="group rounded-lg px-2 py-2 hover:bg-[var(--surface)]">
      <div className="flex gap-3">
        {sender ? (
          <Avatar profile={sender} showStatus />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-[var(--surface)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">
              {sender?.display_name ?? "Unknown"}
            </span>
            <time
              className="text-[11px] text-[var(--muted)]"
              title={format(new Date(message.created_at), "PPpp")}
            >
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
              })}
            </time>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--ink)]/90">
            {renderBody(message.body)}
          </p>
          {typeof replyCount === "number" && replyCount > 0 && onOpenThread && (
            <button
              type="button"
              onClick={onOpenThread}
              className="mt-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}
          {typeof replyCount === "number" &&
            replyCount === 0 &&
            onOpenThread && (
              <button
                type="button"
                onClick={onOpenThread}
                className="mt-1 hidden text-xs text-[var(--muted)] group-hover:inline hover:text-[var(--accent)]"
              >
                Reply in thread
              </button>
            )}
        </div>
      </div>
    </article>
  );
}

function renderBody(body: string) {
  const parts = body.split(/(@[A-Za-z0-9_.-]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span
        key={i}
        className="rounded bg-[var(--accent-soft)] px-1 font-medium text-[var(--accent)]"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Composer({
  body,
  setBody,
  pending,
  onSend,
  placeholder,
}: {
  body: string;
  setBody: (v: string) => void;
  pending: boolean;
  onSend: () => void;
  placeholder: string;
}) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--accent)]">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={onSend}
          className={cn(
            "mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        Enter to send · Shift+Enter for newline · Use @name to mention
      </p>
    </div>
  );
}
