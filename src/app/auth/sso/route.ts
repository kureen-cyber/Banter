import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared auth handoff from the custom PM platform.
 * PM redirects here with access_token + refresh_token from the shared Supabase project.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = searchParams.get("next") ?? "/app";

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(`${origin}/login?error=missing_tokens`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=sso_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
