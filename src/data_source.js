const RUNTIME_CONFIG = globalThis.window?.__TVT_CONFIG__ || {};

export const DATA_BASE_URL = String(RUNTIME_CONFIG.staticDataBaseUrl || "/public/data/tvt");
export const DATA_BASE_URL_FALLBACK = String(RUNTIME_CONFIG.staticDataBaseUrlFallback || "/data/tvt");
export const BACKEND_API_BASE_URL = String(RUNTIME_CONFIG.backendApiBaseUrl || "http://localhost:3000/api/v1");
export const ENTRY_TOP_BIRDS_API_BASE = String(RUNTIME_CONFIG.entryTopBirdsApiBase || "https://vbn-tvt.northsea.cloud/v1/report");
export const ALLOW_STATIC_DATA_FALLBACK = RUNTIME_CONFIG.allowStaticDataFallback !== false;
export const ALLOW_UPSTREAM_DETAILS_FALLBACK = RUNTIME_CONFIG.allowUpstreamDetailsFallback !== false;

export class DataSource {
  async getManifest() {
    throw new Error("DataSource.getManifest() not implemented");
  }

  async getPointTile(_params) {
    throw new Error("DataSource.getPointTile() not implemented");
  }

  async getEntryTopBirds(_params) {
    throw new Error("DataSource.getEntryTopBirds() not implemented");
  }

  async getStatus() {
    throw new Error("DataSource.getStatus() not implemented");
  }
}

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const rel = String(path || "").replace(/^\/+/, "");
  return `${base}/${rel}`;
}

function toSafeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return n;
}

