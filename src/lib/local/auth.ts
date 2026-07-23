import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { readDb, toProfile, updateDb } from "@/lib/local/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
} from "@/lib/local/session";
import type { Profile } from "@/lib/local/types";

export { SESSION_COOKIE, verifySessionToken } from "@/lib/local/session";

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
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

export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  return user ? toProfile(user) : null;
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

  await updateDb((d) => {
    const row = d.users.find((u) => u.id === user.id);
    if (row) {
      if (!row.auth_providers?.includes("banter")) {
        row.auth_providers = [...(row.auth_providers || []), "banter"];
      }
      row.status = "online";
      row.last_seen_at = new Date().toISOString();
    }
  });
  await setSessionCookie(user.id);
  return toProfile(user);
}
