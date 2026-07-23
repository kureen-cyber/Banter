import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase/verify";
import { upsertUserFromFirebase } from "@/lib/local/identity";

/**
 * PM app handoff: redirect here with ?idToken=...&github=optional
 * after the user is already signed into Firebase on the PM tool.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const idToken = searchParams.get("idToken");
  const github = searchParams.get("github");
  const next = searchParams.get("next") ?? "/app";

  if (!idToken) {
    return NextResponse.redirect(`${origin}/login?error=missing_pm_token`);
  }

  try {
    const identity = await verifyFirebaseIdToken(idToken);
    await upsertUserFromFirebase(identity, github);
    return NextResponse.redirect(`${origin}${next}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=pm_sso_failed`);
  }
}
