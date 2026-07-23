"use client";

import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Pick<Profile, "display_name" | "avatar_url" | "status">;
  size?: "sm" | "md";
  showStatus?: boolean;
};

export function Avatar({ profile, size = "md", showStatus = false }: Props) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <div className="relative shrink-0">
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt={profile.display_name}
          className={cn(dim, "rounded-lg object-cover")}
        />
      ) : (
        <div
          className={cn(
            dim,
            "flex items-center justify-center rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--accent)]",
          )}
        >
          {initials(profile.display_name)}
        </div>
      )}
      {showStatus && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--panel)]",
            profile.status === "online" && "bg-emerald-500",
            profile.status === "away" && "bg-amber-400",
            profile.status === "offline" && "bg-slate-400",
          )}
        />
      )}
    </div>
  );
}
