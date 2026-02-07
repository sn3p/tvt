import { loadBirdguide, loadMunicipalityDataset } from "./data.js";

export function initApp() {
  const mapEl = document.querySelector("#map");
  const statsEl = document.querySelector("#statsBar");
  const modePointsBtn = document.querySelector("#modePointsBtn");
  const modeSpeciesBtn = document.querySelector("#modeSpeciesBtn");
  const yearInput = document.querySelector("#yearInput");
  const pc4Input = document.querySelector("#pc4Input");
  const includeType1Input = document.querySelector("#includeType1Input");
  const includeIsorgInput = document.querySelector("#includeIsorgInput");
  const filtersForm = document.querySelector("#filtersForm");
  const sidebarEl = document.querySelector("#sidebar");
  const speciesStatusEl = document.querySelector("#speciesStatus");
  const speciesSearchInput = document.querySelector("#speciesSearchInput");
  const speciesListEl = document.querySelector("#speciesList");
  const speciesScopeViewport = document.querySelector("#speciesScopeViewport");
  const speciesScopeAll = document.querySelector("#speciesScopeAll");
  const speciesSortMost = document.querySelector("#speciesSortMost");
  const speciesSortAZ = document.querySelector("#speciesSortAZ");
  const metricPresence = document.querySelector("#metricPresence");
  const metricAvg = document.querySelector("#metricAvg");
  const metricSum = document.querySelector("#metricSum");

  if (
    !mapEl ||
    !statsEl ||
    !yearInput ||
    !pc4Input ||
    !includeType1Input ||
    !includeIsorgInput ||
    !filtersForm ||
    !sidebarEl ||
    !speciesStatusEl ||
    !speciesSearchInput ||
    !speciesListEl ||
    !modePointsBtn ||
    !modeSpeciesBtn ||
    !speciesScopeViewport ||
    !speciesScopeAll ||
    !speciesSortMost ||
    !speciesSortAZ ||
    !metricPresence ||
    !metricAvg ||
    !metricSum
  ) {
    return;
  }

  if (!("L" in globalThis)) {
    statsEl.textContent = "Leaflet niet geladen (check netwerk / CDN).";
    return;
  }

  // Prevent accidental form submit refresh on Enter.
  filtersForm.addEventListener("submit", (e) => e.preventDefault());

  statsEl.textContent = "Dataset laden…";

  const map = globalThis.L.map(mapEl, {
    zoomControl: false,
    preferCanvas: true,
  });

  globalThis.L.control.zoom({ position: 'topright' }).addTo(map);

  // const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileUrl = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";

  globalThis.L.tileLayer(tileUrl, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const pointsLayer = globalThis.L.layerGroup().addTo(map);
  const gridLayer = globalThis.L.layerGroup();

  let dataset = null;
  let datasetYear = 0;
  let didFitOnce = false;
  let lastPc4 = "";
  let rendered = [];
  let totals = { entries: 0, birds: 0 };
  let loadSeq = 0;
  let mode = "points"; // "points" | "species"
  let preparedEntries = [];
  let speciesIndex = [];
  let selectedSpecies = null; // { id?: number|null, name: string }
  let computeTimer = 0;
  let speciesScope = "viewport"; // "viewport" | "all"
  let speciesSort = "most"; // "most" | "az"
  let metric = "presence"; // "presence" | "avg" | "sum"

  let legendType1TextEl = null;
  let legendIsorgTextEl = null;

  function normalizePc4(v) {
    const m = String(v ?? "").match(/(\d{4})/);
    return m ? m[1] : "";
  }

  function sumBirds(birds) {
    if (!Array.isArray(birds)) return 0;
    let s = 0;
    for (const b of birds) s += Number(b?.count ?? 0) || 0;
    return s;
  }

  function normalizeSpeciesName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]+/g, "")
      .trim();
  }

  function entryHasMode(entry, mode) {
    return Array.isArray(entry?.modes) && entry.modes.includes(mode);
  }

  function prepareDataset(json) {
    const entries = Array.isArray(json?.entries) ? json.entries : [];

    // Build a species index from the compiled dataset (preferred over birdguide).
    const byId = new Map();
    for (const e of entries) {
      const birds = Array.isArray(e?.birds) ? e.birds : [];
      for (const b of birds) {
        const id = Number(b?.bird_id ?? NaN);
        const name = String(b?.name ?? "").trim();
        if (!Number.isFinite(id) || !name) continue;
        if (!byId.has(id)) byId.set(id, name);
      }
    }
    speciesIndex = Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));

    preparedEntries = entries
      .map((e) => {
        const lat = Number(e?.lat);
        const lng = Number(e?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const isOrg = entryHasMode(e, "isorg");
        const rawIsType1 = entryHasMode(e, "type1");
        // IMPORTANT: `type1` can contain `isorg` entries too (see `entryIncludedByModes`).
        const isPrivate = rawIsType1 && !isOrg;

        const birds = Array.isArray(e?.birds) ? e.birds : [];
        const birdsTotal = sumBirds(birds);

        const birdIds = new Set();
        const birdNames = new Set();
        for (const b of birds) {
          const id = Number(b?.bird_id ?? NaN);
          if (Number.isFinite(id)) birdIds.add(id);
          const n = normalizeSpeciesName(b?.name);
          if (n) birdNames.add(n);
        }

        return {
          entry: e,
          latlng: globalThis.L.latLng(lat, lng),
          pc4: String(e?.pc4 ?? ""),
          isPrivate,
          isOrg,
          birdsTotal,
          birdIds,
          birdNames,
        };
      })
      .filter(Boolean);
  }

  function colorForEntry(entry) {
    const isIsorg = entryHasMode(entry, "isorg");
    if (isIsorg) return "#60a5fa"; // blue
    return "#fb923c"; // orange (type1)
  }

  function labelForEntry(entry) {
    const isIsorg = entryHasMode(entry, "isorg");
    if (isIsorg) return "Schoolinzending";
    return "Inzending";
  }

  function updateViewportStats() {
    if (!dataset) return;

    const b = map.getBounds();
    let inViewEntries = 0;
    let inViewBirds = 0;
    let inViewType1 = 0;
    let inViewIsorg = 0;

    for (const r of rendered) {
      if (!b.contains(r.latlng)) continue;
      inViewEntries += 1;
      inViewBirds += r.birdsTotal;
      if (r.isType1) inViewType1 += 1;
      if (r.isIsorg) inViewIsorg += 1;
    }

    statsEl.textContent = `${inViewEntries} inzendingen in beeld (totaal ${totals.entries}) • ${inViewBirds} vogels geteld (totaal ${totals.birds})`;

    if (legendType1TextEl) legendType1TextEl.textContent = `Inzending (${inViewType1})`;
    if (legendIsorgTextEl) legendIsorgTextEl.textContent = `Schoolinzending (${inViewIsorg})`;
  }

  // Legend (copied from old app style)
  const legend = globalThis.L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = globalThis.L.DomUtil.create("div", "pill");
    div.style.display = "grid";
    div.style.gap = "6px";
    div.style.padding = "10px 10px";
    div.style.background = "rgba(0, 0, 0, 0.45)";
    div.style.backdropFilter = "blur(8px)";
    div.style.borderRadius = "12px";
    div.style.color = "rgba(255, 255, 255, 0.9)";
    div.style.maxWidth = "220px";

    const row = ({ label, color, getTextEl }) => {
      const r = document.createElement("div");
      r.style.display = "flex";
      r.style.alignItems = "center";
      r.style.gap = "8px";
      const dot = document.createElement("span");
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.borderRadius = "999px";
      dot.style.border = "2px solid #fff";
      dot.style.background = color;
      const t = document.createElement("span");
      t.textContent = label;
      r.appendChild(dot);
      r.appendChild(t);
      if (typeof getTextEl === "function") getTextEl(t);
      return r;
    };

    div.appendChild(
      row({
        label: "Inzending (0)",
        color: "#fb923c",
        getTextEl: (el) => {
          legendType1TextEl = el;
        },
      })
    );
    div.appendChild(
      row({
        label: "Schoolinzending (0)",
        color: "#60a5fa",
        getTextEl: (el) => {
          legendIsorgTextEl = el;
        },
      })
    );

    // Don't let the legend eat map scroll/drag.
    globalThis.L.DomEvent.disableClickPropagation(div);
    globalThis.L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  legend.addTo(map);

  function setMode(nextMode) {
    mode = nextMode === "species" ? "species" : "points";
    syncModeToUrl(mode);

    modePointsBtn.setAttribute("aria-pressed", mode === "points" ? "true" : "false");
    modeSpeciesBtn.setAttribute("aria-pressed", mode === "species" ? "true" : "false");

    // Allow mode-based styling without touching JS again.
    document.body.dataset.mode = mode;

    sidebarEl.hidden = mode !== "species";

    if (mode === "species") {
      if (map.hasLayer(pointsLayer)) map.removeLayer(pointsLayer);
      if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
    } else {
      if (map.hasLayer(gridLayer)) map.removeLayer(gridLayer);
      gridLayer.clearLayers();
      if (!map.hasLayer(pointsLayer)) pointsLayer.addTo(map);
    }

    // Layout changes (sidebar show/hide) require a size invalidation.
    try {
      map.invalidateSize({ animate: false });
    } catch {
      // ignore
    }
    setTimeout(() => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // ignore
      }
    }, 0);

    // Re-render for the new mode.
    render();
  }

  modePointsBtn.addEventListener("click", () => setMode("points"));
  modeSpeciesBtn.addEventListener("click", () => setMode("species"));

  function modeFromUrl() {
    try {
      const url = new URL(window.location.href);
      const m = (url.searchParams.get("mode") || "").trim().toLowerCase();
      if (m === "species" || m === "soorten") return "species";
      if (m === "points" || m === "tellingen") return "points";
      return "points";
    } catch {
      return "points";
    }
  }

  function syncModeToUrl(next) {
    // Keep mode in URL (shareable, back/forward friendly), not in localStorage.
    const modeValue = next === "species" ? "species" : "points";
    const url = new URL(window.location.href);
    if (modeValue === "points") url.searchParams.delete("mode");
    else url.searchParams.set("mode", modeValue);
    window.history.replaceState(null, "", url);
  }

  // Initial mode: URL is source of truth.
  setMode(modeFromUrl());

  // React to back/forward navigation if mode changes in URL.
  window.addEventListener("popstate", () => {
    const m = modeFromUrl();
    if (m !== mode) setMode(m);
  });

  function clearSpeciesStatus() {
    speciesStatusEl.textContent = "";
  }

  function setSpeciesStatus(msg) {
    speciesStatusEl.textContent = msg || "";
  }

  function filteredPreparedEntries() {
    const { pc4, includeType1, includeIsorg } = getFilters();
    return preparedEntries.filter((p) => {
      if (pc4 && p.pc4 !== pc4) return false;
      return (includeType1 && p.isPrivate) || (includeIsorg && p.isOrg);
    });
  }

  function renderSpeciesList({ query = "" } = {}) {
    const q = normalizeSpeciesName(query);
    const baseAll = filteredPreparedEntries();
    const bounds = (() => {
      try {
        return map.getBounds();
      } catch {
        return null;
      }
    })();
    const base =
      speciesScope === "all" || !bounds
        ? baseAll
        : baseAll.filter((p) => bounds.contains(p.latlng));

    // Compute "most observed" stats within current scope (and current filters).
    const statsByKey = new Map(); // key -> { with, sum }
    for (const e of base) {
      const birds = Array.isArray(e.entry?.birds) ? e.entry.birds : [];
      for (const b of birds) {
        const id = Number(b?.bird_id ?? NaN);
        const name = String(b?.name ?? "").trim();
        const key = Number.isFinite(id) ? `id:${id}` : `name:${normalizeSpeciesName(name)}`;
        if (!key) continue;
        const count = Number(b?.count ?? 0) || 0;
        if (!statsByKey.has(key)) statsByKey.set(key, { with: 0, sum: 0 });
        const st = statsByKey.get(key);
        if (count > 0) st.with += 1;
        st.sum += count;
      }
    }

    const inScope = speciesIndex.filter((s) => {
      const key = s.id != null ? `id:${s.id}` : `name:${normalizeSpeciesName(s.name)}`;
      return statsByKey.has(key);
    });

    // Expectation: list contains *observed* species under current filters (and scope).
    const listUnfiltered = inScope;

    const listFiltered = q
      ? listUnfiltered.filter((s) => normalizeSpeciesName(s.name).includes(q))
      : listUnfiltered;

    const list =
      speciesSort === "az"
        ? listFiltered.slice().sort((a, b) => a.name.localeCompare(b.name, "nl"))
        : listFiltered
            .slice()
            .sort((a, b) => {
              const ka = a.id != null ? `id:${a.id}` : `name:${normalizeSpeciesName(a.name)}`;
              const kb = b.id != null ? `id:${b.id}` : `name:${normalizeSpeciesName(b.name)}`;
              const sa = statsByKey.get(ka) || { with: 0, sum: 0 };
              const sb = statsByKey.get(kb) || { with: 0, sum: 0 };
              // Most observed = N_with desc, then sum desc, then name.
              if (sb.with !== sa.with) return sb.with - sa.with;
              if (sb.sum !== sa.sum) return sb.sum - sa.sum;
              return a.name.localeCompare(b.name, "nl");
            });

    speciesListEl.innerHTML = "";

    for (const s of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "species-item";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", selectedSpecies?.id === s.id && selectedSpecies?.name === s.name ? "true" : "false");
      btn.dataset.name = s.name;
      if (s.id != null) btn.dataset.id = String(s.id);

      const title = document.createElement("span");
      title.textContent = s.name;
      btn.appendChild(title);

      const meta = document.createElement("small");
      const key = s.id != null ? `id:${s.id}` : `name:${normalizeSpeciesName(s.name)}`;
      const st = statsByKey.get(key);
      meta.textContent =
        st && speciesSort === "most"
          ? `${st.with}×`
          : (s.id != null ? `id ${s.id}` : "");
      btn.appendChild(meta);

      btn.addEventListener("click", () => {
        selectedSpecies = s;
        renderSpeciesList({ query: speciesSearchInput.value });
        schedulePresenceGridCompute();
      });

      speciesListEl.appendChild(btn);
    }
  }

  speciesSearchInput.addEventListener("input", () => {
    renderSpeciesList({ query: speciesSearchInput.value });
  });

  function readControls() {
    speciesScope = speciesScopeAll.checked ? "all" : "viewport";
    speciesSort = speciesSortAZ.checked ? "az" : "most";
    metric = metricAvg.checked ? "avg" : (metricSum.checked ? "sum" : "presence");
  }

  function onSpeciesControlsChanged() {
    readControls();
    renderSpeciesList({ query: speciesSearchInput.value });
    schedulePresenceGridCompute();
  }

  speciesScopeViewport.addEventListener("change", onSpeciesControlsChanged);
  speciesScopeAll.addEventListener("change", onSpeciesControlsChanged);
  speciesSortMost.addEventListener("change", onSpeciesControlsChanged);
  speciesSortAZ.addEventListener("change", onSpeciesControlsChanged);
  metricPresence.addEventListener("change", onSpeciesControlsChanged);
  metricAvg.addEventListener("change", onSpeciesControlsChanged);
  metricSum.addEventListener("change", onSpeciesControlsChanged);

  function schedulePresenceGridCompute() {
    if (computeTimer) window.clearTimeout(computeTimer);
    if (mode !== "species") return;
    computeTimer = window.setTimeout(() => {
      computeTimer = 0;
      computePresenceGrid();
    }, 120);
  }

  function computePresenceGrid() {
    if (mode !== "species") return;

    gridLayer.clearLayers();

    if (!selectedSpecies) {
      setSpeciesStatus("Kies een soort…");
      return;
    }

    const entries = rendered;
    if (!entries || entries.length === 0) {
      setSpeciesStatus("Geen entries (na filters).");
      return;
    }

    setSpeciesStatus("Computing…");

    const selId = selectedSpecies.id != null ? Number(selectedSpecies.id) : null;
    const selName = selId == null ? normalizeSpeciesName(selectedSpecies.name) : "";

    const cellPx = 90;
    const size = map.getSize();
    const cols = Math.max(1, Math.ceil(size.x / cellPx));
    const rows = Math.max(1, Math.ceil(size.y / cellPx));
    const cellCount = cols * rows;

    const nTotal = new Array(cellCount).fill(0);
    const nWith = new Array(cellCount).fill(0);
    const sumCount = new Array(cellCount).fill(0);

    // Assign entries to grid cells in viewport (O(entries)).
    for (const e of entries) {
      const pt = map.latLngToContainerPoint(e.latlng);
      if (pt.x < 0 || pt.y < 0 || pt.x >= size.x || pt.y >= size.y) continue;
      const c = Math.floor(pt.x / cellPx);
      const r = Math.floor(pt.y / cellPx);
      const idx = r * cols + c;
      nTotal[idx] += 1;

      const has =
        selId != null
          ? Boolean(e.birdIds && e.birdIds.has(selId))
          : Boolean(e.birdNames && e.birdNames.has(selName));
      if (has) nWith[idx] += 1;

      // For avg/sum we also need the per-entry count for this species.
      if (has) {
        let cnt = 0;
        const birds = Array.isArray(e.entry?.birds) ? e.entry.birds : [];
        for (const b of birds) {
          const id = Number(b?.bird_id ?? NaN);
          const nm = normalizeSpeciesName(b?.name);
          if (selId != null ? Number.isFinite(id) && id === selId : nm === selName) {
            cnt = Number(b?.count ?? 0) || 0;
            break;
          }
        }
        sumCount[idx] += cnt;
      }
    }

    // Normalize metric for visualization (per recompute, per viewport).
    let maxMetric = 0;
    const metricVal = new Array(cellCount).fill(0);
    for (let i = 0; i < cellCount; i++) {
      const total = nTotal[i];
      if (!total) continue;
      const withN = nWith[i];
      const sum = sumCount[i];
      const v =
        metric === "sum" ? sum :
        metric === "avg" ? sum / total :
        (withN / total); // presence
      metricVal[i] = v;
      if (v > maxMetric) maxMetric = v;
    }

    // Render all cells (border always; fill depends on N + presence).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const total = nTotal[idx];
        const withN = nWith[idx];
        const sum = sumCount[idx];
        const v = metricVal[idx];

        const x0 = c * cellPx;
        const y0 = r * cellPx;
        const x1 = Math.min((c + 1) * cellPx, size.x);
        const y1 = Math.min((r + 1) * cellPx, size.y);

        const nw = map.containerPointToLatLng([x0, y0]);
        const se = map.containerPointToLatLng([x1, y1]);
        const bb = globalThis.L.latLngBounds(nw, se);

        // Sample size indicator: ramp opacity with N.
        const nScale = total ? Math.min(1, Math.sqrt(total) / 3) : 0;
        const vNorm = maxMetric ? Math.min(1, v / maxMetric) : 0;
        const fillOpacity = total ? 0.85 * vNorm * nScale : 0;

        const rect = globalThis.L.rectangle(bb, {
          color: "rgba(255,255,255,0.18)",
          weight: 1,
          fillColor: "rgba(125,211,252,1)",
          fillOpacity,
        });

        const metricLabel =
          metric === "sum"
            ? `sum=${sum.toFixed(0)}`
            : metric === "avg"
              ? `avg=${(total ? (sum / total) : 0).toFixed(2)}`
              : `presence=${(total ? (withN / total) * 100 : 0).toFixed(1)}%`;

        rect.bindTooltip(
          `${selectedSpecies.name}\nN_total=${total} • N_with=${withN}\n${metricLabel}`,
          { sticky: false }
        );

        rect.addTo(gridLayer);
      }
    }

    setSpeciesStatus(`${selectedSpecies.name} • ${metric}`);
  }

  function popupHtml(entry) {
    const birds = Array.isArray(entry?.birds) ? entry.birds : [];
    const total = sumBirds(birds);
    const imgBase = birdImageBase();
    const imgFallback = birdFallbackFilename();
    const rows = birds
      .slice()
      .sort((a, b) => (Number(b?.count ?? 0) || 0) - (Number(a?.count ?? 0) || 0))
      .map((b) => {
        const name = String(b?.name ?? "Onbekend");
        const count = Number(b?.count ?? 0) || 0;
        const filename = guessImageFilename(name);
        const src = `${imgBase}${String(filename || "")}`;
        const fallbackSrc = `${imgBase}${String(imgFallback || "")}`;
        const alt = escapeHtml(name);

        return `
          <li class="row">
            <span class="img">
              <img
                src="${src}"
                alt="${alt}"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
                onerror="this.onerror=null;this.src='${fallbackSrc}'"
              />
            </span>
            <span class="name">${alt}</span>
            <span class="count">${count}</span>
          </li>
        `.trim();
      })
      .join("");

    return `
      <div class="tvt-popup">
        <h3>Inzending ${entry.id}</h3>
        <p class="meta">PC4 ${entry.pc4} • ${labelForEntry(entry)} • totaal ${total}</p>
        <ol class="list">${rows || '<li class="row"><span class="name">Geen soorten</span><span class="count">0</span></li>'}</ol>
      </div>
    `;
  }

  function birdImageBase() {
    // Observed in Vogelbescherming DOM & data json:
    // https://cdn-cf.newstory.nl/vbn/tvt/media/img/resultaten/<filename>.png
    return "https://cdn-cf.newstory.nl/vbn/tvt/media/img/resultaten/";
  }

  function birdFallbackFilename() {
    return "niet-herkend.png";
  }

  function guessImageFilename(name) {
    // best-effort: lowercase, strip diacritics, spaces -> underscore
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .concat(".png");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getFilters() {
    const year = Number(yearInput.value || 0) || 0;
    const pc4 = normalizePc4(pc4Input.value);
    const includeType1 = Boolean(includeType1Input.checked);
    const includeIsorg = Boolean(includeIsorgInput.checked);
    return { year, pc4, includeType1, includeIsorg };
  }

  function entryIncludedByModes(entry, { includeType1, includeIsorg }) {
    const isType1 = entryHasMode(entry, "type1");
    const isIsorg = entryHasMode(entry, "isorg");
    // IMPORTANT: we de-dupe by treating `isorg` as a strict subset of `type1` when both are present.
    // Rationale: upstream (VBN) endpoints can return `isorg=true` entries in the `type=1` list too.
    // Semantics in UI:
    // - **Inzending** = `type1` but NOT `isorg`
    // - **Schoolinzending** = `isorg` (regardless of `type1`)
    const isPrivate = isType1 && !isIsorg;
    const isOrg = isIsorg;
    return (includeType1 && isPrivate) || (includeIsorg && isOrg);
  }

  function render() {
    if (!dataset) return;

    const { year, pc4, includeType1, includeIsorg } = getFilters();
    const dataYear = Number(dataset?.meta?.year ?? 0) || 0;

    if (year && dataYear && year !== dataYear) {
      pointsLayer.clearLayers();
      gridLayer.clearLayers();
      statsEl.textContent = `Geen dataset voor ${year} (alleen ${dataYear} beschikbaar).`;
      return;
    }

    const filtered = preparedEntries.filter((p) => {
      if (pc4 && p.pc4 !== pc4) return false;
      return (includeType1 && p.isPrivate) || (includeIsorg && p.isOrg);
    });

    rendered = filtered.map((p) => ({
      latlng: p.latlng,
      birdsTotal: p.birdsTotal,
      isType1: p.isPrivate,
      isIsorg: p.isOrg,
      birdIds: p.birdIds,
      birdNames: p.birdNames,
      entry: p.entry,
    }));

    const bounds = filtered.map((p) => p.latlng);

    // Mode 1: draw point markers. Mode 2: hide points.
    pointsLayer.clearLayers();
    if (mode === "points") {
      const privateEntries = filtered.filter((p) => p.isPrivate);
      const orgEntries = filtered.filter((p) => p.isOrg);

      const draw = (p, { bringToFront = false } = {}) => {
        const marker = globalThis.L.circleMarker(p.latlng, {
          radius: 6,
          color: "rgba(255,255,255,0.9)",
          weight: 2,
          fillColor: colorForEntry(p.entry),
          fillOpacity: 0.85,
        })
          .bindPopup(popupHtml(p.entry), { maxWidth: 340 })
          .addTo(pointsLayer);

        if (bringToFront && marker?.bringToFront) marker.bringToFront();
      };

      // Draw private first, org last.
      for (const p of privateEntries) draw(p);
      for (const p of orgEntries) draw(p, { bringToFront: true });
    }

    totals = {
      entries: filtered.length,
      birds: rendered.reduce((acc, r) => acc + r.birdsTotal, 0),
    };

    // Fit bounds on first load, and when PC4 filter changes.
    if (!didFitOnce || pc4 !== lastPc4) {
      if (bounds.length) {
        // Ensure we have an actual bounds object (more robust than raw arrays).
        const bb = globalThis.L.latLngBounds(bounds);
        // Ensure map has measured size before fitting.
        try {
          map.invalidateSize({ animate: false });
        } catch {
          // ignore
        }
        map.fitBounds(bb, { padding: [20, 20] });
        didFitOnce = true;
      } else {
        // Groningen-ish default view
        map.setView([53.22, 6.57], 11);
      }
    }

    lastPc4 = pc4;

    // Initial stats for current viewport (moveend will keep it updated).
    updateViewportStats();

    if (mode === "species") schedulePresenceGridCompute();
  }

  function onFiltersChanged() {
    // Normalize PC4 input "while typing" (only on change events).
    const pc4 = normalizePc4(pc4Input.value);
    if (pc4Input.value && pc4Input.value !== pc4) pc4Input.value = pc4;
    render();
  }

  async function loadForYear(year) {
    const seq = ++loadSeq;
    const y = Number(year || 0) || 0;
    if (!y) return;

    statsEl.textContent = `Dataset ${y} laden…`;

    try {
      const json = await loadMunicipalityDataset({ year: y, area: "groningen" });
      if (seq !== loadSeq) return; // stale request
      dataset = json;
      datasetYear = y;
      didFitOnce = false; // refit when switching datasets

      prepareDataset(json);
      if (!speciesIndex || speciesIndex.length === 0) {
        // Fallback: birdguide is a plain array of names (no IDs).
        try {
          const guide = await loadBirdguide();
          if (seq !== loadSeq) return; // stale request
          speciesIndex = (Array.isArray(guide) ? guide : [])
            .map((name) => ({ id: null, name: String(name || "").trim() }))
            .filter((s) => s.name)
            .sort((a, b) => a.name.localeCompare(b.name, "nl"));
        } catch {
          // ignore fallback failure
        }
      }

      // Reset selection if it's not in the new list.
      if (selectedSpecies) {
        const ok = speciesIndex.some((s) => s.id === selectedSpecies.id && s.name === selectedSpecies.name);
        if (!ok) selectedSpecies = null;
      }

      clearSpeciesStatus();
      renderSpeciesList({ query: speciesSearchInput.value });
      render();
    } catch (err) {
      if (seq !== loadSeq) return; // stale request
      dataset = null;
      datasetYear = 0;
      preparedEntries = [];
      speciesIndex = [];
      selectedSpecies = null;
      pointsLayer.clearLayers();
      gridLayer.clearLayers();
      statsEl.textContent = `Dataset laden mislukt: ${err?.message || String(err)}`;
    }
  }

  yearInput.addEventListener("change", () => loadForYear(Number(yearInput.value || 0) || 0));
  pc4Input.addEventListener("change", onFiltersChanged);
  includeType1Input.addEventListener("change", onFiltersChanged);
  includeIsorgInput.addEventListener("change", onFiltersChanged);

  // Initial view while loading.
  map.setView([53.22, 6.57], 11);
  map.on("moveend", () => {
    updateViewportStats();
    if (mode === "species") {
      if (speciesScope === "viewport") renderSpeciesList({ query: speciesSearchInput.value });
      schedulePresenceGridCompute();
    }
  });

  // Guard against layout/size timing issues (flex layouts, sticky header).
  const invalidate = () => {
    try {
      map.invalidateSize({ animate: false });
    } catch {
      // ignore
    }
  };
  map.whenReady(() => {
    invalidate();
    // A second invalidate on next tick tends to fix "size is 0" edge cases.
    setTimeout(invalidate, 0);
  });
  window.addEventListener("resize", () => invalidate());

  // Initial load (defaults to the year input value).
  loadForYear(Number(yearInput.value || 0) || 0);
}

