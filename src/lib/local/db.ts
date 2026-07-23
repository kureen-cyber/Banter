import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { Database } from "@/lib/local/types";

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "banter-data")
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "banter.json");

/** Keep a process-local cache so warm Vercel instances stay consistent. */
let memoryDb: Database | null = null;

function seed(): Database {
  const now = new Date().toISOString();
  const channels = [
    ["general", "General", "Cohort-wide conversation"],
    ["announcements", "Announcements", "Official updates"],
    ["project-1", "Project 1", "Project 1 coordination"],
    ["backend-help", "Backend Help", "Backend questions and support"],
    ["ai-discussions", "AI Discussions", "AI topics and experiments"],
    ["career", "Career", "Jobs, networking, advice"],
    ["random", "Random", "Off-topic banter"],
  ].map(([slug, name, description]) => ({
    id: randomUUID(),
    slug,
    name,
    description,
    is_private: false,
    created_by: null,
    created_at: now,
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

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDb(): Promise<Database> {
  if (memoryDb) return memoryDb;
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Database;
    let dirty = false;
    if (!Array.isArray(db.banterlina_messages)) {
      db.banterlina_messages = [];
      dirty = true;
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
    if (dirty) {
      await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    }
    memoryDb = db;
    return db;
  } catch {
    const fresh = seed();
    await fs.writeFile(DB_PATH, JSON.stringify(fresh, null, 2), "utf8");
    memoryDb = fresh;
    return fresh;
  }
}

export async function readDb(): Promise<Database> {
  return ensureDb();
}

export async function updateDb<T>(
  mutator: (db: Database) => T,
): Promise<T> {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const db = await ensureDb();
    result = mutator(db);
    memoryDb = db;
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
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
