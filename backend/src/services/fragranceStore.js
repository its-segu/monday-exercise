import { Storage } from "@mondaycom/apps-sdk";
import { randomUUID } from "node:crypto";

/**
 * Wraps Monday's monday-code Storage (a key/value store automatically scoped
 * to the current installer account + app) to give us a small CRUD layer for
 * fragrances.
 *
 * Storage layout:
 *   - "fragrance_index_v1"    -> { value: ["fr_amber-noir", ...] }
 *   - "fragrance:<id>"        -> { value: { id, name, description, ... } }
 */

const INDEX_KEY = "fragrance_index_v1";

let storageSingleton = null;

/**
 * Tiny in-memory adapter that mirrors the subset of the monday-code Storage
 * API we use. Only activated when MONDAY_TOKEN is missing (local dev).
 */
function createMemoryStorage() {
  const map = new Map();
  // eslint-disable-next-line no-console
  console.warn(
    "[fragranceStore] MONDAY_TOKEN not set — using in-memory storage. " +
      "Data will not persist across restarts. Set MONDAY_TOKEN in backend/.env " +
      "to use real monday-code Storage."
  );
  return {
    get: async (key) => ({ value: map.has(key) ? map.get(key) : null }),
    set: async (key, value) => {
      map.set(key, value);
    },
    delete: async (key) => {
      map.delete(key);
    },
  };
}

function getStorage() {
  if (!storageSingleton) {
    const token = process.env.MONDAY_TOKEN;
    if (!token) {
      storageSingleton = createMemoryStorage();
    } else {
      storageSingleton = new Storage(token);
    }
  }
  return storageSingleton;
}

async function readIndex() {
  const storage = getStorage();
  const result = await storage.get(INDEX_KEY);
  return Array.isArray(result?.value) ? result.value : [];
}

async function writeIndex(ids) {
  const storage = getStorage();
  await storage.set(INDEX_KEY, ids);
}

function fragranceKey(id) {
  return `fragrance:${id}`;
}

export async function listFragrances() {
  const ids = await readIndex();
  if (!ids.length) return [];
  const storage = getStorage();
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await storage.get(fragranceKey(id));
        return r?.value || null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

export async function getFragrance(id) {
  const storage = getStorage();
  const r = await storage.get(fragranceKey(id));
  return r?.value || null;
}

export async function createFragrance(input) {
  const storage = getStorage();
  const now = new Date().toISOString();
  const id = input.id || `fr_${randomUUID()}`;
  const fragrance = {
    id,
    name: String(input.name || "").trim(),
    description: input.description ? String(input.description) : "",
    category: input.category ? String(input.category) : "",
    image_url: input.image_url ? String(input.image_url) : "",
    created_at: now,
    updated_at: now,
  };
  if (!fragrance.name) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }

  await storage.set(fragranceKey(id), fragrance);
  const ids = await readIndex();
  if (!ids.includes(id)) {
    await writeIndex([...ids, id]);
  }
  return fragrance;
}

export async function updateFragrance(id, patch) {
  const existing = await getFragrance(id);
  if (!existing) {
    const err = new Error(`fragrance ${id} not found`);
    err.statusCode = 404;
    throw err;
  }
  const storage = getStorage();
  const next = {
    ...existing,
    ...patch,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
  await storage.set(fragranceKey(id), next);
  return next;
}

export async function deleteFragrance(id) {
  const storage = getStorage();
  const existing = await getFragrance(id);
  if (!existing) return false;
  if (typeof storage.delete === "function") {
    await storage.delete(fragranceKey(id));
  } else if (typeof storage.remove === "function") {
    await storage.remove(fragranceKey(id));
  } else {
    await storage.set(fragranceKey(id), null);
  }
  const ids = await readIndex();
  await writeIndex(ids.filter((x) => x !== id));
  return true;
}

export async function bulkSeedFragrances(fragrances) {
  const ids = await readIndex();
  if (ids.length > 0) return { skipped: true, count: ids.length };
  const storage = getStorage();
  const now = new Date().toISOString();
  const seeded = fragrances.map((f) => ({
    ...f,
    created_at: f.created_at || now,
    updated_at: f.updated_at || now,
  }));
  await Promise.all(
    seeded.map((f) => storage.set(fragranceKey(f.id), f))
  );
  await writeIndex(seeded.map((f) => f.id));
  return { skipped: false, count: seeded.length };
}
