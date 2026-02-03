const DEFAULT_PREFIX = "mvt:";

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function nowMs() {
  return Date.now();
}

export function createCache({ prefix = DEFAULT_PREFIX, storage = window.localStorage } = {}) {
  const mem = new Map();

  function fullKey(key) {
    return `${prefix}${key}`;
  }

  function get(key) {
    const k = fullKey(key);
    const t = nowMs();

    const memHit = mem.get(k);
    if (memHit && memHit.expiresAt > t) {
      return { hit: true, from: "memory", ...memHit };
    }

    const raw = storage.getItem(k);
    if (!raw) return { hit: false };
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") return { hit: false };
    const { value, expiresAt, savedAt } = parsed;
    if (!expiresAt || expiresAt <= t) {
      try {
        storage.removeItem(k);
      } catch {
        // ignore
      }
      return { hit: false };
    }

    const entry = { value, expiresAt, savedAt: savedAt ?? t };
    mem.set(k, entry);
    return { hit: true, from: "localStorage", ...entry };
  }

  function set(key, value, { ttlMs }) {
    const k = fullKey(key);
    const t = nowMs();
    const entry = { value, savedAt: t, expiresAt: t + ttlMs };
    mem.set(k, entry);
    try {
      storage.setItem(k, JSON.stringify(entry));
    } catch {
      // localStorage can be full/blocked; ignore and keep memory cache
    }
    return entry;
  }

  function del(key) {
    const k = fullKey(key);
    mem.delete(k);
    try {
      storage.removeItem(k);
    } catch {
      // ignore
    }
  }

  function clearAll() {
    mem.clear();
    const keysToDelete = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => {
      try {
        storage.removeItem(k);
      } catch {
        // ignore
      }
    });
    return keysToDelete.length;
  }

  return { get, set, del, clearAll, prefix };
}

export function cacheKey(parts) {
  return parts.map((p) => String(p ?? "").trim()).join("|");
}

