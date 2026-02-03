const API_BASE = "https://vbn-tvt.northsea.cloud/v1/report";

import { fetchJson } from "./http.js";

export function listRemoteTopResultsUrl({ year, zipcode }) {
  return `${API_BASE}/list-remote-top-results?year=${encodeURIComponent(year)}&zipcode=${encodeURIComponent(zipcode)}`;
}

export function listLocalParticipantsUrl({ year, zipcode, type = 1, limit = 9999 }) {
  return `${API_BASE}/list-local-participants?year=${encodeURIComponent(year)}&zipcode=${encodeURIComponent(
    zipcode
  )}&type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`;
}

export function entryTopBirdsUrl({ year, id, limit = 9999 }) {
  return `${API_BASE}/entry-top-birds?year=${encodeURIComponent(year)}&id=${encodeURIComponent(id)}&limit=${encodeURIComponent(
    limit
  )}`;
}

export async function listRemoteTopResults({ year, zipcode, signal } = {}) {
  const url = listRemoteTopResultsUrl({ year, zipcode });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

export async function listLocalParticipants({ year, zipcode, type = 1, limit = 9999, signal } = {}) {
  const url = listLocalParticipantsUrl({ year, zipcode, type, limit });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

export async function entryTopBirds({ year, id, limit = 9999, signal } = {}) {
  const url = entryTopBirdsUrl({ year, id, limit });
  const json = await fetchJson(url, { signal });
  return { url, json };
}

