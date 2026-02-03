import { geocodeAddress } from "./api/pdok.js";
import { entryTopBirds, listLocalParticipants, listRemoteTopResults } from "./api/vbn.js";
import { normalizeEntryTopBirds, aggregateTotals, sortTopList } from "./lib/birds.js";
import { cacheKey, createCache } from "./lib/cache.js";
import { rankByDistance } from "./lib/geo.js";
import { AbortError, promisePool } from "./lib/promisePool.js";
import { $ } from "./ui/dom.js";
import {
  renderCandidates,
  renderParticipants,
  renderTopBirdsCombined,
  setStatus,
  showError,
} from "./ui/render.js";

const TTL_24H = 24 * 60 * 60 * 1000;
const TTL_7D = 7 * 24 * 60 * 60 * 1000;

const SETTINGS_KEY = "mvt:settings";
const MY_SETTINGS_KEY = "mvt:mySettings";

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

function createSettingsStore(key) {
  function load() {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  function save(partial) {
    const current = load();
    const next = { ...current, ...partial };
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return { load, save };
}

async function fetchParticipantsMerged(cache, { year, pc4, includeSchool, includeOrg, signal }) {
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

  const byId = new Map();
  for (const p of schoolPoints) byId.set(p.id, p);
  for (const p of orgPoints) if (!byId.has(p.id)) byId.set(p.id, p);
  const points = Array.from(byId.values());

  const urls = [];
  if (schoolR?.value?.url) urls.push({ label: "type=1", url: schoolR.value.url, fromCache: schoolR.fromCache });
  if (orgR?.value?.url) urls.push({ label: "isorg=true", url: orgR.value.url, fromCache: orgR.fromCache });

  return {
    points,
    urls,
    includeSchool,
    includeOrg,
    counts: { school: schoolPoints.length, org: orgPoints.length, merged: points.length },
  };
}

function applyRoute(route) {
  const a = route === "mijn" ? "mijn" : "vogeltelling";
  const b = a === "mijn" ? "vogeltelling" : "mijn";
  const aEl = document.getElementById(`route-${a}`);
  const bEl = document.getElementById(`route-${b}`);
  if (aEl) aEl.hidden = false;
  if (bEl) bEl.hidden = true;

  document.querySelectorAll(".tab[data-route]").forEach((el) => {
    const isCurrent = el.getAttribute("data-route") === a;
    if (isCurrent) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

export function initApp() {
  const cache = createCache();
  const settings = createSettingsStore(SETTINGS_KEY);
  const mySettings = createSettingsStore(MY_SETTINGS_KEY);

  // --- Router (hash-based) ---
  function currentRoute() {
    const h = String(window.location.hash || "");
    if (h.startsWith("#/mijn")) return "mijn";
    return "vogeltelling";
  }
  function syncRoute() {
    applyRoute(currentRoute());
  }
  window.addEventListener("hashchange", syncRoute);
  if (!window.location.hash) window.location.hash = "#/vogeltelling";
  syncRoute();

  // --- View 1: Vogeltelling (postcode) ---
  // Form elements
  const yearInput = $("yearInput");
  const pc4Input = $("pc4Input");
  const addressInput = $("addressInput");
  const includeSchoolInput = $("includeSchoolInput");
  const includeOrgInput = $("includeOrgInput");

  const btnLookup = $("btnLookup");
  const btnCompute = $("btnCompute");
  const btnStop = $("btnStop");
  const btnClearCache = $("btnClearCache");

  // Output elements
  const statusBar = $("statusBar");
  const errorBox = $("errorBox");

  const remoteTopMeta = $("remoteTopMeta");
  const remoteTopBox = $("remoteTopBox");

  const participantsMeta = $("participantsMeta");
  const participantsBox = $("participantsBox");

  // State
  const state = {
    remoteTop: null,
    participants: null,
    computed: null,
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
    renderTopBirdsCombined(remoteTopBox, remoteTopMeta, state.remoteTop, state.computed);
    renderParticipants(participantsBox, participantsMeta, state.participants);
  }

  async function runLookup({ signal } = {}) {
    resetOutputs();
    setStatus(statusBar, "Bezig met ophalen…");

    const year = readNumber(yearInput.value, new Date().getFullYear());
    const address = String(addressInput.value ?? "").trim();
    const includeSchool = Boolean(includeSchoolInput.checked);
    const includeOrg = Boolean(includeOrgInput.checked);

    settings.save({
      year,
      pc4: pc4Input.value,
      address,
      includeSchool,
      includeOrg,
    });

    // Optional: geocode address (only to derive PC4)
    if (address) {
      setStatus(statusBar, "Adres lookup (PDOK)…");
      const key = cacheKey(["pdok", "geocode", normalizeAddressKey(address)]);
      try {
        const r = await cached(cache, key, TTL_7D, () => geocodeAddress(address, { signal }));
        const best = r.value.best;
        if (best?.pc4 && !normalizePc4(pc4Input.value)) {
          pc4Input.value = best.pc4;
        }
      } catch (err) {
        showError(errorBox, `${err}\n\n${explainCorsHint()}`);
      }
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
      const merged = await fetchParticipantsMerged(cache, { year, pc4, includeSchool, includeOrg, signal });
      state.participants = {
        ...merged,
        year,
        pc4,
      };
    } catch (err) {
      state.participants = null;
      showError(errorBox, `${err}\n\n${explainCorsHint()}`);
    }

    // Reset derived outputs
    state.computed = null;

    renderAll();
    setStatus(statusBar, address ? "Klaar (PC4 afgeleid uit adres)." : "Klaar.");
  }

  async function runCompute({ signal } = {}) {
    resetOutputs();
    const year = readNumber(yearInput.value, new Date().getFullYear());
    const pc4 = normalizePc4(pc4Input.value);
    const includeSchool = Boolean(includeSchoolInput.checked);
    const includeOrg = Boolean(includeOrgInput.checked);

    if (!pc4) {
      showError(errorBox, "Vul eerst een PC4 in (of gebruik adres om PC4 af te leiden).");
      return;
    }

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

    const ids = state.participants.points.map((p) => p.id);
    const totals = new Map();
    const startedAt = Date.now();
    let cacheHits = 0;
    let okCount = 0;
    let failCount = 0;

    state.computed = { status: "running", totalEntries: ids.length, done: 0, okCount: 0, failCount: 0, cacheHits: 0 };
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
          setStatus(statusBar, eta ? `Berekent totals… ${eta}` : "Berekent totals…");
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
      topList: sortTopList(totals, 50),
      totalsByName: Object.fromEntries(totals.entries()),
      totalEntries: ids.length,
      okCount,
      failCount,
      cacheHits,
    };

    renderAll();
    setStatus(statusBar, failCount ? "Klaar (onvolledig)." : "Klaar.");
  }

  // Wire up UI events
  const s = settings.load();
  yearInput.value = String(s.year ?? new Date().getFullYear());
  if (s.pc4) pc4Input.value = s.pc4;
  if (s.address) addressInput.value = s.address;
  includeSchoolInput.checked = normalizeBool(s.includeSchool, true);
  includeOrgInput.checked = normalizeBool(s.includeOrg, true);

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

  btnStop.addEventListener("click", () => stopCurrent());

  btnClearCache.addEventListener("click", () => {
    const n = cache.clearAll();
    state.remoteTop = null;
    state.participants = null;
    state.computed = null;
    renderAll();
    setStatus(statusBar, `Cache geleegd (${n} items).`);
  });

  // Initial render
  renderAll();
  setStatus(statusBar, "Klaar. Vul een PC4 of adres in.");

  // --- View 2: Mijn Vogeltelling (adres) ---
  const myYearInput = $("myYearInput");
  const myAddressInput = $("myAddressInput");
  const myIncludeSchoolInput = $("myIncludeSchoolInput");
  const myIncludeOrgInput = $("myIncludeOrgInput");
  const myTopNInput = $("myTopNInput");
  const myRadiusInput = $("myRadiusInput");

  const myBtnFindMine = $("myBtnFindMine");
  const myBtnStop = $("myBtnStop");
  const myBtnClearCache = $("myBtnClearCache");

  const myStatusBar = $("myStatusBar");
  const myErrorBox = $("myErrorBox");
  const myCandidatesMeta = $("myCandidatesMeta");
  const myCandidatesBox = $("myCandidatesBox");

  const myState = { candidates: null, participants: null };
  let myAbort = null;

  function mySetAbort(controller) {
    myAbort = controller;
    myBtnStop.disabled = !controller;
  }
  function myStop() {
    if (myAbort) myAbort.abort();
  }
  function myReset() {
    showError(myErrorBox, null);
    setStatus(myStatusBar, "");
  }
  function myRenderAll() {
    // We reuse renderCandidates as "mijn tellingen" output.
    renderCandidates(myCandidatesBox, myCandidatesMeta, myState.candidates);
  }

  async function runMy({ signal } = {}) {
    myReset();
    setStatus(myStatusBar, "Bezig…");

    const year = readNumber(myYearInput.value, new Date().getFullYear());
    const address = String(myAddressInput.value ?? "").trim();
    const includeSchool = Boolean(myIncludeSchoolInput.checked);
    const includeOrg = Boolean(myIncludeOrgInput.checked);
    const topN = readNumber(myTopNInput.value, 10);
    const radius = readNumber(myRadiusInput.value, 300);

    mySettings.save({ year, address, includeSchool, includeOrg, topN: myTopNInput.value, radius: myRadiusInput.value });

    if (!address) {
      showError(myErrorBox, "Vul een adres in.");
      return;
    }

    setStatus(myStatusBar, "Adres lookup (PDOK)…");
    const key = cacheKey(["pdok", "geocode", normalizeAddressKey(address)]);
    const geo = await cached(cache, key, TTL_7D, () => geocodeAddress(address, { signal }));
    const best = geo.value.best;
    // Robust: derive PC4 from pc4/postcode/label
    const pc4 = normalizePc4(best?.pc4 ?? best?.postcode ?? best?.label ?? "");
    if (!pc4) {
      showError(myErrorBox, "Kon geen PC4 afleiden uit het adres.");
      return;
    }
    if (best?.lat == null || best?.lng == null) {
      showError(myErrorBox, "Kon geen lat/lng afleiden uit het adres.");
      return;
    }

    setStatus(myStatusBar, `Deelnemers ophalen (PC4=${pc4})…`);
    const merged = await fetchParticipantsMerged(cache, { year, pc4, includeSchool, includeOrg, signal });
    myState.participants = { ...merged, year, pc4 };

    const center = { lat: best.lat, lng: best.lng };
    const ranked = rankByDistance(merged.points, center, { topN, maxDistanceMeters: radius > 0 ? radius : Infinity });
    setStatus(myStatusBar, `Haalt entry details op voor ${ranked.length} kandidaten…`);

    const results = await promisePool(
      ranked,
      4,
      async (c) => {
        const k = cacheKey(["vbn", "entryTopBirds", year, c.id]);
        const r = await cached(cache, k, TTL_24H, () => entryTopBirds({ year, id: c.id, limit: 9999, signal }));
        const topBirds = normalizeEntryTopBirds(r.value.json);
        return { ...c, entryUrl: r.value.url, topBirds };
      },
      { signal }
    );

    const candidates = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    myState.candidates = { candidates, urls: merged.urls };
    myRenderAll();
    setStatus(myStatusBar, "Klaar.");
  }

  const ms = mySettings.load();
  myYearInput.value = String(ms.year ?? new Date().getFullYear());
  if (ms.address) myAddressInput.value = ms.address;
  myIncludeSchoolInput.checked = normalizeBool(ms.includeSchool, true);
  myIncludeOrgInput.checked = normalizeBool(ms.includeOrg, true);
  if (ms.topN) myTopNInput.value = String(ms.topN);
  if (ms.radius) myRadiusInput.value = String(ms.radius);

  $("myForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const controller = new AbortController();
    mySetAbort(controller);
    try {
      await runMy({ signal: controller.signal });
    } catch (err) {
      if (err instanceof AbortError) setStatus(myStatusBar, "Gestopt.");
      else showError(myErrorBox, err);
    } finally {
      mySetAbort(null);
    }
  });

  myBtnStop.addEventListener("click", () => myStop());
  myBtnClearCache.addEventListener("click", () => {
    const n = cache.clearAll();
    myState.candidates = null;
    myState.participants = null;
    myRenderAll();
    setStatus(myStatusBar, `Cache geleegd (${n} items).`);
  });

  myRenderAll();
  setStatus(myStatusBar, "Klaar. Vul een adres in.");
}

