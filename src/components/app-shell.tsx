"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import type { Channel, Conversation, Profile } from "@/lib/types";

type Props = {
  profile: Profile;
  channels: Channel[];
  conversations: Conversation[];
  unreadCount: number;
  children: React.ReactNode;
};

export function AppShell({
  profile,
  channels,
  conversations,
  unreadCount,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          profile={profile}
          channels={channels}
          conversations={conversations}
          unreadCount={unreadCount}
          onNavigate={() => setOpen(false)}
        />
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col bg-[var(--panel)]">
        <div className="flex h-12 items-center border-b border-[var(--border)] px-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-[var(--ink)] hover:bg-[var(--surface)]"
            aria-label="Open menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="ml-2 font-[family-name:var(--font-display)] text-lg">
            Banter
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
