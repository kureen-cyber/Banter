import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { readDb, toProfile, updateDb } from "@/lib/local/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionClaims,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/local/session";
import type { Profile, UserRecord } from "@/lib/local/types";

export { SESSION_COOKIE, verifySessionToken } from "@/lib/local/session";

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function setSessionCookie(user: UserRecord | Profile & { password_hash?: string }) {
  const claims: SessionClaims = {
    sub: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    github_handle: user.github_handle,
    firebase_uid: user.firebase_uid,
    auth_providers: user.auth_providers ?? ["banter"],
    password_hash: "password_hash" in user ? user.password_hash || "" : "",
  };
  const token = await createSessionToken(claims);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUserId() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

async function rehydrateFromClaims(claims: SessionClaims) {
  const now = new Date().toISOString();
  return updateDb((db) => {
    let user = db.users.find((u) => u.id === claims.sub);
    if (!user && claims.email) {
      user = db.users.find((u) => u.email === claims.email);
    }
    if (!user) {
      user = {
        id: claims.sub,
        email: claims.email || `${claims.sub}@banter.local`,
        display_name: claims.display_name,
        avatar_url: claims.avatar_url,
        password_hash: claims.password_hash || "",
        firebase_uid: claims.firebase_uid,
        github_handle: claims.github_handle,
        auth_providers: claims.auth_providers,
        status: "online",
        last_seen_at: now,
        created_at: now,
      };
      db.users.push(user);
    } else {
      user.display_name = claims.display_name || user.display_name;
      user.avatar_url = claims.avatar_url ?? user.avatar_url;
      user.github_handle = claims.github_handle ?? user.github_handle;
      user.firebase_uid = claims.firebase_uid ?? user.firebase_uid;
      if (claims.password_hash) user.password_hash = claims.password_hash;
      for (const p of claims.auth_providers) {
        if (!user.auth_providers.includes(p)) user.auth_providers.push(p);
      }
      user.status = "online";
      user.last_seen_at = now;
    }
    return toProfile(user);
  });
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionClaims(token);
  if (!claims) return null;

  const db = await readDb();
  const existing =
    db.users.find((u) => u.id === claims.sub) ||
    (claims.email ? db.users.find((u) => u.email === claims.email) : undefined);

  if (existing) return toProfile(existing);
  return rehydrateFromClaims(claims);
}

export async function loginUser(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  const user = db.users.find((u) => u.email === normalized);
  if (!user) throw new Error("Invalid email or password.");
  if (!user.password_hash) {
    throw new Error(
      "This account uses PM (Firebase) sign-in. Choose “PM account” on the login page.",
    );
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error("Invalid email or password.");

  const updated = await updateDb((d) => {
    const row = d.users.find((u) => u.id === user.id);
    if (row) {
      if (!row.auth_providers?.includes("banter")) {
        row.auth_providers = [...(row.auth_providers || []), "banter"];
      }
      row.status = "online";
      row.last_seen_at = new Date().toISOString();
      return row;
    }
    return user;
  });

  await setSessionCookie(updated);
  return toProfile(updated);
}
