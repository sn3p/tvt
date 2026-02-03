import { geocodeAddress } from "./api/pdok.js";
import { entryTopBirds, listLocalParticipants, listRemoteTopResults } from "./api/vbn.js";
import { normalizeEntryTopBirds, aggregateTotals, sortTopList } from "./lib/birds.js";
import { cacheKey, createCache } from "./lib/cache.js";
import { rankByDistance } from "./lib/geo.js";
import { AbortError, promisePool } from "./lib/promisePool.js";
import { $ } from "./ui/dom.js";
import {
  renderCandidates,
  renderComputed,
  renderGeocode,
  renderParticipants,
  renderTopBirdsCombined,
  setComputedProgress,
  setStatus,
  showError,
} from "./ui/render.js";

const TTL_24H = 24 * 60 * 60 * 1000;
const TTL_7D = 7 * 24 * 60 * 60 * 1000;

const SETTINGS_KEY = "mvt:settings";

function normalizeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  }
  return fallback;
}

function normalizePc4(value) {
  const m = String(value ?? "").match(/(\d{4})/);
  return m ? m[1] : "";
}

function normalizeAddressKey(address) {
  return String(address ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function readNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveSettings(partial) {
  const current = loadSettings();
  const next = { ...current, ...partial };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

async function cached(cache, key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit.hit) return { value: hit.value, fromCache: hit.from, savedAt: hit.savedAt, expiresAt: hit.expiresAt };
  const value = await fn();
  const entry = cache.set(key, value, { ttlMs });
  return { value: entry.value, fromCache: null, savedAt: entry.savedAt, expiresAt: entry.expiresAt };
}

function explainCorsHint() {
  return [
    "Mogelijke CORS/network issue.",
    "- Draai dit via een webserver (niet file://).",
    "- Als PDOK of VBN CORS blokkeert: je hebt een simpele proxy nodig (bv. tiny node/deno server).",
  ].join("\n");
}

export function initApp() {
  const cache = createCache();

  // Form elements
  const yearInput = $("yearInput");
  const pc4Input = $("pc4Input");
  const addressInput = $("addressInput");
  const includeSchoolInput = $("includeSchoolInput");
  const includeOrgInput = $("includeOrgInput");
  const topNInput = $("topNInput");
  const radiusInput = $("radiusInput");

  const btnLookup = $("btnLookup");
  const btnCompute = $("btnCompute");
  const btnFindMine = $("btnFindMine");
  const btnStop = $("btnStop");
  const btnClearCache = $("btnClearCache");

  // Output elements
  const statusBar = $("statusBar");
  const errorBox = $("errorBox");

  const geocodeMeta = $("geocodeMeta");
  const geocodeBox = $("geocodeBox");

  const remoteTopMeta = $("remoteTopMeta");
  const remoteTopBox = $("remoteTopBox");

  const participantsMeta = $("participantsMeta");
  const participantsBox = $("participantsBox");

  const computedMeta = $("computedMeta");
  const computedProgress = $("computedProgress");
  const computedBox = $("computedBox");

  const candidatesMeta = $("candidatesMeta");
  const candidatesBox = $("candidatesBox");

  // State
  const state = {
    geocode: null,
    remoteTop: null,
    participants: null,
    computed: null,
    candidates: null,
  };

  let currentAbort = null;

  function setAbort(controller) {
    currentAbort = controller;
    btnStop.disabled = !controller;
  }

  function stopCurrent() {
    if (currentAbort) currentAbort.abort();
  }

  function resetOutputs() {
    showError(errorBox, null);
    setStatus(statusBar, "");
  }

  function renderAll() {
    renderGeocode(geocodeBox, geocodeMeta, state.geocode);
    renderTopBirdsCombined(remoteTopBox, remoteTopMeta, state.remoteTop, state.computed);
    renderParticipants(participantsBox, participantsMeta, state.participants);
    renderComputed(computedBox, computedMeta, computedProgress, state.computed);
    renderCandidates(candidatesBox, candidatesMeta, state.candidates);
  }

  async function runLookup({ signal } = {}) {
    resetOutputs();
    setStatus(statusBar, "Bezig met ophalen…");

    const year = readNumber(yearInput.value, new Date().getFullYear());
    const address = String(addressInput.value ?? "").trim();
    const includeSchool = Boolean(includeSchoolInput.checked);
    const includeOrg = Boolean(includeOrgInput.checked);

    saveSettings({
      year,
      pc4: pc4Input.value,
      address,
      includeSchool,
      includeOrg,
      topN: topNInput.value,
      radius: radiusInput.value,
    });

    // Optional: geocode address
    let center = null;
    if (address) {
      setStatus(statusBar, "Adres lookup (PDOK)…");
      const key = cacheKey(["pdok", "geocode", normalizeAddressKey(address)]);
      try {
        const r = await cached(cache, key, TTL_7D, () => geocodeAddress(address, { signal }));
        const best = r.value.best;
        state.geocode = { ...r.value, fromCache: r.fromCache };
        if (best?.pc4 && !normalizePc4(pc4Input.value)) {
          pc4Input.value = best.pc4;
        }
        if (best?.lat != null && best?.lng != null) {
          center = { lat: best.lat, lng: best.lng };
        }
      } catch (err) {
        state.geocode = null;
        showError(errorBox, `${err}\n\n${explainCorsHint()}`);
      }
    } else {
      state.geocode = null;
    }

    const pc4 = normalizePc4(pc4Input.value);
    if (!pc4) {
      setStatus(statusBar, "Vul een PC4 in (4 cijfers) of zoek eerst een adres.");
      renderAll();
      return;
    }

    // Remote top results
    try {
      setStatus(statusBar, "Top soorten (snel)…");
      const key = cacheKey(["vbn", "remoteTop", year, pc4]);
      const r = await cached(cache, key, TTL_24H, () => listRemoteTopResults({ year, zipcode: pc4, signal }));
      const list = Array.isArray(r.value.json?.data) ? r.value.json.data : [];
      state.remoteTop = { url: r.value.url, list, fromCache: r.fromCache };
    } catch (err) {
      state.remoteTop = null;
      showError(errorBox, `${err}\n\n${explainCorsHint()}`);
    }

    // Local participants
    try {
      setStatus(statusBar, "Deelnemers (lokaal)…");
      const toPoints = (json) => {
        const ptsRaw = Array.isArray(json?.data) ? json.data : [];
        return ptsRaw
          .map((p) => ({ id: p.id, lat: Number(p.lat), lng: Number(p.lng) }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.id != null);
      };

      const [schoolR, orgR] = await Promise.all([
        includeSchool
          ? cached(cache, cacheKey(["vbn", "participants", "school", year, pc4]), TTL_24H, () =>
              listLocalParticipants({ year, zipcode: pc4, type: 1, isorg: false, limit: 9999, signal })
            )
          : Promise.resolve(null),
        includeOrg
          ? cached(cache, cacheKey(["vbn", "participants", "org", year, pc4]), TTL_24H, () =>
              // For org/school we omit `type` (pass `null`) to mirror Vogelbescherming usage.
              listLocalParticipants({ year, zipcode: pc4, type: null, isorg: true, limit: 9999, signal })
            )
          : Promise.resolve(null),
      ]);

      const schoolPoints = schoolR ? toPoints(schoolR.value.json) : [];
      const orgPoints = orgR ? toPoints(orgR.value.json) : [];

      // Merge and dedupe by id.
      const byId = new Map();
      for (const p of schoolPoints) byId.set(p.id, p);
      for (const p of orgPoints) if (!byId.has(p.id)) byId.set(p.id, p);
      const points = Array.from(byId.values());

      const urls = [];
      if (schoolR?.value?.url) urls.push({ label: "type=1", url: schoolR.value.url, fromCache: schoolR.fromCache });
      if (orgR?.value?.url) urls.push({ label: "isorg=true", url: orgR.value.url, fromCache: orgR.fromCache });

      state.participants = {
        points,
        urls,
        year,
        pc4,
        includeSchool,
        includeOrg,
        counts: { school: schoolPoints.length, org: orgPoints.length, merged: points.length },
      };
    } catch (err) {
      state.participants = null;
      showError(errorBox, `${err}\n\n${explainCorsHint()}`);
    }

    // Reset derived outputs
    state.computed = null;
    setComputedProgress(computedProgress, "Nog niet gestart.");
    state.candidates = null;

    renderAll();
    setStatus(statusBar, center ? "Klaar (met adres)." : "Klaar.");
  }

  async function runCompute({ signal } = {}) {
    resetOutputs();
    const year = readNumber(yearInput.value, new Date().getFullYear());
    const pc4 = normalizePc4(pc4Input.value);
    const includeSchool = Boolean(includeSchoolInput.checked);
    const includeOrg = Boolean(includeOrgInput.checked);

    if (!pc4) {
      showError(errorBox, "Vul eerst een PC4 in.");
      return;
    }

    if (
      !state.participants ||
      state.participants.year !== year ||
      state.participants.pc4 !== pc4 ||
      state.participants.includeSchool !== includeSchool ||
      state.participants.includeOrg !== includeOrg
    ) {
      // Ensure we have participants loaded for the current params
      await runLookup({ signal });
      if (!state.participants) return;
    }

    const ids = state.participants.points.map((p) => p.id);
    const totals = new Map();
    const startedAt = Date.now();
    let cacheHits = 0;
    let okCount = 0;
    let failCount = 0;

    state.computed = { status: "running", totalEntries: ids.length, done: 0, okCount: 0, failCount: 0, cacheHits: 0 };
    setComputedProgress(computedProgress, "Start…");
    setStatus(statusBar, "Berekent totals uit alle entries…");
    renderAll();

    const results = await promisePool(
      ids,
      5,
      async (id) => {
        const key = cacheKey(["vbn", "entryTopBirds", year, id]);
        const r = await cached(cache, key, TTL_24H, () => entryTopBirds({ year, id, limit: 9999, signal }));
        if (r.fromCache) cacheHits += 1;
        const birds = normalizeEntryTopBirds(r.value.json);
        return { id, birds };
      },
      {
        signal,
        onProgress: ({ done, total }) => {
          const elapsed = (Date.now() - startedAt) / 1000;
          const rate = done > 0 ? done / Math.max(1, elapsed) : 0;
          const remaining = rate > 0 ? (total - done) / rate : null;
          const eta = remaining != null ? `ETA ~${remaining.toFixed(0)}s` : "";
          setComputedProgress(computedProgress, eta ? `Bezig… ${eta}` : "Bezig…");
          if (state.computed && state.computed.status === "running") {
            state.computed.done = done;
            state.computed.totalEntries = total;
            state.computed.cacheHits = cacheHits;
          }
          renderAll();
        },
      }
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        okCount += 1;
        aggregateTotals(totals, r.value.birds);
      } else {
        failCount += 1;
      }
    }

    state.computed = {
      status: "done",
      // keep enough rows so remote-top-10 species are very likely present for comparisons
      topList: sortTopList(totals, 50),
      totalsByName: Object.fromEntries(totals.entries()),
      totalEntries: ids.length,
      okCount,
      failCount,
      cacheHits,
    };

    setComputedProgress(computedProgress, "");
    renderAll();
    setStatus(statusBar, failCount ? "Klaar (onvolledig)." : "Klaar.");
  }

  async function runFindMine({ signal } = {}) {
    resetOutputs();

    const year = readNumber(yearInput.value, new Date().getFullYear());
    const pc4 = normalizePc4(pc4Input.value);
    const includeSchool = Boolean(includeSchoolInput.checked);
    const includeOrg = Boolean(includeOrgInput.checked);
    const topN = readNumber(topNInput.value, 10);
    const radius = readNumber(radiusInput.value, 300);

    if (!pc4) {
      showError(errorBox, "Vul eerst een PC4 in of zoek een adres.");
      return;
    }

    const address = String(addressInput.value ?? "").trim();
    if (!address) {
      showError(errorBox, "Vul een adres in (nodig voor distance ranking).");
      return;
    }

    // Ensure geocode exists for current address
    if (!state.geocode || !state.geocode.best || state.geocode.best.lat == null || state.geocode.best.lng == null) {
      await runLookup({ signal });
      if (!state.geocode?.best) return;
    }

    // Ensure participants loaded
    if (
      !state.participants ||
      state.participants.year !== year ||
      state.participants.pc4 !== pc4 ||
      state.participants.includeSchool !== includeSchool ||
      state.participants.includeOrg !== includeOrg
    ) {
      await runLookup({ signal });
      if (!state.participants) return;
    }

    const center = { lat: state.geocode.best.lat, lng: state.geocode.best.lng };
    const ranked = rankByDistance(state.participants.points, center, {
      topN,
      maxDistanceMeters: radius > 0 ? radius : Infinity,
    });

    setStatus(statusBar, `Haalt entry details op voor ${ranked.length} kandidaten…`);

    const results = await promisePool(
      ranked,
      4,
      async (c) => {
        const key = cacheKey(["vbn", "entryTopBirds", year, c.id]);
        const r = await cached(cache, key, TTL_24H, () => entryTopBirds({ year, id: c.id, limit: 9999, signal }));
        const topBirds = normalizeEntryTopBirds(r.value.json);
        return { ...c, entryUrl: r.value.url, topBirds };
      },
      { signal }
    );

    const candidates = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    state.candidates = { candidates, urls: state.participants.urls };
    renderAll();
    setStatus(statusBar, "Klaar met kandidaten.");
  }

  // Wire up UI events
  const settings = loadSettings();
  yearInput.value = String(settings.year ?? new Date().getFullYear());
  if (settings.pc4) pc4Input.value = settings.pc4;
  if (settings.address) addressInput.value = settings.address;
  includeSchoolInput.checked = normalizeBool(settings.includeSchool, true);
  includeOrgInput.checked = normalizeBool(settings.includeOrg, true);
  if (settings.topN) topNInput.value = String(settings.topN);
  if (settings.radius) radiusInput.value = String(settings.radius);

  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const controller = new AbortController();
    setAbort(controller);
    try {
      await runLookup({ signal: controller.signal });
    } catch (err) {
      if (err instanceof AbortError) setStatus(statusBar, "Gestopt.");
      else showError(errorBox, err);
    } finally {
      setAbort(null);
    }
  });

  btnCompute.addEventListener("click", async () => {
    const controller = new AbortController();
    setAbort(controller);
    try {
      await runCompute({ signal: controller.signal });
    } catch (err) {
      if (err instanceof AbortError) setStatus(statusBar, "Gestopt.");
      else showError(errorBox, err);
    } finally {
      setAbort(null);
    }
  });

  btnFindMine.addEventListener("click", async () => {
    const controller = new AbortController();
    setAbort(controller);
    try {
      await runFindMine({ signal: controller.signal });
    } catch (err) {
      if (err instanceof AbortError) setStatus(statusBar, "Gestopt.");
      else showError(errorBox, err);
    } finally {
      setAbort(null);
    }
  });

  btnStop.addEventListener("click", () => stopCurrent());

  btnClearCache.addEventListener("click", () => {
    const n = cache.clearAll();
    state.geocode = null;
    state.remoteTop = null;
    state.participants = null;
    state.computed = null;
    state.candidates = null;
    setComputedProgress(computedProgress, "Nog niet gestart.");
    renderAll();
    setStatus(statusBar, `Cache geleegd (${n} items).`);
  });

  // Initial render
  renderAll();
  setStatus(statusBar, "Klaar. Vul een PC4 of adres in.");
}

