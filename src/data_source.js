const RUNTIME_CONFIG = globalThis.window?.__TVT_CONFIG__ || {};

export const BACKEND_API_BASE_URL = String(RUNTIME_CONFIG.backendApiBaseUrl || "http://localhost:3000/api/v1");
export const ENABLE_DIAGNOSTICS = RUNTIME_CONFIG.enableDiagnostics !== false;

export class DataSource {
  async getManifest() {
    throw new Error("DataSource.getManifest() not implemented");
  }

  async getPointTile(_params) {
    throw new Error("DataSource.getPointTile() not implemented");
  }

  async getPointStats(_params) {
    throw new Error("DataSource.getPointStats() not implemented");
  }

  async getPc4Bounds(_params) {
    throw new Error("DataSource.getPc4Bounds() not implemented");
  }

  async getEntryTopBirds(_params) {
    throw new Error("DataSource.getEntryTopBirds() not implemented");
  }

  async getStatus() {
    throw new Error("DataSource.getStatus() not implemented");
  }

  async getSpeciesManifest(_params) {
    throw new Error("DataSource.getSpeciesManifest() not implemented");
  }

  async getSpeciesCatalog(_params) {
    throw new Error("DataSource.getSpeciesCatalog() not implemented");
  }

  async getSpeciesGrid(_params) {
    throw new Error("DataSource.getSpeciesGrid() not implemented");
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

function appendIfPresent(params, key, value) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  params.set(key, text);
}

function bboxToParam(bbox) {
  if (!bbox) return "";
  if (Array.isArray(bbox) && bbox.length === 4) {
    return bbox.map((v) => Number(v)).join(",");
  }
  const { west, south, east, north } = boundsToEdges(bbox);
  return [west, south, east, north].join(",");
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

function withAbortSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(toAbortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(toAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
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

export const GRID_ZOOM_MAX_DEFAULT = 10;
export const CELL_ZOOM_EXTRA_DEFAULT = 5;

export function pointTileKind(json) {
  const kind = String(json?.kind || "").trim();
  if (kind === "cells" || kind === "points") return kind;
  if (Array.isArray(json?.cells)) return "cells";
  return "points";
}

export function emptyPointTile({
  year,
  mode,
  z,
  x,
  y,
  gridZoomMax = GRID_ZOOM_MAX_DEFAULT,
  cellZoomExtra = CELL_ZOOM_EXTRA_DEFAULT,
} = {}) {
  const zoom = Number(z) || 0;
  const kind = zoom <= Number(gridZoomMax || GRID_ZOOM_MAX_DEFAULT) ? "cells" : "points";
  const extra = Number(cellZoomExtra) || CELL_ZOOM_EXTRA_DEFAULT;
  const envelope = {
    contract_version: 2,
    year,
    mode,
    z,
    x,
    y,
    tileSize: 256,
    kind,
  };
  if (kind === "cells") {
    return { ...envelope, cell_z: zoom + extra, cells: [] };
  }
  return { ...envelope, points: [] };
}

export function recordsFromPointTile(json, { mode } = {}) {
  const isorg = String(mode || json?.mode || "").trim() === "isorg";
  const modeKey = isorg ? "isorg" : "private";
  const kind = pointTileKind(json);

  if (kind === "cells") {
    const cells = Array.isArray(json?.cells) ? json.cells : [];
    const out = [];
    for (const cell of cells) {
      const lat = Number(cell?.lat);
      const lng = Number(cell?.lng);
      const count = Number(cell?.count);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const weight = Number.isFinite(count) && count > 0 ? Math.round(count) : 1;
      out.push({
        kind: "cell",
        key: `cell:${modeKey}:${lat}:${lng}`,
        id: null,
        lat,
        lng,
        pc4: "",
        count: weight,
        isorg,
        modes: [modeKey],
        birds: [],
      });
    }
    return out;
  }

  const points = Array.isArray(json?.points) ? json.points : [];
  const out = [];
  for (const point of points) {
    const id = Number(point?.id);
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      kind: "point",
      key: `${modeKey}:${id}`,
      id,
      lat,
      lng,
      pc4: String(point?.pc4 ?? ""),
      count: 1,
      isorg,
      modes: [modeKey],
      birds: [],
    });
  }
  return out;
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
    this.gridZoomMax = GRID_ZOOM_MAX_DEFAULT;
    this.cellZoomExtra = CELL_ZOOM_EXTRA_DEFAULT;
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
          const json = await r.json();
          const gridZoomMax = Number(json?.defaults?.grid_zoom_max);
          const cellZoomExtra = Number(json?.defaults?.cell_zoom_extra);
          if (Number.isFinite(gridZoomMax) && gridZoomMax > 0) {
            this.gridZoomMax = gridZoomMax;
          }
          if (Number.isFinite(cellZoomExtra) && cellZoomExtra > 0) {
            this.cellZoomExtra = cellZoomExtra;
          }
          return json;
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
    if (this.tilePromiseByUrl.has(url)) {
      return withAbortSignal(this.tilePromiseByUrl.get(url), signal);
    }

    let p;
    p = this.fetchImpl(url, signal ? { signal } : undefined)
      .then((r) => {
        if (r.status === 404) {
          return emptyPointTile({
            year: vars.year,
            mode: vars.mode,
            z: vars.z,
            x: vars.x,
            y: vars.y,
            gridZoomMax: this.gridZoomMax,
            cellZoomExtra: this.cellZoomExtra,
          });
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend point tile (${url})`);
        return r.json();
      })
      .then((json) => {
        this.tileDataByUrl.set(url, json);
        return json;
      })
      .catch((err) => {
        if (this.tilePromiseByUrl.get(url) === p) this.tilePromiseByUrl.delete(url);
        if (isAbortError(err)) throw err;
        throw err;
      })
      .finally(() => {
        if (this.tilePromiseByUrl.get(url) === p) this.tilePromiseByUrl.delete(url);
      });

    this.tilePromiseByUrl.set(url, p);
    if (signal) {
      const dropInFlight = () => {
        if (this.tilePromiseByUrl.get(url) === p) {
          this.tilePromiseByUrl.delete(url);
        }
      };
      signal.addEventListener("abort", dropInFlight, { once: true });
    }
    return withAbortSignal(p, signal);
  }

  async getPointStats({ year, pc4, includePrivate = true, includeIsorg = true, bbox, scope = "both", signal } = {}) {
    const safeYear = toSafeInt(year, "year");
    const params = new URLSearchParams({ });
    appendIfPresent(params, "pc4", pc4);
    params.set("include_private", includePrivate ? "1" : "0");
    params.set("include_isorg", includeIsorg ? "1" : "0");
    params.set("scope", String(scope || "both"));
    appendIfPresent(params, "bbox", bboxToParam(bbox));
    const url = joinUrl(this.baseUrl, `years/${safeYear}/point_stats?${params.toString()}`);
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend point stats (${url})`);
    return r.json();
  }

  async getPc4Bounds({ year, pc4, signal } = {}) {
    await this.getManifest();
    const safeYear = toSafeInt(year, "year");
    const safePc4 = String(pc4 || "").trim();
    if (!safePc4.match(/^\d{4}$/)) {
      throw new Error("pc4 must be exactly 4 digits");
    }
    const url = joinUrl(
      this.baseUrl,
      `years/${safeYear}/pc4_bounds/${encodeURIComponent(safePc4)}`,
    );
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend pc4 bounds (${url})`);
    return r.json();
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

  async getSpeciesManifest({ year, area, signal } = {}) {
    const safeYear = toSafeInt(year, "year");
    const safeArea = String(area || "").trim();
    if (!safeArea) throw new Error("area is required for species manifest");
    const params = new URLSearchParams({ year: String(safeYear) });
    const url = joinUrl(this.baseUrl, `areas/${encodeURIComponent(safeArea)}/species_manifest?${params.toString()}`);
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend species manifest (${url})`);
    return r.json();
  }

  async getSpeciesCatalog({ year, area, pc4, includePrivate = true, includeIsorg = true, scope = "all", bbox, signal } = {}) {
    const safeYear = toSafeInt(year, "year");
    const safeArea = String(area || "").trim();
    const params = new URLSearchParams({ year: String(safeYear), scope: String(scope || "all") });
    appendIfPresent(params, "pc4", pc4);
    params.set("include_private", includePrivate ? "1" : "0");
    params.set("include_isorg", includeIsorg ? "1" : "0");
    if (scope === "viewport") appendIfPresent(params, "bbox", bboxToParam(bbox));
    const path = safeArea
      ? `areas/${encodeURIComponent(safeArea)}/species_catalog`
      : "species_catalog";
    const url = joinUrl(this.baseUrl, `${path}?${params.toString()}`);
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend species catalog (${url})`);
    return r.json();
  }

  async getSpeciesGrid({ year, area, birdId, metric, cellSizeM, minN = 1, pc4, includePrivate = true, includeIsorg = true, bbox, signal } = {}) {
    const safeYear = toSafeInt(year, "year");
    const safeBirdId = toSafeInt(birdId, "birdId");
    const safeArea = String(area || "").trim();
    const params = new URLSearchParams({
      year: String(safeYear),
      bird_id: String(safeBirdId),
      metric: String(metric || "presence"),
      cell_size_m: String(toSafeInt(cellSizeM, "cellSizeM")),
      min_n: String(toSafeInt(minN, "minN")),
    });
    appendIfPresent(params, "pc4", pc4);
    params.set("include_private", includePrivate ? "1" : "0");
    params.set("include_isorg", includeIsorg ? "1" : "0");
    appendIfPresent(params, "bbox", bboxToParam(bbox));
    const path = safeArea
      ? `areas/${encodeURIComponent(safeArea)}/species_grid`
      : "species_grid";
    const url = joinUrl(this.baseUrl, `${path}?${params.toString()}`);
    const r = await this.fetchImpl(url, signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading backend species grid (${url})`);
    return r.json();
  }
}
