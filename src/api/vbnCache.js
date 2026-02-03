import { fetchJson } from "./http.js";

const API_BASE = "https://vbn-tvt.northsea.cloud/v1/report";

function entryTopBirdsUrl({ year, id, limit = 9999 }) {
  return `${API_BASE}/entry-top-birds?year=${encodeURIComponent(String(year))}&id=${encodeURIComponent(
    String(id)
  )}&limit=${encodeURIComponent(String(limit))}`;
}

// In-memory request/result cache shared across app modules.
// key: `${year}|${id}|${limit}` -> Promise<{url,json}>
const ENTRY_TOP_BIRDS_CACHE = new Map();

export function getEntryTopBirdsCached({ year, id, limit = 9999, signal } = {}) {
  const key = `${String(year)}|${String(id)}|${String(limit)}`;
  if (!ENTRY_TOP_BIRDS_CACHE.has(key)) {
    const url = entryTopBirdsUrl({ year, id, limit });
    // Note: we intentionally do NOT include AbortSignal in the cache key.
    // If a request is aborted, we remove it from cache so a later call can retry.
    ENTRY_TOP_BIRDS_CACHE.set(key, (async () => {
      try {
        const json = await fetchJson(url, { signal });
        return { url, json };
      } catch (err) {
        ENTRY_TOP_BIRDS_CACHE.delete(key);
        throw err;
      }
    })());
  }
  return ENTRY_TOP_BIRDS_CACHE.get(key);
}

export function clearEntryTopBirdsCache() {
  const n = ENTRY_TOP_BIRDS_CACHE.size;
  ENTRY_TOP_BIRDS_CACHE.clear();
  return n;
}

