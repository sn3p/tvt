import { fetchJson } from "./http.js";

const PDOK_FREE_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

function parsePointWkt(pointWkt) {
  // Example: "POINT(6.57929978 53.19531541)" => { lng, lat }
  if (!pointWkt || typeof pointWkt !== "string") return null;
  const m = pointWkt.match(/POINT\s*\(\s*([0-9.\-]+)\s+([0-9.\-]+)\s*\)/i);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function pc4FromPostcode(postcode) {
  if (!postcode) return "";
  const m = String(postcode).match(/(\d{4})/);
  return m ? m[1] : "";
}

export async function geocodeAddress(address, { rows = 5, signal } = {}) {
  const q = String(address || "").trim();
  if (!q) {
    return { url: "", json: null, best: null, candidates: [] };
  }

  const url = `${PDOK_FREE_URL}?q=${encodeURIComponent(q)}&rows=${encodeURIComponent(rows)}`;
  const json = await fetchJson(url, { signal });

  const docs = json?.response?.docs ?? [];
  const candidates = docs
    .map((d) => {
      const p = parsePointWkt(d?.centroide_ll);
      const postcode = d?.postcode ?? "";
      const pc4 = pc4FromPostcode(postcode);
      return {
        label: d?.weergavenaam ?? d?.id ?? "",
        score: d?.score ?? null,
        lat: p?.lat ?? null,
        lng: p?.lng ?? null,
        postcode,
        pc4,
        raw: d,
      };
    })
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

  const best = candidates[0] ?? null;
  return { url, json, best, candidates };
}

