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
  const sidebarTabSpecies = document.querySelector("#sidebarTabSpecies");
  const sidebarTabView = document.querySelector("#sidebarTabView");
  const sidebarPanelSpecies = document.querySelector("#sidebarPanelSpecies");
  const sidebarPanelView = document.querySelector("#sidebarPanelView");
  const speciesSearchInput = document.querySelector("#speciesSearchInput");
  const speciesListEl = document.querySelector("#speciesList");
  const sidebarCloseBtn = document.querySelector("#sidebarCloseBtn");
  const speciesScopeViewport = document.querySelector("#speciesScopeViewport");
  const speciesScopeAll = document.querySelector("#speciesScopeAll");
  const speciesSortMost = document.querySelector("#speciesSortMost");
  const speciesSortAZ = document.querySelector("#speciesSortAZ");
  const metricPresence = document.querySelector("#metricPresence");
  const metricAvg = document.querySelector("#metricAvg");
  const metricSum = document.querySelector("#metricSum");
  const styleAuto = document.querySelector("#styleAuto");
  const styleGrid = document.querySelector("#styleGrid");
  const styleHeatmap = document.querySelector("#styleHeatmap");
  const minNSlider = document.querySelector("#minNSlider");
  const minNValue = document.querySelector("#minNValue");

  // Grid cell size (meters) — persistent and zoom-reactive.
  const gridCellSlider = document.querySelector("#gridCellSlider");
  const gridCellValue = document.querySelector("#gridCellValue");
  const gridCellAuto = document.querySelector("#gridCellAuto"); // optional checkbox
  const GRID_CELL_M_DEFAULT = Number(gridCellSlider?.value ?? 1000);

  if (
    !mapEl ||
    !statsEl ||
    !yearInput ||
    !pc4Input ||
    !includeType1Input ||
    !includeIsorgInput ||
    !filtersForm ||
    !sidebarEl ||
    !sidebarTabSpecies ||
    !sidebarTabView ||
    !sidebarPanelSpecies ||
    !sidebarPanelView ||
    !speciesSearchInput ||
    !speciesListEl ||
    !sidebarCloseBtn ||
    !modePointsBtn ||
    !modeSpeciesBtn ||
    !speciesScopeViewport ||
    !speciesScopeAll ||
    !speciesSortMost ||
    !speciesSortAZ ||
    !metricPresence ||
    !metricAvg ||
    !metricSum ||
    !styleAuto ||
    !styleGrid ||
    !styleHeatmap ||
    !minNSlider ||
    !minNValue
  ) {
    return;
  }

  if (!("L" in globalThis)) {
    statsEl.textContent = "Leaflet niet geladen (check netwerk / CDN).";
    return;
  }

  // Grid cell size (meters): Auto (zoom-driven) + Manual override.
  //
  // Important: This grid is defined in *meters* (projected space). That means:
  // - With "Auto" enabled, cell size changes with zoom (best default UX).
  // - With "Auto" disabled, cell size is locked in meters (good for comparing areas).
  //
  // You can add preset buttons in HTML like:
  //   <button data-grid-cell-m="1000">1 km</button>
  const GRID_CELL_M_PRESETS = [
    200, 250, 300, 400, 500, 650, 800, 1000, 1250, 1600, 2000, 2500,
    // 3200, 4000, 5000, 8000, 10000
  ];

  function snapGridCellM(m) {
    const v = Number(m);
    if (!Number.isFinite(v) || v <= 0) return GRID_CELL_M_DEFAULT;
    let best = GRID_CELL_M_PRESETS[0];
    let bestDist = Math.abs(best - v);
    for (const p of GRID_CELL_M_PRESETS) {
      const d = Math.abs(p - v);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  // Heuristic: meters-per-cell for Groningen-ish density.
  // Discrete steps prevent jitter between zoom levels.
  function autoGridCellMForZoom(z) {
    if (z >= 16) return 200;
    if (z === 15) return 250;
    if (z === 14) return 350;
    if (z === 13) return 500;
    if (z === 12) return 800;
    if (z === 11) return 1200;
    if (z === 10) return 1800;
    return 2500; // z <= 9
  }

  function readBoolLS(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  }

  // Manual value is always persisted, even when Auto is on (so you can toggle back).
  let gridCellMManual = (() => {
    const v = Number(localStorage.getItem("tvt:GridCellM"));
    return Number.isFinite(v) && v > 0 ? v : GRID_CELL_M_DEFAULT;
  })();

  let gridCellAutoEnabled = readBoolLS("tvt:GridCellAuto", true);

  // Effective cell size used by compute. Initialized after map is created.
  let gridCellM = snapGridCellM(gridCellMManual);

  function updateGridCellUI(effectiveM) {
    if (!gridCellSlider || !gridCellValue) return;

    // Slider reflects the manual value; disabled when Auto is enabled.
    gridCellSlider.disabled = gridCellAutoEnabled;
    gridCellSlider.min = String(Math.min(...GRID_CELL_M_PRESETS));
    gridCellSlider.max = String(Math.max(...GRID_CELL_M_PRESETS));
    gridCellSlider.step = "1"; // snapping happens in JS

    const sliderVal = gridCellAutoEnabled ? effectiveM : snapGridCellM(gridCellMManual);
    gridCellSlider.value = String(sliderVal);

    gridCellValue.textContent = gridCellAutoEnabled ? `${effectiveM} m (Auto)` : `${effectiveM} m`;

    if (gridCellAuto && "checked" in gridCellAuto) {
      gridCellAuto.checked = gridCellAutoEnabled;
    }
  }

  // Called once we have a Leaflet map instance.
  function initGridCellControls(map) {
    // Compute initial effective size (auto uses current zoom).
    gridCellM = gridCellAutoEnabled ? autoGridCellMForZoom(map.getZoom()) : snapGridCellM(gridCellMManual);
    updateGridCellUI(gridCellM);

    // Slider (manual override)
    if (gridCellSlider) {
      gridCellSlider.addEventListener("input", () => {
        const snapped = snapGridCellM(Number(gridCellSlider.value));
        gridCellMManual = snapped;
        localStorage.setItem("tvt:GridCellM", String(gridCellMManual));

        if (!gridCellAutoEnabled) {
          gridCellM = snapped;
          updateGridCellUI(gridCellM);
          schedulePresenceGridCompute();
        } else {
          // In auto mode the slider is disabled; still keep UI consistent.
          updateGridCellUI(gridCellM);
        }
      });
    }

    // Preset buttons (optional)
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const v = t.getAttribute("data-grid-cell-m");
      if (!v) return;
      const snapped = snapGridCellM(Number(v));
      gridCellMManual = snapped;
      localStorage.setItem("tvt:GridCellM", String(gridCellMManual));
      if (!gridCellAutoEnabled) {
        gridCellM = snapped;
        updateGridCellUI(gridCellM);
        schedulePresenceGridCompute();
      }
    });

    // Auto toggle (optional checkbox)
    if (gridCellAuto && "addEventListener" in gridCellAuto) {
      if ("checked" in gridCellAuto) gridCellAuto.checked = gridCellAutoEnabled;

      gridCellAuto.addEventListener("change", () => {
        gridCellAutoEnabled = Boolean(gridCellAuto.checked);
        localStorage.setItem("tvt:GridCellAuto", gridCellAutoEnabled ? "1" : "0");
        gridCellM = gridCellAutoEnabled ? autoGridCellMForZoom(map.getZoom()) : snapGridCellM(gridCellMManual);
        updateGridCellUI(gridCellM);
        schedulePresenceGridCompute();
      });
    }

    // Auto mode updates on zoom changes.
    map.on("zoomend", () => {
      if (!gridCellAutoEnabled) return;
      const next = autoGridCellMForZoom(map.getZoom());
      if (next !== gridCellM) {
        gridCellM = next;
        updateGridCellUI(gridCellM);
        schedulePresenceGridCompute();
      }
    });
  }

  // Prevent accidental form submit refresh on Enter.
  filtersForm.addEventListener("submit", (e) => e.preventDefault());

  statsEl.textContent = "Dataset laden…";

  const map = globalThis.L.map(mapEl, {
    zoomControl: false,
    preferCanvas: true,
    minZoom: 8,
  });

  globalThis.L.control.zoom({ position: 'topright' }).addTo(map);

  // Grid cell size controls (auto/manual) depend on the map instance.
  initGridCellControls(map);

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
  const SELECTED_SPECIES_LS_KEY = "tvt:selectedSpecies";
  let computeTimer = 0;
  let speciesScope = "viewport"; // "viewport" | "all"
  let speciesSort = "most"; // "most" | "az"
  let metric = "presence"; // "presence" | "avg" | "sum"
  let style = "auto"; // "auto" | "grid" | "heatmap"
  let minN = Number(minNSlider?.value || 3);
  let sidebarOpen = true;
  let hudStats = { entries: 0, birds: 0 };
  let hudControl = null;
  let sidebarToggleControl = null;
  let isComputing = false;

  let legendType1TextEl = null;
  let legendIsorgTextEl = null;

  function readSelectedSpeciesFromStorage() {
    try {
      const raw = window.localStorage.getItem(SELECTED_SPECIES_LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const name = String(obj?.name ?? "").trim();
      if (!name) return null;
      const idRaw = obj?.id;
      const id =
        idRaw == null
          ? null
          : (Number.isFinite(Number(idRaw)) ? Number(idRaw) : null);
      return { id, name };
    } catch {
      return null;
    }
  }

  function persistSelectedSpeciesToStorage() {
    try {
      if (!selectedSpecies) {
        window.localStorage.removeItem(SELECTED_SPECIES_LS_KEY);
        return;
      }
      const payload = {
        id: selectedSpecies.id == null ? null : Number(selectedSpecies.id),
        name: String(selectedSpecies.name || "").trim(),
      };
      if (!payload.name) {
        window.localStorage.removeItem(SELECTED_SPECIES_LS_KEY);
        return;
      }
      window.localStorage.setItem(SELECTED_SPECIES_LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }

  function setSelectedSpecies(next, { persist = true } = {}) {
    if (!next) {
      selectedSpecies = null;
    } else {
      selectedSpecies = {
        id: next.id == null ? null : Number(next.id),
        name: String(next.name || "").trim(),
      };
      if (!selectedSpecies.name) selectedSpecies = null;
    }
    if (persist) persistSelectedSpeciesToStorage();
  }

  // Restore last selected species (removed when user toggles it off).
  setSelectedSpecies(readSelectedSpeciesFromStorage(), { persist: false });

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

  // Number formatting helpers.
  //
  // IMPORTANT: These are used by `updateHud()`, which can run very early (during `setMode()`)
  // especially when `selectedSpecies` is restored from localStorage. So this must be defined
  // before the first `setMode(...)` call to avoid TDZ issues.
  const nfInt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
  const nfAvg1 = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function fmtInt(n) {
    return nfInt.format(Number(n || 0) || 0);
  }

  function fmtAvg(v) {
    const n = Number(v || 0) || 0;
    return nfAvg1.format(n);
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

    hudStats = { entries: inViewEntries, birds: inViewBirds };
    statsEl.textContent = `${inViewEntries} inzendingen in beeld (totaal ${totals.entries}) • ${inViewBirds} vogels geteld (totaal ${totals.birds})`;

    if (legendType1TextEl) legendType1TextEl.textContent = `Inzending (${inViewType1})`;
    if (legendIsorgTextEl) legendIsorgTextEl.textContent = `Schoolinzending (${inViewIsorg})`;
    updateHud();
  }

  // Legend (copied from old app style)
  const legend = globalThis.L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = globalThis.L.DomUtil.create("div", "pill tvt-legend");

    const row = ({ label, color, getTextEl }) => {
      const r = document.createElement("div");
      r.className = "tvt-legend-row";
      const dot = document.createElement("span");
      dot.className = "tvt-legend-dot";
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

  function setLegendVisible(show) {
    if (show) {
      if (!legend._map) legend.addTo(map);
    } else {
      if (legend._map) legend.remove(); // of: map.removeControl(legend)
    }
  }

  // Grid/heatmap legend for species mode (sequential, luminance ramp + gamma).
  const GRID_COLORMAP_GAMMA = 0.6;
  // ColorBrewer "Blues" ramp (light -> dark), sampled densely for smooth interpolation.
  const GRID_COLORMAP_BLUES = [
    [247, 251, 255],
    [222, 235, 247],
    [198, 219, 239],
    [158, 202, 225],
    [107, 174, 214],
    [66, 146, 198],
    [33, 113, 181],
    [8, 81, 156],
    [8, 48, 107],
  ];

  function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  // Gamma mapping that increases contrast near the high end.
  function applyHighEndGamma(t, gamma = GRID_COLORMAP_GAMMA) {
    const x = clamp01(t);
    const g = Number(gamma);
    if (!Number.isFinite(g) || g <= 0) return x;
    return 1 - Math.pow(1 - x, g);
  }

  function colorFromBluesRamp(t) {
    const x = clamp01(t);
    const n = GRID_COLORMAP_BLUES.length;
    if (n <= 1) {
      const c = GRID_COLORMAP_BLUES[0] || [125, 211, 252];
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    const f = x * (n - 1);
    const i = Math.floor(f);
    const w = f - i;
    const c0 = GRID_COLORMAP_BLUES[Math.min(n - 1, Math.max(0, i))];
    const c1 = GRID_COLORMAP_BLUES[Math.min(n - 1, Math.max(0, i + 1))];
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * w);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * w);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * w);
    return `rgb(${r},${g},${b})`;
  }

  function metricLabelNl(m) {
    if (m === "sum") return "Totaal";
    if (m === "avg") return "Gemiddeld";
    return "Aanwezigheid";
  }

  let gridLegendTitleEl = null;
  let gridLegendScaleEl = null;
  let gridLegendLabelsEl = null;
  let gridLegendNoteEl = null;

  const gridLegend = globalThis.L.control({ position: "bottomright" });
  gridLegend.onAdd = () => {
    const div = globalThis.L.DomUtil.create("div", "pill tvt-legend tvt-grid-legend");

    const title = document.createElement("div");
    title.className = "tvt-grid-legend-title";
    title.textContent = "Aanwezigheid";
    div.appendChild(title);
    gridLegendTitleEl = title;

    const scale = document.createElement("div");
    scale.className = "tvt-grid-legend-scale";
    div.appendChild(scale);
    gridLegendScaleEl = scale;

    const labels = document.createElement("div");
    labels.className = "tvt-grid-legend-labels";
    div.appendChild(labels);
    gridLegendLabelsEl = labels;

    const note = document.createElement("div");
    note.className = "tvt-grid-legend-note";
    note.textContent = `Kleur = waarde (γ=${GRID_COLORMAP_GAMMA}), opacity ≈ √N`;
    div.appendChild(note);
    gridLegendNoteEl = note;

    // Don't let the legend eat map scroll/drag.
    globalThis.L.DomEvent.disableClickPropagation(div);
    globalThis.L.DomEvent.disableScrollPropagation(div);

    // Populate with a sensible default so it never renders "empty".
    updateGridLegend({ metric: "presence", maxMetric: 1, effectiveStyle: "grid" });
    return div;
  };
  gridLegend.addTo(map);

  function setGridLegendVisible(show) {
    if (show) {
      if (!gridLegend._map) gridLegend.addTo(map);
    } else {
      if (gridLegend._map) gridLegend.remove();
    }
  }
  // Default mode is "points".
  setGridLegendVisible(false);

  function updateGridLegend({ metric, maxMetric, effectiveStyle }) {
    if (!gridLegendTitleEl || !gridLegendScaleEl || !gridLegendLabelsEl || !gridLegendNoteEl) return;

    const stops = [0, 0.25, 0.5, 0.75, 1];
    const m = metric === "sum" ? "sum" : metric === "avg" ? "avg" : "presence";
    const maxV = Number(maxMetric);
    const maxOk = Number.isFinite(maxV) && maxV > 0 ? maxV : 0;

    gridLegendTitleEl.textContent = `${metricLabelNl(m)} • ${effectiveStyle === "heatmap" ? "Heatmap" : "Raster"}`;

    // Swatches
    gridLegendScaleEl.replaceChildren();
    for (const s of stops) {
      const sw = document.createElement("span");
      sw.className = "tvt-grid-legend-swatch";
      sw.style.background = colorFromBluesRamp(applyHighEndGamma(s));
      gridLegendScaleEl.appendChild(sw);
    }

    // Labels
    gridLegendLabelsEl.replaceChildren();
    for (const s of stops) {
      const el = document.createElement("span");
      if (m === "presence") {
        el.textContent = `${Math.round(s * 100)}%`;
      } else if (m === "sum") {
        el.textContent = maxOk ? fmtInt(s * maxOk) : "0";
      } else {
        el.textContent = maxOk ? fmtAvg(s * maxOk) : "0";
      }
      gridLegendLabelsEl.appendChild(el);
    }

    if (m === "presence") {
      gridLegendNoteEl.textContent = `Kleur = aanwezigheid (0–100%, γ=${GRID_COLORMAP_GAMMA}), opacity ≈ √N`;
    } else if (m === "sum") {
      gridLegendNoteEl.textContent = `Kleur = relatief t.o.v. max in beeld (${maxOk ? fmtInt(maxOk) : "—"}, γ=${GRID_COLORMAP_GAMMA}), opacity ≈ √N`;
    } else {
      gridLegendNoteEl.textContent = `Kleur = relatief t.o.v. max in beeld (${maxOk ? fmtAvg(maxOk) : "—"}, γ=${GRID_COLORMAP_GAMMA}), opacity ≈ √N`;
    }
  }

  function setMode(nextMode) {
    mode = nextMode === "species" ? "species" : "points";
    syncModeToUrl(mode);

    modePointsBtn.setAttribute("aria-pressed", mode === "points" ? "true" : "false");
    modeSpeciesBtn.setAttribute("aria-pressed", mode === "species" ? "true" : "false");

    // Allow mode-based styling without touching JS again.
    document.body.dataset.mode = mode;

    // Mode 1 never shows sidebar.
    if (mode !== "species") {
      setSidebarOpen(false, { persist: false, reason: "mode1" });
    } else {
      initSidebarOpenOnEnterSpeciesMode();
    }

    updateSidebarToggleControl();

    if (mode === "species") {
      if (map.hasLayer(pointsLayer)) map.removeLayer(pointsLayer);
      if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
      setLegendVisible(false);
      setGridLegendVisible(true);
    } else {
      if (map.hasLayer(gridLayer)) map.removeLayer(gridLayer);
      gridLayer.clearLayers();
      if (!map.hasLayer(pointsLayer)) pointsLayer.addTo(map);
      setLegendVisible(true);
      setGridLegendVisible(false);
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

  function isMobile() {
    return window.matchMedia && window.matchMedia("(max-width: 880px)").matches;
  }

  function sidebarStorageKey() {
    return `tvt:speciesSidebarOpen:${isMobile() ? "mobile" : "desktop"}`;
  }

  function hasSidebarPreference() {
    try {
      return window.localStorage.getItem(sidebarStorageKey()) != null;
    } catch {
      return false;
    }
  }

  function getSavedSidebarOpen() {
    try {
      const v = window.localStorage.getItem(sidebarStorageKey());
      if (v == null) return null;
      return v === "1" || v === "true" || v === "open";
    } catch {
      return null;
    }
  }

  function saveSidebarOpen(open) {
    try {
      window.localStorage.setItem(sidebarStorageKey(), open ? "open" : "closed");
    } catch {
      // ignore
    }
  }

  function setSidebarOpen(open, { persist = true, reason = "" } = {}) {
    sidebarOpen = Boolean(open);
    sidebarEl.hidden = !(mode === "species" && sidebarOpen);
    updateSidebarToggleControl();

    if (mode === "species") {
      if (sidebarOpen) {
        if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
      }
      // sidebar open/close changes map size
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
    }

    if (persist) saveSidebarOpen(sidebarOpen);
    updateHud();
    if (mode === "species" && !sidebarOpen) schedulePresenceGridCompute();
  }

  function initSidebarOpenOnEnterSpeciesMode() {
    const saved = getSavedSidebarOpen();
    if (saved == null) {
      // First time: open sidebar (friendly), except on mobile with species selected.
      if (isMobile() && selectedSpecies) setSidebarOpen(false, { persist: false, reason: "mobile-default-closed" });
      else setSidebarOpen(true, { persist: false, reason: "first-time-open" });
      return;
    }
    setSidebarOpen(saved, { persist: false, reason: "restore" });
  }

  sidebarCloseBtn.addEventListener("click", () => {
    if (mode !== "species") return;
    setSidebarOpen(false, { persist: true, reason: "close" });
  });

  function updateSidebarToggleControl() {
    if (mode !== "species") {
      if (sidebarToggleControl) {
        try { sidebarToggleControl.remove(); } catch { /* ignore */ }
      }
      sidebarToggleControl = null;
      return;
    }

    if (!sidebarToggleControl) {
      sidebarToggleControl = globalThis.L.control({ position: "topleft" });
      sidebarToggleControl.onAdd = () => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tvt-sidebar-toggle-btn";
        btn.addEventListener("click", () => setSidebarOpen(!sidebarOpen, { persist: true, reason: "map-toggle" }));
        globalThis.L.DomEvent.disableClickPropagation(btn);
        globalThis.L.DomEvent.disableScrollPropagation(btn);
        return btn;
      };
      sidebarToggleControl.addTo(map);
    }

    const el = sidebarToggleControl.getContainer();
    if (el) {
      el.textContent = sidebarOpen ? "<" : ">";
      el.ariaLabel = sidebarOpen ? "Zijbalk sluiten" : "Zijbalk openen";
    }
  }

  function updateHud() {
    if (mode !== "species") {
      if (hudControl) {
        try {
          hudControl.remove();
        } catch {
          // ignore
        }
      }
      hudControl = null;
      return;
    }

    // HUD: if a species is selected we always show it (even when sidebar is open).
    // If nothing is selected, only show HUD when sidebar is closed.
    const showHud = Boolean(selectedSpecies) || !sidebarOpen;

    if (!showHud) {
      if (hudControl) {
        try {
          hudControl.remove();
        } catch {
          // ignore
        }
      }
      hudControl = null;
      return;
    }

    const effectiveStyleRaw = style === "auto" ? (metric === "sum" ? "heatmap" : "grid") : style;
    const styleNl = effectiveStyleRaw === "heatmap" ? "heatmap" : "raster";
    const suffixMinN = minN > 1 ? ` · min‑N ${minN}` : "";

    // Compute metric sentence using current viewport.
    const summary = computeSelectedSpeciesViewportSummary();

    let hudName = "";
    let hudStyle = "";
    let hudMetric = "";

    if (!selectedSpecies) {
      hudName = "Kies een soort";
      hudStyle = "";
      hudMetric = "Klik om de zijbalk te openen";
    } else {
      hudName = selectedSpecies.name;
      hudStyle = `${styleNl}${suffixMinN}`.trim();

      if (isComputing) {
        hudMetric = "Bezig met berekenen…";
      } else if (metric === "sum") {
        hudMetric = `In beeld · Totaal ${fmtInt(summary.sum)} geteld`;
      } else if (metric === "avg") {
        hudMetric = `In beeld · Gemiddeld ${fmtAvg(summary.avg)} per inzending`;
      } else {
        // presence
        const pct = summary.total ? Math.round((summary.with / summary.total) * 100) : 0;
        hudMetric = `Aanwezig in ${fmtInt(summary.with)}/${fmtInt(summary.total)} inzendingen (${pct}%)`;
      }
    }

    if (!hudControl) {
      hudControl = globalThis.L.control({ position: "topleft" });
      hudControl.onAdd = () => {
        const div = globalThis.L.DomUtil.create("div", "tvt-hud");
        div.tabIndex = 0;

        const imgEl = document.createElement("div");
        imgEl.className = "tvt-hud-image";
        imgEl.innerHTML = birdImageHtml(selectedSpecies.name);
        div.appendChild(imgEl);

        const nameEl = document.createElement("div");
        nameEl.className = "tvt-hud-name";
        div.appendChild(nameEl);

        const styleEl = document.createElement("div");
        styleEl.className = "tvt-hud-style";
        div.appendChild(styleEl);

        const metricEl = document.createElement("div");
        metricEl.className = "tvt-hud-metric";
        div.appendChild(metricEl);

        const open = () => setSidebarOpen(true, { persist: true, reason: "hud" });
        div.addEventListener("click", open);
        div.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") open();
        });

        globalThis.L.DomEvent.disableClickPropagation(div);
        globalThis.L.DomEvent.disableScrollPropagation(div);

        div.__tvt = { imgEl, nameEl, styleEl, metricEl };
        return div;
      };
      hudControl.addTo(map);
    }

    const el = hudControl.getContainer();
    const refs = el?.__tvt;
    if (refs) {
      refs.imgEl.innerHTML = birdImageHtml(selectedSpecies.name);
      refs.nameEl.textContent = hudName;
      refs.styleEl.textContent = hudStyle;
      refs.metricEl.textContent = hudMetric;
    }
  }

  function computeSelectedSpeciesViewportSummary() {
    const out = { total: 0, with: 0, sum: 0, avg: 0 };
    if (!selectedSpecies) return out;

    let bounds = null;
    try {
      bounds = map.getBounds();
    } catch {
      bounds = null;
    }
    if (!bounds) return out;

    const selId = selectedSpecies.id != null ? Number(selectedSpecies.id) : null;
    const selName = selId == null ? normalizeSpeciesName(selectedSpecies.name) : "";

    for (const e of rendered) {
      if (!bounds.contains(e.latlng)) continue;
      out.total += 1;

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
      if (cnt > 0) out.with += 1;
      out.sum += cnt;
    }

    out.avg = out.total ? out.sum / out.total : 0;
    return out;
  }

  function setComputing(next) {
    isComputing = Boolean(next);
    updateHud();
  }

  let sidebarTab = "species"; // "species" | "view"

  function setSidebarTab(next) {
    sidebarTab = next === "view" ? "view" : "species";
    sidebarTabSpecies.setAttribute("aria-pressed", sidebarTab === "species" ? "true" : "false");
    sidebarTabView.setAttribute("aria-pressed", sidebarTab === "view" ? "true" : "false");
    sidebarPanelSpecies.hidden = sidebarTab !== "species";
    sidebarPanelView.hidden = sidebarTab !== "view";
  }

  sidebarTabSpecies.addEventListener("click", () => setSidebarTab("species"));
  sidebarTabView.addEventListener("click", () => setSidebarTab("view"));

  // Default tab on open.
  setSidebarTab("species");

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

      const img = document.createElement("span");
      img.className = "species-item-image";
      img.innerHTML = birdImageHtml(s.name);
      btn.appendChild(img);

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
        // Toggle behavior: clicking the selected species deselects it.
        const isSame =
          selectedSpecies &&
          selectedSpecies.id === s.id &&
          selectedSpecies.name === s.name;
        setSelectedSpecies(isSame ? null : s);
        renderSpeciesList({ query: speciesSearchInput.value });
        schedulePresenceGridCompute();
        updateHud();
        // Mobile UX: selecting a species should immediately show the map.
        // This auto-close does NOT persist preference (user intent wins).
        if (mode === "species" && isMobile() && selectedSpecies) {
          setSidebarOpen(false, { persist: false, reason: "mobile-autoclose-on-select" });
        }
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
    style = styleHeatmap.checked ? "heatmap" : (styleGrid.checked ? "grid" : "auto");
    minN = Number(minNSlider.value || 0) || 0;
    minNValue.textContent = String(minN);
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
  styleAuto.addEventListener("change", onSpeciesControlsChanged);
  styleGrid.addEventListener("change", onSpeciesControlsChanged);
  styleHeatmap.addEventListener("change", onSpeciesControlsChanged);
  minNSlider.addEventListener("input", onSpeciesControlsChanged);

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
      setComputing(false);
      return;
    }

    const entries = rendered;
    if (!entries || entries.length === 0) {
      setComputing(false);
      return;
    }

    setComputing(true);

    const selId = selectedSpecies.id != null ? Number(selectedSpecies.id) : null;
    const selName = selId == null ? normalizeSpeciesName(selectedSpecies.name) : "";

    // We anchor the grid in projected CRS meters (EPSG:3857), not to the viewport pixels.
    // This makes the grid stable under pan/zoom and makes `gridCellM` truly "meters".
    const crs = map.options.crs;
    const bounds = map.getBounds();

    // Aggregate by (ix, iy) where each cell is gridCellM x gridCellM meters in projected space.
    const cells = new Map(); // key -> { total, withN, sum, ix, iy }

    for (const e of entries) {
      // Only consider points currently in view (keeps it fast and matches HUD wording).
      if (!bounds.contains(e.latlng)) continue;

      const p = crs.project(e.latlng); // meters-ish in WebMercator
      const ix = Math.floor(p.x / gridCellM);
      const iy = Math.floor(p.y / gridCellM);
      const key = `${ix},${iy}`;

      let cell = cells.get(key);
      if (!cell) {
        cell = { ix, iy, total: 0, withN: 0, sum: 0 };
        cells.set(key, cell);
      }

      cell.total += 1;

      const has =
        selId != null
          ? Boolean(e.birdIds && e.birdIds.has(selId))
          : Boolean(e.birdNames && e.birdNames.has(selName));

      if (has) {
        cell.withN += 1;

        // For avg/sum we need the per-entry count for this species.
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
        cell.sum += cnt;
      }
    }

    if (cells.size === 0) {
      setComputing(false);
      return;
    }

    // Normalize metric per viewport for visualization.
    let maxMetric = 0;
    for (const cell of cells.values()) {
      const total = cell.total;
      if (!total || total < minN) continue;
      const v =
        metric === "sum"
          ? cell.sum
          : metric === "avg"
            ? cell.sum / total
            : (cell.withN / total); // presence
      cell.v = v;
      if (v > maxMetric) maxMetric = v;
    }

    // Decide render style (auto mapping or explicit override).
    const effectiveStyle =
      style === "auto"
        ? (metric === "sum" ? "heatmap" : "grid")
        : style;

    updateGridLegend({ metric, maxMetric, effectiveStyle });

    // Render cells. We only render cells that have enough sample size (minN).
    // Opacity scales by both value and sample size to hint uncertainty.
    for (const cell of cells.values()) {
      const total = cell.total;
      const withN = cell.withN;
      const sum = cell.sum;
      const v = cell.v || 0;

      if (total < minN) continue;

      // Presence is already bounded 0..1; keep it on an absolute scale for interpretability.
      const vNorm =
        metric === "presence"
          ? clamp01(v)
          : (maxMetric ? clamp01(v / maxMetric) : 0);
      if (!vNorm) continue;

      const nScale = Math.min(1, Math.sqrt(total) / 3); // tune: 3 ~= "reasonable N"
      const baseOpacity = effectiveStyle === "heatmap" ? 0.55 : 0.75;
      const fillOpacity = Math.min(0.95, baseOpacity * (0.25 + 0.75 * nScale));
      const fillColor = colorFromBluesRamp(applyHighEndGamma(vNorm));

      // Cell bounds in projected meters
      const x0m = cell.ix * gridCellM;
      const y0m = cell.iy * gridCellM;
      const x1m = x0m + gridCellM;
      const y1m = y0m + gridCellM;

      // Convert projected meters back to lat/lng for Leaflet layers.
      const sw = crs.unproject(globalThis.L.point(x0m, y0m));
      const ne = crs.unproject(globalThis.L.point(x1m, y1m));
      const bb = globalThis.L.latLngBounds(sw, ne);

      const metricLabel =
        metric === "sum"
          ? `totaal=${sum.toFixed(0)}`
          : metric === "avg"
            ? `gemiddeld=${(total ? (sum / total) : 0).toFixed(2)}`
            : `aanwezigheid=${(total ? (withN / total) * 100 : 0).toFixed(1)}%`;

      const tooltip = `<b>${selectedSpecies.name}</b><br>N_totaal=${total} • N_met=${withN}\n${metricLabel}`;

      if (effectiveStyle === "heatmap") {
        // Heatmap-ish: circles centered on the cell, radius ~ half a cell.
        const cxm = x0m + gridCellM / 2;
        const cym = y0m + gridCellM / 2;
        const center = crs.unproject(globalThis.L.point(cxm, cym));

        const circle = globalThis.L.circle(center, {
          radius: Math.max(30, gridCellM * 0.6),
          stroke: false,
          fillColor,
          fillOpacity,
        });
        circle.bindTooltip(tooltip, { sticky: false });
        circle.addTo(gridLayer);
      } else {
        const rect = globalThis.L.rectangle(bb, {
          color: "rgba(255,255,255,0.18)",
          weight: 1,
          fillColor,
          fillOpacity,
        });
        rect.bindTooltip(tooltip, { sticky: false });
        rect.addTo(gridLayer);
      }
    }

    setComputing(false);
  }

  function popupHtml(entry) {
    const birds = Array.isArray(entry?.birds) ? entry.birds : [];
    const total = sumBirds(birds);
    const imgFallback = birdFallbackFilename();
    const rows = birds
      .slice()
      .sort((a, b) => (Number(b?.count ?? 0) || 0) - (Number(a?.count ?? 0) || 0))
      .map((b) => {
        const name = String(b?.name ?? "Onbekend");
        const count = Number(b?.count ?? 0) || 0;
        const img = birdImageHtml(name);

        return `
          <li class="row">
            <span class="img">${img}</span>
            <span class="name">${name}</span>
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

  function birdImageHtml(name) {
    const filename = guessImageFilename(name);
    const src = birdImageUrl(filename);
    const imgFallback = birdFallbackFilename();
    const fallbackSrc = birdImageUrl(imgFallback);
    const alt = escapeHtml(name);
    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.birdImageOnError(this)" />`;
  }

  window.birdImageOnError = function (img) {
    img.onerror = null;
    img.classList.add("no-bird-image");
    img.src = birdImageUrl(birdFallbackFilename());
  }

  function birdImageUrl(filename) {
    return `https://cdn-cf.newstory.nl/vbn/tvt/media/img/resultaten/${filename}`;
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
        if (!ok) setSelectedSpecies(null);
      }

      setComputing(false);
      renderSpeciesList({ query: speciesSearchInput.value });
      render();
    } catch (err) {
      if (seq !== loadSeq) return; // stale request
      dataset = null;
      datasetYear = 0;
      preparedEntries = [];
      speciesIndex = [];
      setSelectedSpecies(null);
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

