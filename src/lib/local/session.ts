import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "banter_session";

function secretKey() {
  const secret =
    process.env.BANTER_AUTH_SECRET || "banter-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
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
