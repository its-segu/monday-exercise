import { Storage } from "@mondaycom/apps-sdk";
import { randomUUID } from "node:crypto";

// Storage layout (monday-code Storage is a per-installer KV store):
//   "fragrance_index_v1" → string[]   list of fragrance ids
//   "fragrance:<id>"     → Fragrance  full record
const INDEX_KEY = "fragrance_index_v1";
const fragranceKey = (id) => `fragrance:${id}`;

let storageSingleton = null;

// Local-dev fallback when MONDAY_TOKEN isn't set. Mirrors only the subset of
// the Storage API we use.
function createMemoryStorage() {
  const map = new Map();
  console.warn(
    "[fragranceStore] MONDAY_TOKEN not set — using in-memory storage. " +
      "Data will not persist across restarts.",
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
  if (storageSingleton) return storageSingleton;
  const token = process.env.MONDAY_TOKEN;
  storageSingleton = token ? new Storage(token) : createMemoryStorage();
  return storageSingleton;
}

async function readIndex() {
  const result = await getStorage().get(INDEX_KEY);
  return Array.isArray(result?.value) ? result.value : [];
}

async function writeIndex(ids) {
  await getStorage().set(INDEX_KEY, ids);
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
    }),
  );
  return results.filter(Boolean);
}

export async function getFragrance(id) {
  const r = await getStorage().get(fragranceKey(id));
  return r?.value || null;
}

export async function createFragrance(input) {
  const name = String(input.name || "").trim();
  if (!name) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const id = input.id || `fr_${randomUUID()}`;
  const fragrance = {
    id,
    name,
    description: input.description ? String(input.description) : "",
    category: input.category ? String(input.category) : "",
    image_url: input.image_url ? String(input.image_url) : "",
    created_at: now,
    updated_at: now,
  };

  await getStorage().set(fragranceKey(id), fragrance);
  const ids = await readIndex();
  if (!ids.includes(id)) await writeIndex([...ids, id]);
  return fragrance;
}

export async function updateFragrance(id, patch) {
  const existing = await getFragrance(id);
  if (!existing) {
    const err = new Error(`fragrance ${id} not found`);
    err.statusCode = 404;
    throw err;
  }
  const next = {
    ...existing,
    ...patch,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
  await getStorage().set(fragranceKey(id), next);
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

// Upserts every fragrance from the seed file on every boot:
//   - new ids are inserted
//   - existing ids are refreshed, preserving original `created_at`
// Switch to add-missing-only if real customer data ever needs protection.
export async function bulkSeedFragrances(fragrances) {
  const storage = getStorage();
  const existingIds = new Set(await readIndex());
  const now = new Date().toISOString();

  const seeded = await Promise.all(
    fragrances.map(async (f) => {
      const existing = existingIds.has(f.id) ? await getFragrance(f.id) : null;
      return {
        ...f,
        created_at: existing?.created_at || f.created_at || now,
        updated_at: now,
      };
    }),
  );

  await Promise.all(seeded.map((f) => storage.set(fragranceKey(f.id), f)));

  const nextIndex = seeded.map((f) => f.id);
  await writeIndex(nextIndex);

  const added = nextIndex.filter((id) => !existingIds.has(id)).length;
  return {
    added,
    refreshed: nextIndex.length - added,
    count: nextIndex.length,
  };
}
