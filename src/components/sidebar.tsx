"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Hash,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel, Conversation, Profile } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { AccountLinks } from "@/components/account-links";

type Props = {
  profile: Profile;
  channels: Channel[];
  conversations: Conversation[];
  unreadCount: number;
  onNavigate?: () => void;
};

export function Sidebar({
  profile,
  channels,
  conversations,
  unreadCount,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (query.trim().length < 1) {
        setPeople([]);
        return;
      }
      const res = await fetch(`/api/users?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return;
      const data = (await res.json()) as { users: Profile[] };
      if (!cancelled) setPeople(data.users);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function startDm(other: Profile) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: other.id }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { conversationId: string };
    router.push(`/app/dm/${data.conversationId}`);
    setSearchOpen(false);
    setQuery("");
    onNavigate?.();
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white">
          Banter
        </p>
        <p className="text-xs text-white/55">Hult cohort communications</p>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg bg-white/8 px-3 py-2 text-sm text-white/70 transition hover:bg-white/12"
        >
          <Search className="h-4 w-4" />
          Find people or start a DM
        </button>
        {searchOpen && (
          <div className="mt-2 rounded-lg border border-white/10 bg-[var(--sidebar-elevated)] p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search classmates…"
              className="w-full rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/40"
              autoFocus
            />
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void startDm(p)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10"
                  >
                    <Avatar profile={p} size="sm" showStatus />
                    <span>{p.display_name}</span>
                  </button>
                </li>
              ))}
              {query && people.length === 0 && (
                <li className="px-2 py-1 text-xs text-white/45">No matches</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <section>
          <Link
            href="/app/banterlina"
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition",
              pathname === "/app/banterlina"
                ? "bg-[var(--accent)] text-white"
                : "bg-white/8 text-white/85 hover:bg-white/12 hover:text-white",
            )}
          >
            <Sparkles className="h-4 w-4" />
            Banterlina
            <span className="ml-auto text-[10px] uppercase tracking-wide opacity-70">
              AI
            </span>
          </Link>
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Channels
            </h2>
            <Plus className="h-3.5 w-3.5 text-white/35" />
          </div>
          <ul className="space-y-0.5">
            {channels.map((ch) => {
              const href = `/app/channels/${ch.id}`;
              const active = pathname === href;
              return (
                <li key={ch.id}>
                  <Link
                    href={href}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-white/75 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Hash className="h-4 w-4 opacity-70" />
                    {ch.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Direct messages
          </h2>
          <ul className="space-y-0.5">
            {conversations.length === 0 && (
              <li className="px-2 py-1 text-xs text-white/40">
                Search above to message someone
              </li>
            )}
            {conversations.map((c) => {
              const href = `/app/dm/${c.id}`;
              const active = pathname === href;
              const name = c.other_user?.display_name ?? "Conversation";
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-white/75 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {c.other_user ? (
                      <Avatar profile={c.other_user} size="sm" showStatus />
                    ) : (
                      <MessageSquare className="h-4 w-4 opacity-70" />
                    )}
                    <span className="truncate">{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href="/app/notifications"
            onClick={() => onNavigate?.()}
            className={cn(
              "relative flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/75 hover:bg-white/8",
              pathname === "/app/notifications" && "bg-white/10 text-white",
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto rounded-md bg-[var(--warn)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink)]">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
        <div className="mb-2">
          <AccountLinks profile={profile} />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-2">
          <Avatar profile={profile} showStatus />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {profile.display_name}
            </p>
            <p className="truncate text-[11px] text-white/45">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
