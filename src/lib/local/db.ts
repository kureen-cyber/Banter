import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import type { Database } from "@/lib/local/types";

const BLOB_PATH = "banter/banter.json";
const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, "banter.json");
const WRITE_RETRIES = 12;

function isConcurrentBlobError(err: unknown): boolean {
  return (
    err instanceof BlobPreconditionFailedError ||
    /precondition|ifmatch|412|etag|conflict|concurrent/i.test(
      err instanceof Error ? err.message : String(err),
    )
  );
}

async function latestBlobEtag(): Promise<string | null> {
  try {
    const meta = await head(BLOB_PATH);
    return meta?.etag ?? null;
  } catch {
    return null;
  }
}

/** Process-local cache (warm instances). Blob is the source of truth in production. */
let memoryDb: Database | null = null;
let memoryEtag: string | null = null;

function useBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function seed(): Database {
  const now = new Date().toISOString();
  // Stable IDs so every serverless instance seeds the same channel set.
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

async function createSeedBlob(): Promise<{ db: Database; etag: string | null }> {
  const fresh = seed();
  try {
    // Create-only: if another instance wins the race, reload their DB instead of clobbering.
    const written = await put(BLOB_PATH, JSON.stringify(fresh, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { db: fresh, etag: written.etag };
  } catch {
    const again = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!again || again.statusCode !== 200 || !again.stream) {
      throw new Error("Could not initialize Banter data store.");
    }
    const raw = await new Response(again.stream).text();
    const { db } = normalizeDb(JSON.parse(raw) as Database);
    return { db, etag: again.blob.etag };
  }
}

async function loadFromBlob(): Promise<{ db: Database; etag: string | null }> {
  const result = await get(BLOB_PATH, {
    access: "private",
    useCache: false,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return createSeedBlob();
  }

  const raw = await new Response(result.stream).text();
  const parsed = JSON.parse(raw) as Database;
  const { db, dirty } = normalizeDb(parsed);
  if (!dirty) return { db, etag: result.blob.etag };

  try {
    const written = await put(BLOB_PATH, JSON.stringify(db, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ifMatch: result.blob.etag,
    });
    return { db, etag: written.etag };
  } catch (err) {
    if (!isConcurrentBlobError(err)) throw err;
    // Someone else already wrote — use their version.
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

async function ensureDb(): Promise<Database> {
  if (memoryDb) return memoryDb;

  if (useBlobStore()) {
    const { db, etag } = await loadFromBlob();
    memoryDb = db;
    memoryEtag = etag;
    return db;
  }

  const db = await loadFromDisk();
  memoryDb = db;
  memoryEtag = null;
  return db;
}

async function persistBlob(db: Database, etag: string | null) {
  const payload = JSON.stringify(db, null, 2);
  const match = (await latestBlobEtag()) ?? etag;
  const written = await put(BLOB_PATH, payload, {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(match ? { ifMatch: match } : {}),
  });
  memoryDb = db;
  memoryEtag = written.etag;
}

async function persistDisk(db: Database) {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  memoryDb = db;
}

let writeQueue: Promise<void> = Promise.resolve();

export async function readDb(): Promise<Database> {
  if (useBlobStore()) {
    // Always refresh from Blob so cold instances see signups from other instances.
    const { db, etag } = await loadFromBlob();
    memoryDb = db;
    memoryEtag = etag;
    return db;
  }
  return ensureDb();
}

export async function updateDb<T>(mutator: (db: Database) => T): Promise<T> {
  let result!: T;

  writeQueue = writeQueue.then(async () => {
    if (!useBlobStore()) {
      const db = await ensureDb();
      result = mutator(db);
      await persistDisk(db);
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
      try {
        const { db, etag } = await loadFromBlob();
        // Deep-ish clone via JSON so failed retries don't keep half-mutated state.
        const working = JSON.parse(JSON.stringify(db)) as Database;
        result = mutator(working);
        await persistBlob(working, etag);
        return;
      } catch (err) {
        lastError = err;
        if (isConcurrentBlobError(err) && attempt < WRITE_RETRIES - 1) {
          memoryDb = null;
          memoryEtag = null;
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
