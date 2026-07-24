import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import {
  isFirestoreDataConfigured,
  readBanterStateJson,
  writeBanterStateJson,
} from "@/lib/firebase/server-data";
import type { Database } from "@/lib/local/types";

const BLOB_PATH = "banter/banter.json";
const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, "banter.json");
const WRITE_RETRIES = 12;
/** Avoid hammering Gist/Firestore on every 2.5s poll from every open tab. */
const READ_TTL_MS = 2_000;

type StoreKind = "firestore" | "gist" | "blob" | "disk";

/** Process-local cache (warm instances). Remote store is the source of truth. */
let memoryDb: Database | null = null;
let memoryEtag: string | null = null;
let memoryLoadedAt = 0;

function touchMemory(db: Database, etag: string | null = null) {
  memoryDb = db;
  memoryEtag = etag;
  memoryLoadedAt = Date.now();
}

function cachedDb(): Database | null {
  if (!memoryDb) return null;
  if (Date.now() - memoryLoadedAt > READ_TTL_MS) return null;
  return memoryDb;
}

function gistConfig() {
  const id = process.env.BANTER_GIST_ID?.trim();
  const token = process.env.BANTER_GITHUB_TOKEN?.trim();
  const filename = process.env.BANTER_GIST_FILENAME?.trim() || "banter.json";
  if (!id || !token) return null;
  return { id, token, filename };
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return typeof token === "string" && token.trim() !== "" ? token.trim() : undefined;
}

function blobOptions(extra?: Record<string, unknown>) {
  return {
    access: "private" as const,
    ...(blobToken() ? { token: blobToken() } : {}),
    ...extra,
  };
}

function storeKind(): StoreKind {
  // Prefer Firestore (shared PM Firebase) — avoids Vercel Blob billing and GitHub Gist quotas.
  if (isFirestoreDataConfigured()) return "firestore";
  if (gistConfig()) return "gist";
  if (blobToken()) return "blob";
  return "disk";
}

function isConcurrentBlobError(err: unknown): boolean {
  return (
    err instanceof BlobPreconditionFailedError ||
    /precondition|ifmatch|412|etag|conflict|concurrent/i.test(
      err instanceof Error ? err.message : String(err),
    )
  );
}

function isConcurrentRemoteError(err: unknown): boolean {
  return /409|422|conflict|sha|aborted|unavailable|too many|rate/i.test(
    err instanceof Error ? err.message : String(err),
  );
}

function seed(): Database {
  const now = new Date().toISOString();
  const channels = [
    ["11111111-1111-4111-8111-111111111101", "general", "General", "Cohort-wide conversation"],
    ["11111111-1111-4111-8111-111111111102", "announcements", "Announcements", "Official updates"],
    ["11111111-1111-4111-8111-111111111103", "project-1", "Project 1", "Project 1 coordination"],
    ["11111111-1111-4111-8111-111111111104", "backend-help", "Backend Help", "Backend questions and support"],
    ["11111111-1111-4111-8111-111111111105", "ai-discussions", "AI Discussions", "AI topics and experiments"],
    ["11111111-1111-4111-8111-111111111106", "career", "Career", "Jobs, networking, advice"],
    ["11111111-1111-4111-8111-111111111107", "random", "Random", "Off-topic banter"],
  ].map(([id, slug, name, description]) => ({
    id,
    slug,
    name,
    description,
    is_private: false,
    created_by: null,
    created_at: now,
    archived_at: null,
  }));

  return {
    users: [],
    channels,
    channel_members: [],
    conversations: [],
    conversation_participants: [],
    messages: [],
    notifications: [],
    banterlina_messages: [],
  };
}

