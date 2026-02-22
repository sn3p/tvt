export const DATA_BASE_URL = "/public/data/tvt";
export const DATA_BASE_URL_FALLBACK = "/data/tvt";

export class DataSource {
  async getManifest() {
    throw new Error("DataSource.getManifest() not implemented");
  }

  async getPointTile(_params) {
    throw new Error("DataSource.getPointTile() not implemented");
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

  async getPointTile({ year, mode, z, x, y }) {
    const manifest = await this.getManifest();
    const template = String(manifest?.paths?.points_root || "").trim();
    if (!template) {
      throw new Error("manifest.paths.points_root is missing");
    }

    const vars = {
      year: toSafeInt(year, "year"),
      mode: String(mode || "").trim() || "type1",
      z: toSafeInt(z, "z"),
      x: toSafeInt(x, "x"),
      y: toSafeInt(y, "y"),
    };
    const path = applyTemplate(template, vars);
    const url = joinUrl(this.baseUrl, path);

    if (this.tilePromiseByUrl.has(url)) return this.tilePromiseByUrl.get(url);

    const p = this.fetchImpl(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} while loading point tile (${url})`);
        return r.json();
      })
      .catch((err) => {
        this.tilePromiseByUrl.delete(url);
        throw err;
      });

    this.tilePromiseByUrl.set(url, p);
    return p;
  }
}
