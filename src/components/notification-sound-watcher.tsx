"use client";

import { useEffect, useRef } from "react";
import { useSound } from "@/components/sound-provider";

/**
 * Plays the user's message tone when unread notifications increase
 * (mentions, DMs, thread replies) while the app shell is open.
 */
export function NotificationSoundWatcher() {
  const { playMessageTone, enabled } = useSound();
  const lastUnread = useRef<number | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          notifications?: { read_at: string | null }[];
        };
        const unread = (data.notifications ?? []).filter((n) => !n.read_at)
          .length;
        if (lastUnread.current === null) {
          lastUnread.current = unread;
          primed.current = true;
          return;
        }
        if (primed.current && unread > lastUnread.current) {
          void playMessageTone();
        }
        lastUnread.current = unread;
      } catch {
        // ignore network blips
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, playMessageTone]);

  return null;
}
