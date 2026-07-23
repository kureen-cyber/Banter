"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { pmHomeDeepLink } from "@/lib/pm";
import type { Profile } from "@/lib/types";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function AccountLinks({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [handle, setHandle] = useState(profile.github_handle ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveGithub() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/auth/link-github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubHandle: handle }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not save.");
      return;
    }
    setMessage("GitHub linked.");
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2">
      <a
        href={pmHomeDeepLink(profile.github_handle)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/75 hover:bg-white/10 hover:text-white"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open PM tool
        {profile.github_handle ? ` (@${profile.github_handle})` : ""}
      </a>
      <div className="flex items-center gap-1 px-1">
        <GitHubMark className="h-3.5 w-3.5 text-white/45" />
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="github handle"
          className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveGithub()}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-soft)] hover:bg-white/10"
        >
          {saving ? "…" : "Link"}
        </button>
      </div>
      {message && (
        <p className="px-1 text-[10px] text-white/55">{message}</p>
      )}
    </div>
  );
}
