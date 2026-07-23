"use client";

import { useRouter } from "next/navigation";

export function MarkReadButton() {
  const router = useRouter();

  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void markAll()}
      className="text-xs font-medium text-[var(--accent)] hover:underline"
    >
      Mark all read
    </button>
  );
}