function normalizeDb(db: Database): { db: Database; dirty: boolean } {
  let dirty = false;
  if (!Array.isArray(db.banterlina_messages)) {
    db.banterlina_messages = [];
    dirty = true;
  }
  for (const channel of db.channels) {
    if (channel.archived_at === undefined) {
      channel.archived_at = null;
      dirty = true;
    }
  }
  for (const user of db.users) {
    if (user.firebase_uid === undefined) {
      user.firebase_uid = null;
      dirty = true;
    }
    if (user.github_handle === undefined) {
      user.github_handle = null;
      dirty = true;
    }
    if (!Array.isArray(user.auth_providers)) {
      user.auth_providers = user.password_hash ? ["banter"] : ["firebase"];
      dirty = true;
    }
  }
  return { db, dirty };
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "banter-app",
  };
}

async function loadFromFirestore(): Promise<{ db: Database; etag: string | null }> {
  const raw = await readBanterStateJson();
  if (!raw?.trim()) {
    const fresh = seed();
    await writeBanterStateJson(JSON.stringify(fresh));
    return { db: fresh, etag: null };
  }
  const { db, dirty } = normalizeDb(JSON.parse(raw) as Database);
  if (dirty) await writeBanterStateJson(JSON.stringify(db));
  return { db, etag: null };
}

async function persistFirestore(db: Database) {
  await writeBanterStateJson(JSON.stringify(db));
  touchMemory(db, null);
}

