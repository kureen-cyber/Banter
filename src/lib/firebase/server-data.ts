import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore,
} from "firebase/firestore";

/** Server-side Firebase app for Banter durable data (Firestore). */
export function isFirestoreDataConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

function getServerApp(): FirebaseApp {
  if (!isFirestoreDataConfigured()) {
    throw new Error(
      "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* from the shared PM project.",
    );
  }
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getServerFirestore(): Firestore {
  return getFirestore(getServerApp());
}

export function banterStateDocRef() {
  const collection = process.env.BANTER_FIRESTORE_COLLECTION?.trim() || "banter";
  const docId = process.env.BANTER_FIRESTORE_DOC?.trim() || "app-state";
  return doc(getServerFirestore(), collection, docId);
}

export async function readBanterStateJson(): Promise<string | null> {
  const snap = await getDoc(banterStateDocRef());
  if (!snap.exists()) return null;
  const data = snap.data() as { json?: unknown };
  return typeof data.json === "string" ? data.json : null;
}

export async function writeBanterStateJson(json: string) {
  await setDoc(
    banterStateDocRef(),
    {
      json,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );
}
