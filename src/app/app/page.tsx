import Link from "next/link";
import { Hash, MessageSquare } from "lucide-react";
import { getChannels, requireUser } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
  const { user } = await requireUser();
  if (!user) redirect("/login");

  const channels = await getChannels();
  const general = channels.find((c) => c.slug === "general") ?? channels[0];

  if (general) {
    redirect(`/app/channels/${general.id}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <MessageSquare className="h-10 w-10 text-[var(--muted)]" />
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        Welcome to Banter
      </h1>
      <p className="max-w-md text-sm text-[var(--muted)]">
        Create or join a channel to get started. Seed channels appear after you
        run the Supabase migration.
      </p>
      <Link
        href="/app/notifications"
        className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
      >
        <Hash className="h-4 w-4" /> View notifications
      </Link>
    </div>
  );
}
