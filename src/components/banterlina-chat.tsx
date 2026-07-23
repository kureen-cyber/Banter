"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eraser, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BanterlinaMessage } from "@/lib/local/types";

const SUGGESTIONS = [
  "Summarize the key tradeoffs of REST vs GraphQL",
  "Help me draft a standup update for my project",
  "What should I research before deploying to Vercel?",
  "Brainstorm interview questions for a product role",
];

export function BanterlinaChat({
  initialMessages,
}: {
  initialMessages: BanterlinaMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");

    const optimistic: BanterlinaMessage = {
      id: `tmp-${Date.now()}`,
      user_id: "me",
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const res = await fetch("/api/banterlina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as {
        error?: string;
        userMessage?: BanterlinaMessage;
        assistantMessage?: BanterlinaMessage;
      };
      if (!res.ok || !data.userMessage || !data.assistantMessage) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(data.error ?? "Banterlina couldn't reply.");
        setInput(message);
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.userMessage!,
        data.assistantMessage!,
      ]);
    });
  }

  async function clearChat() {
    await fetch("/api/banterlina", { method: "DELETE" });
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Banterlina
            </h1>
            <p className="truncate text-xs text-[var(--muted)]">
              Quick research, brainstorming, and study help
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void clearChat()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl pt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              Hi, I&apos;m Banterlina
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ask me to research a topic, break down a concept, or draft
              something fast for the cohort.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-sm text-[var(--ink)] transition hover:border-[var(--accent)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "mx-auto flex max-w-2xl gap-3",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {m.role === "assistant" && (
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="mx-auto flex max-w-2xl items-center gap-3 text-sm text-[var(--muted)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            </div>
            Banterlina is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] p-4">
        {error && (
          <p className="mx-auto mb-2 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--accent)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask Banterlina anything…"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="button"
            disabled={pending || !input.trim()}
            onClick={() => send(input)}
            className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
