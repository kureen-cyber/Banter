import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/local/session";

/**
 * Auth gate only. Do not bounce /login ↔ /app based solely on JWT presence
 * without the app being able to clear orphaned cookies — that caused
 * ERR_TOO_MANY_REDIRECTS when the session user was missing from the DB.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path === "/login" ||
    path.startsWith("/auth") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/webhooks");
  const isApi = path.startsWith("/api/");

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  // Protect app pages only; leave /login alone so stale cookies can be cleared
  if (!userId && path.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!userId && !isPublic && !isApi && path !== "/favicon.ico") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
