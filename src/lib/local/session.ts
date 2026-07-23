import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AuthProvider } from "@/lib/local/types";

export const SESSION_COOKIE = "banter_session";

export type SessionClaims = {
  sub: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  github_handle: string | null;
  firebase_uid: string | null;
  auth_providers: AuthProvider[];
  /** Present for Banter password accounts so cold serverless instances can rehydrate. */
  password_hash?: string;
};

function secretKey() {
  const secret =
    process.env.BANTER_AUTH_SECRET || "banter-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(claims: SessionClaims) {
  return new SignJWT({
    email: claims.email,
    display_name: claims.display_name,
    avatar_url: claims.avatar_url,
    github_handle: claims.github_handle,
    firebase_uid: claims.firebase_uid,
    auth_providers: claims.auth_providers,
    password_hash: claims.password_hash ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function verifySessionClaims(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    return claimsFromPayload(payload);
  } catch {
    return null;
  }
}

function claimsFromPayload(payload: JWTPayload): SessionClaims | null {
  if (typeof payload.sub !== "string") return null;
  const providers = Array.isArray(payload.auth_providers)
    ? (payload.auth_providers.filter(
        (p) => p === "banter" || p === "firebase",
      ) as AuthProvider[])
    : (["banter"] as AuthProvider[]);

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    display_name:
      typeof payload.display_name === "string"
        ? payload.display_name
        : "Banter user",
    avatar_url:
      typeof payload.avatar_url === "string" ? payload.avatar_url : null,
    github_handle:
      typeof payload.github_handle === "string" ? payload.github_handle : null,
    firebase_uid:
      typeof payload.firebase_uid === "string" ? payload.firebase_uid : null,
    auth_providers: providers.length ? providers : ["banter"],
    password_hash:
      typeof payload.password_hash === "string" ? payload.password_hash : "",
  };
}
