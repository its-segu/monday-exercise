/**
 * Thin client for the fragrance API. Reads the base URL from a Vite env var so
 * it can be swapped between the local backend and the deployed monday-code URL.
 *
 * Env var: VITE_FRAGRANCE_API_URL  (e.g. http://localhost:8080)
 *
 * Falls back to the bundled catalog (src/data/fragrances.js) on any failure —
 * including the common case where the page is loaded over HTTPS (the tunnel)
 * and the browser blocks a request to plain-HTTP localhost.
 */
import { FRAGRANCES as BUNDLED_FRAGRANCES } from "../data/fragrances";

const BASE_URL = import.meta.env?.VITE_FRAGRANCE_API_URL || "";

class FragranceApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "FragranceApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new FragranceApiError("VITE_FRAGRANCE_API_URL is not configured");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FragranceApiError(
      `Fragrance API error ${res.status}: ${text}`,
      { status: res.status }
    );
  }
  if (res.status === 204) return null;
  return res.json();
}

export const fragrancesApi = {
  /**
   * Try the live API first; fall through to the bundled catalog on any
   * failure (network blocked, mixed content, server down, etc.). Returns the
   * shape `{ data, source }` so callers can show a small badge if they want.
   */
  list: async () => {
    try {
      const data = await request("/fragrances");
      return { data, source: "api" };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[fragrancesApi] live fetch failed, falling back to bundled catalog:",
        err?.message || err
      );
      return { data: BUNDLED_FRAGRANCES, source: "bundled" };
    }
  },
  get: (id) => request(`/fragrances/${encodeURIComponent(id)}`),
  create: (body) =>
    request("/fragrances", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/fragrances/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id) =>
    request(`/fragrances/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
