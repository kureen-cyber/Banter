import { normalizeGithubHandle } from "@/lib/github";

export type FirebaseIdentity = {
  firebaseUid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  githubHandle: string | null;
};

type LookupResponse = {
  users?: {
    localId: string;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    providerUserInfo?: {
      providerId: string;
      displayName?: string;
      screenName?: string;
      photoUrl?: string;
      federatedId?: string;
      rawId?: string;
    }[];
  }[];
  error?: { message?: string };
};

/**
 * Verify a Firebase ID token using the same web API key as the PM app.
 * Avoids requiring a Firebase Admin service account for the dual-auth MVP.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseIdentity> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not configured.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  const data = (await res.json()) as LookupResponse;
  if (!res.ok || !data.users?.[0]) {
    throw new Error(data.error?.message || "Invalid Firebase session.");
  }

  const user = data.users[0];
  const githubProvider = user.providerUserInfo?.find(
    (p) => p.providerId === "github.com",
  );
  const githubHandle = normalizeGithubHandle(
    githubProvider?.screenName ||
      githubProvider?.displayName ||
      githubProvider?.rawId ||
      null,
  );

  return {
    firebaseUid: user.localId,
    email: (user.email || "").toLowerCase(),
    displayName: user.displayName || githubProvider?.displayName || null,
    photoUrl: user.photoUrl || githubProvider?.photoUrl || null,
    githubHandle,
  };
}
