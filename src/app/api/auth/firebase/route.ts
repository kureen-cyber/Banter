import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase/verify";
import { upsertUserFromFirebase } from "@/lib/local/identity";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      githubHandle?: string | null;
    };
    if (!body.idToken) {
      return NextResponse.json({ error: "idToken required" }, { status: 400 });
    }

    const identity = await verifyFirebaseIdToken(body.idToken);
    const profile = await upsertUserFromFirebase(identity, body.githubHandle);
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firebase auth failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