async function loadFromGist(): Promise<{ db: Database; etag: string | null }> {
  const cfg = gistConfig();
  if (!cfg) throw new Error("Gist storage is not configured.");

  const res = await fetch(`https://api.github.com/gists/${cfg.id}`, {
    headers: githubHeaders(cfg.token),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist read failed (${res.status}): ${text.slice(0, 160)}`);
  }

  const payload = (await res.json()) as {
    files?: Record<
      string,
      { content?: string; truncated?: boolean; raw_url?: string }
    >;
  };
  const file = payload.files?.[cfg.filename];
  if (!file) {
    const fresh = seed();
    await persistGist(fresh);
    return { db: fresh, etag: null };
  }

  let raw = file.content ?? "";
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, {
      headers: githubHeaders(cfg.token),
      cache: "no-store",
    });
    if (!rawRes.ok) {
      throw new Error(`Gist raw download failed (${rawRes.status}).`);
    }
    raw = await rawRes.text();
  }

  if (!raw.trim()) {
    const fresh = seed();
    await persistGist(fresh);
    return { db: fresh, etag: null };
  }

  const { db, dirty } = normalizeDb(JSON.parse(raw) as Database);
  if (dirty) await persistGist(db);
  return { db, etag: null };
}

async function persistGist(db: Database) {
  const cfg = gistConfig();
  if (!cfg) throw new Error("Gist storage is not configured.");
  const content = JSON.stringify(db, null, 2);
  const res = await fetch(`https://api.github.com/gists/${cfg.id}`, {
    method: "PATCH",
    headers: {
      ...githubHeaders(cfg.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        [cfg.filename]: { content },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist write failed (${res.status}): ${text.slice(0, 160)}`);
  }
  touchMemory(db, null);
}

async function latestBlobEtag(): Promise<string | null> {
  try {
    const meta = await head(BLOB_PATH, blobOptions());
    return meta?.etag ?? null;
  } catch {
    return null;
  }
}

async function createSeedBlob(): Promise<{ db: Database; etag: string | null }> {
  const fresh = seed();
  try {
    const written = await put(
      BLOB_PATH,
      JSON.stringify(fresh, null, 2),
      blobOptions({
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    );
    return { db: fresh, etag: written.etag };
  } catch {
    const again = await get(BLOB_PATH, blobOptions({ useCache: false }));
    if (!again || again.statusCode !== 200 || !again.stream) {
      throw new Error("Could not initialize Banter data store.");
    }
    const raw = await new Response(again.stream).text();
    const { db } = normalizeDb(JSON.parse(raw) as Database);
    return { db, etag: again.blob.etag };
  }
}

async function loadFromBlob(): Promise<{ db: Database; etag: string | null }> {
  const result = await get(BLOB_PATH, blobOptions({ useCache: false }));

  if (!result || result.statusCode !== 200 || !result.stream) {
    return createSeedBlob();
  }

  const raw = await new Response(result.stream).text();
  const parsed = JSON.parse(raw) as Database;
  const { db, dirty } = normalizeDb(parsed);
  if (!dirty) return { db, etag: result.blob.etag };

  try {
    const written = await put(
      BLOB_PATH,
      JSON.stringify(db, null, 2),
      blobOptions({
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: result.blob.etag,
      }),
    );
    return { db, etag: written.etag };
  } catch (err) {
    if (!isConcurrentBlobError(err)) throw err;
    return loadFromBlob();
  }
}

async function loadFromDisk(): Promise<Database> {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(LOCAL_DB_PATH, "utf8");
    const { db, dirty } = normalizeDb(JSON.parse(raw) as Database);
    if (dirty) {
      await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
    }
    return db;
  } catch {
    const fresh = seed();
    await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

async function loadRemote(
  kind: Exclude<StoreKind, "disk">,
): Promise<{ db: Database; etag: string | null }> {
  if (kind === "firestore") return loadFromFirestore();
  if (kind === "gist") return loadFromGist();
  return loadFromBlob();
}

async function persistRemote(
  kind: Exclude<StoreKind, "disk">,
  db: Database,
  etag: string | null,
) {
  if (kind === "firestore") return persistFirestore(db);
  if (kind === "gist") return persistGist(db);
  return persistBlob(db, etag);
}

async function ensureDb(): Promise<Database> {
  const hit = cachedDb();
  if (hit) return hit;

  const kind = storeKind();
  if (kind !== "disk") {
    const { db, etag } = await loadRemote(kind);
    touchMemory(db, etag);
    return db;
  }

  const db = await loadFromDisk();
  touchMemory(db, null);
  return db;
}

async function persistBlob(db: Database, etag: string | null) {
  const payload = JSON.stringify(db, null, 2);
  const match = (await latestBlobEtag()) ?? etag;
  const written = await put(
    BLOB_PATH,
    payload,
    blobOptions({
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(match ? { ifMatch: match } : {}),
    }),
  );
  touchMemory(db, written.etag);
}

async function persistDisk(db: Database) {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  touchMemory(db, null);
}

let writeQueue: Promise<void> = Promise.resolve();

export async function readDb(): Promise<Database> {
  const hit = cachedDb();
  if (hit) return hit;

  const kind = storeKind();
  if (kind === "disk") return ensureDb();

  const { db, etag } = await loadRemote(kind);
  touchMemory(db, etag);
  return db;
}

export async function updateDb<T>(mutator: (db: Database) => T): Promise<T> {
  let result!: T;

  writeQueue = writeQueue.then(async () => {
    const kind = storeKind();

    if (kind === "disk") {
      const db = await ensureDb();
      result = mutator(db);
      await persistDisk(db);
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
      try {
        // Writes always reload fresh so we don't overwrite with a stale TTL cache.
        memoryLoadedAt = 0;
        const loaded = await loadRemote(kind);
        const working = JSON.parse(JSON.stringify(loaded.db)) as Database;
        result = mutator(working);
        await persistRemote(kind, working, loaded.etag);
        return;
      } catch (err) {
        lastError = err;
        const concurrent =
          kind === "blob"
            ? isConcurrentBlobError(err)
            : isConcurrentRemoteError(err);
        if (concurrent && attempt < WRITE_RETRIES - 1) {
          memoryDb = null;
          memoryEtag = null;
          memoryLoadedAt = 0;
          await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to persist Banter data.");
  });

  await writeQueue;
  return result;
}

export function newId() {
  return randomUUID();
}

export function toProfile(user: Database["users"][number]) {
  const { password_hash: _, ...profile } = user;
  return profile;
}