function applyTemplate(template, vars) {
  return String(template).replaceAll(/\{([a-zA-Z0-9_]+)\}/g, (_full, key) => {
    if (!(key in vars)) throw new Error(`missing template variable: ${key}`);
    return encodeURIComponent(String(vars[key]));
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toAbortError() {
  try {
    return new DOMException("The operation was aborted.", "AbortError");
  } catch {
    const e = new Error("The operation was aborted.");
    e.name = "AbortError";
    return e;
  }
}

export function isAbortError(err) {
  return Boolean(err && typeof err === "object" && err.name === "AbortError");
}

function normalizeBirdRows(json) {
  if (Array.isArray(json?.birds)) {
    return json.birds
      .map((b) => ({
        name: String(b?.name ?? "").trim(),
        count: Number(b?.count ?? 0) || 0,
      }))
      .filter((b) => b.name)
      .sort((a, b) => b.count - a.count);
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  return data
    .map((b) => ({
      name: String(b?.name ?? b?.vogelnaam ?? "").trim(),
      count: Number(b?.number ?? b?.count ?? 0) || 0,
    }))
    .filter((b) => b.name)
    .sort((a, b) => b.count - a.count);
}

export function lngLatToTileXY({ lng, lat, z }) {
  const zoom = toSafeInt(z, "z");
  const n = 2 ** zoom;
  const latClamped = clamp(Number(lat), -85.05112878, 85.05112878);
  const lngNorm = Number(lng);
  const x = Math.floor(((lngNorm + 180) / 360) * n);
  const latRad = (latClamped * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * n
  );
  return {
    x: clamp(x, 0, n - 1),
    y: clamp(y, 0, n - 1),
  };
}

function boundsToEdges(bounds) {
  if (bounds && typeof bounds.getWest === "function") {
    return {
      west: Number(bounds.getWest()),
      south: Number(bounds.getSouth()),
      east: Number(bounds.getEast()),
      north: Number(bounds.getNorth()),
    };
  }

  if (
    bounds &&
    Number.isFinite(Number(bounds.west)) &&
    Number.isFinite(Number(bounds.south)) &&
    Number.isFinite(Number(bounds.east)) &&
    Number.isFinite(Number(bounds.north))
  ) {
    return {
      west: Number(bounds.west),
      south: Number(bounds.south),
      east: Number(bounds.east),
      north: Number(bounds.north),
    };
  }

  throw new Error("tilesForBounds requires Leaflet bounds or {west,south,east,north}");
}

export function tilesForBounds(bounds, z, bufferTiles = 1) {
  const zoom = toSafeInt(z, "z");
  const worldMax = (2 ** zoom) - 1;
  const buffer = toSafeInt(bufferTiles, "bufferTiles");
  const { west, south, east, north } = boundsToEdges(bounds);

  const nw = lngLatToTileXY({ lng: west, lat: north, z: zoom });
  const se = lngLatToTileXY({ lng: east, lat: south, z: zoom });

  const minX = clamp(Math.min(nw.x, se.x) - buffer, 0, worldMax);
  const maxX = clamp(Math.max(nw.x, se.x) + buffer, 0, worldMax);
  const minY = clamp(Math.min(nw.y, se.y) - buffer, 0, worldMax);
  const maxY = clamp(Math.max(nw.y, se.y) + buffer, 0, worldMax);

  const out = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      out.push({ z: zoom, x, y, key: `${zoom}/${x}/${y}` });
    }
  }
  return out;
}

export class StaticTilesSource extends DataSource {
  constructor({ baseUrl = DATA_BASE_URL, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
    super();
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is not available in this environment");
    }
    this.baseUrl = String(baseUrl || DATA_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
    this.manifestPromise = null;
    this.tilePromiseByUrl = new Map();
    this.tileDataByUrl = new Map();
    this.baseUrlCandidates = [this.baseUrl];
    if (this.baseUrl === DATA_BASE_URL && DATA_BASE_URL_FALLBACK !== DATA_BASE_URL) {
      this.baseUrlCandidates.push(DATA_BASE_URL_FALLBACK);
    }
  }

  async getManifest() {
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      let lastErr = null;

      for (const candidateBaseUrl of this.baseUrlCandidates) {
        const url = joinUrl(candidateBaseUrl, "manifest.json");
        const r = await this.fetchImpl(url);
        if (r.ok) {
          // Lock to the base URL that actually works (for subsequent tile fetches).
          this.baseUrl = candidateBaseUrl;
          return r.json();
        }
        lastErr = new Error(`HTTP ${r.status} while loading manifest (${url})`);
        // Fallback is only intended for "not found"; other errors should fail fast.
        if (r.status !== 404) throw lastErr;
      }

      throw lastErr || new Error("manifest load failed");
    })().catch((err) => {
      this.manifestPromise = null;
      throw err;
    });

    return this.manifestPromise;
  }

  async getPointTile({ year, mode, z, x, y, signal } = {}) {
    const manifest = await this.getManifest();
    const template = String(manifest?.paths?.points_root || "").trim();
    if (!template) {
      throw new Error("manifest.paths.points_root is missing");
    }

    const vars = {
      year: toSafeInt(year, "year"),
      mode: String(mode || "").trim() || "private",
      z: toSafeInt(z, "z"),
      x: toSafeInt(x, "x"),
      y: toSafeInt(y, "y"),
    };
    const path = applyTemplate(template, vars);
    const url = joinUrl(this.baseUrl, path);

    if (this.tileDataByUrl.has(url)) return this.tileDataByUrl.get(url);

    if (signal?.aborted) throw toAbortError();

    // Only share in-flight promises if no abort signal is provided.
    if (!signal && this.tilePromiseByUrl.has(url)) return this.tilePromiseByUrl.get(url);

    const p = this.fetchImpl(url, signal ? { signal } : undefined)
      .then((r) => {
        // Sparse exports may omit empty tiles on disk. Treat 404 as an empty tile.
        if (r.status === 404) {
          return {
            contract_version: Number(manifest?.contract_version ?? 1) || 1,
            year: vars.year,
            mode: vars.mode,
            z: vars.z,
            x: vars.x,
            y: vars.y,
            tileSize: 256,
            points: [],
          };
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} while loading point tile (${url})`);
        return r.json();
      })
      .then((json) => {
        this.tileDataByUrl.set(url, json);
        return json;
      })
      .catch((err) => {
        if (!signal) this.tilePromiseByUrl.delete(url);
        if (isAbortError(err)) throw err;
        throw err;
      });

    if (!signal) this.tilePromiseByUrl.set(url, p);
    return p;
  }

  async getEntryTopBirds({ year, id, limit = 9999, signal } = {}) {
    const params = new URLSearchParams();
    if (Number(year) > 0) params.set("year", String(Number(year)));
    params.set("id", String(Number(id)));
    params.set("limit", String(Number(limit) || 9999));

    const url = `${ENTRY_TOP_BIRDS_API_BASE}/entry-top-birds?${params.toString()}`;
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading point details (${url})`);
    return normalizeBirdRows(await r.json());
  }
}

export class BackendApiSource extends DataSource {
  constructor({
    baseUrl = BACKEND_API_BASE_URL,
    fetchImpl = globalThis.fetch?.bind(globalThis),
  } = {}) {
    super();
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is not available in this environment");
    }
    this.baseUrl = String(baseUrl || BACKEND_API_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
    this.manifestPromise = null;
    this.tilePromiseByUrl = new Map();
    this.tileDataByUrl = new Map();
    this.baseUrlCandidates = [this.baseUrl];
  }

  async getManifest() {
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      let lastErr = null;

      for (const candidateBaseUrl of this.baseUrlCandidates) {
        const url = joinUrl(candidateBaseUrl, "point_tiles/manifest");
        const r = await this.fetchImpl(url);
        if (r.ok) {
          this.baseUrl = candidateBaseUrl;
          return r.json();
        }
        lastErr = new Error(`HTTP ${r.status} while loading backend manifest (${url})`);
        if (r.status !== 404) throw lastErr;
      }

      throw lastErr || new Error("backend manifest load failed");
    })().catch((err) => {
      this.manifestPromise = null;
      throw err;
    });

    return this.manifestPromise;
  }

  async getPointTile({ year, mode, z, x, y, signal } = {}) {
    await this.getManifest();
    const vars = {
      year: toSafeInt(year, "year"),
      mode: String(mode || "").trim() || "private",
      z: toSafeInt(z, "z"),
      x: toSafeInt(x, "x"),
      y: toSafeInt(y, "y"),
    };
    const url = joinUrl(this.baseUrl, `years/${vars.year}/point_tiles/${encodeURIComponent(vars.mode)}/${vars.z}/${vars.x}/${vars.y}`);

    if (this.tileDataByUrl.has(url)) return this.tileDataByUrl.get(url);
    if (signal?.aborted) throw toAbortError();
    if (!signal && this.tilePromiseByUrl.has(url)) return this.tilePromiseByUrl.get(url);

    const p = this.fetchImpl(url, signal ? { signal } : undefined)
      .then((r) => {
        if (r.status === 404) {
          return {
            contract_version: 1,
            year: vars.year,
            mode: vars.mode,
            z: vars.z,
            x: vars.x,
            y: vars.y,
            tileSize: 256,
            points: [],
          };
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend point tile (${url})`);
        return r.json();
      })
      .then((json) => {
        this.tileDataByUrl.set(url, json);
        return json;
      })
      .catch((err) => {
        if (!signal) this.tilePromiseByUrl.delete(url);
        if (isAbortError(err)) throw err;
        throw err;
      });

    if (!signal) this.tilePromiseByUrl.set(url, p);
    return p;
  }

  async getEntryTopBirds({ year, id, signal } = {}) {
    await this.getManifest();
    const safeYear = toSafeInt(year, "year");
    const safeId = toSafeInt(id, "id");
    const url = joinUrl(this.baseUrl, `years/${safeYear}/entries/${safeId}/top_birds`);
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend point details (${url})`);
    return normalizeBirdRows(await r.json());
  }

  async getStatus({ signal } = {}) {
    const url = joinUrl(this.baseUrl, "status");
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend status (${url})`);
    return r.json();
  }
}
