import { setSessionCookie } from "@/lib/local/auth";
import { newId, toProfile, updateDb } from "@/lib/local/db";
import { normalizeGithubHandle } from "@/lib/github";
import type { FirebaseIdentity } from "@/lib/firebase/verify";
import type { AuthProvider, Profile, UserRecord } from "@/lib/local/types";

function withProvider(user: UserRecord, provider: AuthProvider) {
  if (!user.auth_providers.includes(provider)) {
    user.auth_providers.push(provider);
  }
}

/**
 * Upsert a Banter profile from a verified Firebase (PM) identity.
 * Links across Banter ↔ PM via firebase_uid, github_handle, or email.
 */
export async function upsertUserFromFirebase(
  identity: FirebaseIdentity,
  fallbackGithub?: string | null,
): Promise<Profile> {
  const github =
    identity.githubHandle || normalizeGithubHandle(fallbackGithub);
  const email = identity.email.trim().toLowerCase();
  if (!email && !identity.firebaseUid) {
    throw new Error("Firebase account is missing an email.");
  }

  const now = new Date().toISOString();

  const profile = await updateDb((db) => {
    let user =
      db.users.find((u) => u.firebase_uid === identity.firebaseUid) ||
      (github
        ? db.users.find(
            (u) => u.github_handle && u.github_handle === github,
          )
        : undefined) ||
      (email ? db.users.find((u) => u.email === email) : undefined);

    if (!user) {
      if (
        github &&
        db.users.some((u) => u.github_handle === github)
      ) {
        throw new Error(
          `GitHub @${github} is already linked to another Banter account.`,
        );
      }
      user = {
        id: newId(),
        email: email || `${identity.firebaseUid}@firebase.local`,
        display_name:
          identity.displayName || github || email.split("@")[0] || "PM user",
        avatar_url: identity.photoUrl,
        password_hash: "",
        firebase_uid: identity.firebaseUid,
        github_handle: github,
        auth_providers: ["firebase"],
        status: "online",
        last_seen_at: now,
        created_at: now,
      };
      db.users.push(user);
    } else {
      if (
        github &&
        db.users.some(
          (u) => u.id !== user!.id && u.github_handle === github,
        )
      ) {
        throw new Error(
          `GitHub @${github} is already linked to another Banter account.`,
        );
      }
      user.firebase_uid = identity.firebaseUid;
      if (github) user.github_handle = github;
      if (identity.photoUrl) user.avatar_url = identity.photoUrl;
      if (identity.displayName && user.display_name === user.email.split("@")[0]) {
        user.display_name = identity.displayName;
      }
      if (email && user.email.endsWith("@firebase.local")) {
        user.email = email;
      }
      withProvider(user, "firebase");
      user.status = "online";
      user.last_seen_at = now;
    }

    return toProfile(user);
  });

  await setSessionCookie(profile.id);
  return profile;
}

export async function linkGithubHandle(
  userId: string,
  rawHandle: string,
): Promise<Profile> {
  const github = normalizeGithubHandle(rawHandle);
  if (!github) throw new Error("Enter a valid GitHub username.");

  return updateDb((db) => {
    const taken = db.users.find(
      (u) => u.github_handle === github && u.id !== userId,
    );
    if (taken) {
      throw new Error(`@${github} is already linked to another account.`);
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found.");
    user.github_handle = github;
    return toProfile(user);
  });
}
