const DB_NAME = "banter-tones";
const STORE = "custom";
const KEY = "message-tone";

export type CustomToneMeta = {
  name: string;
  mime: string;
  size: number;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveCustomTone(file: File): Promise<CustomToneMeta> {
  const maxBytes = 3 * 1024 * 1024;
  if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(file.name)) {
    throw new Error("Please choose an audio file (mp3, m4a, wav, etc.).");
  }
  if (file.size > maxBytes) {
    throw new Error("Keep custom tones under 3 MB.");
  }

  const buffer = await file.arrayBuffer();
  const meta: CustomToneMeta = {
    name: file.name,
    mime: file.type || "audio/mpeg",
    size: file.size,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ meta, buffer }, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save tone."));
  });
  db.close();
  return meta;
}

export async function loadCustomTone(): Promise<{
  meta: CustomToneMeta;
  blob: Blob;
} | null> {
  const db = await openDb();
  const row = await new Promise<{ meta: CustomToneMeta; buffer: ArrayBuffer } | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Could not load tone."));
    },
  );
  db.close();
  if (!row?.buffer || !row.meta) return null;
  return {
    meta: row.meta,
    blob: new Blob([row.buffer], { type: row.meta.mime || "audio/mpeg" }),
  };
}

export async function clearCustomTone() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not remove tone."));
  });
  db.close();
}

export async function playCustomToneBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const audio = new Audio(url);
    audio.volume = 0.85;
    await audio.play();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}
