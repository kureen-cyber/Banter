import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAdditionalUserInfo,
  getAuth,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  type Auth,
} from "firebase/auth";

export function isFirebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars from the PM project.",
    );
  }

  if (getApps().length) return getApps()[0]!;

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export async function signInPmWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );
  return cred.user.getIdToken();
}

export async function signInPmWithGithub() {
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  const cred = await signInWithPopup(getFirebaseAuth(), provider);
  const info = getAdditionalUserInfo(cred);
  const githubHandle =
    (typeof info?.username === "string" && info.username) ||
    cred.user.providerData.find((p) => p.providerId === "github.com")
      ?.displayName ||
    null;
  return {
    idToken: await cred.user.getIdToken(),
    githubHandle,
  };
}
