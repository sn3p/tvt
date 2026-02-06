const API_BASE = "https://vbn-tvt.northsea.cloud/v1/report";

import { fetchJson } from "./http.js";

function qs(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    q.set(k, String(v));
  });
  return q.toString();
}

export function listRemoteTopResultsUrl({ year, zipcode, type = 1 }) {
  // Keep `type=1` as default (matches what Vogelbescherming uses), even though
  // it appears to have no effect for the tested cases.
  return `${API_BASE}/list-remote-top-results?${qs({ year, zipcode, type })}`;
}

export function listLocalParticipantsUrl({ year, zipcode, type, isorg = false, limit = 9999 }) {
  // Default behavior: include `type=1` unless we're explicitly asking for org/school (`isorg=true`).
  // When `type` is `null`, the param is omitted.
  const resolvedType = type === undefined ? (isorg ? null : 1) : type;
  return `${API_BASE}/list-local-participants?${qs({
    year,
    zipcode,
    type: resolvedType,
    isorg: isorg ? "true" : null,
    limit,
  })}`;
}

export function entryTopBirdsUrl({ year, id, limit = 9999 }) {
  return `${API_BASE}/entry-top-birds?year=${encodeURIComponent(year)}&id=${encodeURIComponent(id)}&limit=${encodeURIComponent(
    limit
  )}`;
}

export async function listRemoteTopResults({ year, zipcode, type = 1, signal } = {}) {
  const url = listRemoteTopResultsUrl({ year, zipcode, type });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

export async function listLocalParticipants({ year, zipcode, type, isorg = false, limit = 9999, signal } = {}) {
  const url = listLocalParticipantsUrl({ year, zipcode, type, isorg, limit });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

export async function entryTopBirds({ year, id, limit = 9999, signal } = {}) {
  const url = entryTopBirdsUrl({ year, id, limit });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

