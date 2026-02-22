const cache = new Map();

/**
 * Load a municipality dataset for a given year.
 *
 * Simple in-memory cache so switching years is instant after first load.
 * (We avoid localStorage because these JSON files are fairly large.)
 */
export async function loadMunicipalityDataset({ year, area = "groningen" } = {}) {
  const y = Number(year || 0) || 0;
  if (!y) throw new Error("year is required");
  if (area !== "groningen") throw new Error(`unsupported area: ${String(area)}`);

  const url = `./public/data/${encodeURIComponent(String(y))}/municipality_groningen.json`;
  if (cache.has(url)) return cache.get(url);

  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} bij laden dataset (${url})`);
      return r.json();
    })
    .catch((err) => {
      // Don't keep failed promises cached.
      cache.delete(url);
      throw err;
    });

  cache.set(url, p);
  return p;
}

export async function loadBirdguide() {
  const url = "./public/data/birdguide.json";
  if (cache.has(url)) return cache.get(url);

  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} bij laden birdguide (${url})`);
      return r.json();
    })
    .catch((err) => {
      cache.delete(url);
      throw err;
    });

  cache.set(url, p);
  return p;
}
