import { hashPassword, setSessionCookie } from "@/lib/local/auth";
import { newId, toProfile, updateDb } from "@/lib/local/db";
import { normalizeGithubHandle } from "@/lib/github";
import type { Profile } from "@/lib/local/types";

export async function registerUser(input: {
  email: string;
  password: string;
  displayName?: string;
  githubHandle?: string | null;
}): Promise<Profile> {
  const email = input.email.trim().toLowerCase();
  if (!email || input.password.length < 6) {
    throw new Error(
      "Email and a password of at least 6 characters are required.",
    );
  }

  const github = normalizeGithubHandle(input.githubHandle);
  const password_hash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const id = newId();

  const profile = await updateDb((db) => {
    if (db.users.some((u) => u.email === email)) {
      throw new Error("An account with that email already exists.");
    }
    if (github && db.users.some((u) => u.github_handle === github)) {
      throw new Error(`GitHub @${github} is already linked to another account.`);
    }
    const user = {
      id,
      email,
      display_name:
        input.displayName?.trim() || email.split("@")[0] || "Banter user",
      avatar_url: null,
      password_hash,
      firebase_uid: null,
      github_handle: github,
      auth_providers: ["banter" as const],
      status: "online" as const,
      last_seen_at: now,
      created_at: now,
    };
    db.users.push(user);
    return toProfile(user);
  });

  await setSessionCookie(profile.id);
  return profile;
}
