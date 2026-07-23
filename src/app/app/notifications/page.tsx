import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/data";
import { listNotifications } from "@/lib/local/queries";
import { MarkReadButton } from "@/components/mark-read-button";

export default async function NotificationsPage() {
  const { user, profile } = await requireUser();
  if (!user || !profile) redirect("/login");

  const notifications = await listNotifications(user.id);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] px-5">
        <h1 className="font-[family-name:var(--font-display)] text-lg">
          Notifications
        </h1>
        <MarkReadButton />
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        {notifications.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">You&apos;re all caught up.</p>
        ) : (
          <ul className="mx-auto max-w-2xl space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border border-[var(--border)] px-4 py-3 ${
                  n.read_at ? "bg-[var(--panel)]" : "bg-[var(--accent-soft)]/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--muted)]">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}{" "}
                      · {n.type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {n.pm_deep_link && (
                      <a
                        href={n.pm_deep_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        View task <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {n.link && !n.pm_deep_link && (
                      <Link
                        href={n.link}
                        className="text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
