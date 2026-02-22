import { loadBirdguide, loadMunicipalityDataset } from "./data.js";
import { StaticTilesSource, isAbortError, lngLatToTileXY, tilesForBounds } from "./data_source.js";
import { formatNumber } from "./helpers.js";
import { WorkerClusterSource } from "./worker_cluster_source.js";

export function initApp() {
  const mapEl = document.querySelector("#map");
  const statsEl = document.querySelector("#statsBar");
  const modePointsBtn = document.querySelector("#modePointsBtn");
  const modeSpeciesBtn = document.querySelector("#modeSpeciesBtn");
  const yearInput = document.querySelector("#yearInput");
  const pc4Input = document.querySelector("#pc4Input");
  const pointsModePrivateInput = document.querySelector("#pointsModePrivateInput");
  const pointsModeIsorgInput = document.querySelector("#pointsModeIsorgInput");
  const filtersForm = document.querySelector("#filtersForm");
  const sidebarSpeciesEl = document.querySelector("#sidebarSpecies");
  const sidebarPointsEl = document.querySelector("#sidebarPoints");
  const sidebarTabSpecies = document.querySelector("#sidebarTabSpecies");
  const sidebarTabView = document.querySelector("#sidebarTabView");
  const sidebarPanelSpecies = document.querySelector("#sidebarPanelSpecies");
  const sidebarPanelView = document.querySelector("#sidebarPanelView");
  const speciesSearchInput = document.querySelector("#speciesSearchInput");
  const speciesListEl = document.querySelector("#speciesList");
  const sidebarSpeciesCloseBtn = document.querySelector("#sidebarSpeciesCloseBtn");
  const sidebarPointsCloseBtn = document.querySelector("#sidebarPointsCloseBtn");
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
  const pointsDisplayAuto = document.querySelector("#pointsDisplayAuto");
  const pointsDisplayPoints = document.querySelector("#pointsDisplayPoints");
  const pointsDisplayClusters = document.querySelector("#pointsDisplayClusters");
  const pointsClusterStyleRow = document.querySelector("#pointsClusterStyleRow");
  const pointsClusterStyleBlended = document.querySelector("#pointsClusterStyleBlended");
  const pointsClusterStyleMixed = document.querySelector("#pointsClusterStyleMixed");
  const pointsMaxPointsInput = document.querySelector("#pointsMaxPointsInput");
  const pointsTileBuffer0 = document.querySelector("#pointsTileBuffer0");
  const pointsTileBuffer1 = document.querySelector("#pointsTileBuffer1");
  const pointsTileBuffer2 = document.querySelector("#pointsTileBuffer2");
  const pointsAutoClusterThresholdRow = document.querySelector("#pointsAutoClusterThresholdRow");
  const pointsAutoClusterThresholdInput = document.querySelector("#pointsAutoClusterThresholdInput");
  const pointsDisableClusteringAtZoomRow = document.querySelector("#pointsDisableClusteringAtZoomRow");
  const pointsDisableClusteringAtZoomInput = document.querySelector("#pointsDisableClusteringAtZoomInput");
  const pointsClusterEngineRow = document.querySelector("#pointsClusterEngineRow");
  const pointsClusterEngineDefault = document.querySelector("#pointsClusterEngineDefault");
  const pointsClusterEngineWorker = document.querySelector("#pointsClusterEngineWorker");
  const pointsUpdateOnMoveInput = document.querySelector("#pointsUpdateOnMoveInput");
  const pointsSidebarMessage = document.querySelector("#pointsSidebarMessage");
  const speciesViewResetBtn = document.querySelector("#speciesViewResetBtn");
  const pointsResetBtn = document.querySelector("#pointsResetBtn");

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
    !pointsModePrivateInput ||
    !pointsModeIsorgInput ||
    !filtersForm ||
    !sidebarSpeciesEl ||
    !sidebarPointsEl ||
    !sidebarTabSpecies ||
    !sidebarTabView ||
    !sidebarPanelSpecies ||
    !sidebarPanelView ||
    !speciesSearchInput ||
    !speciesListEl ||
    !sidebarSpeciesCloseBtn ||
    !sidebarPointsCloseBtn ||
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
    !minNValue ||
    !pointsDisplayAuto ||
    !pointsDisplayPoints ||
    !pointsDisplayClusters ||
    !pointsClusterStyleRow ||
    !pointsClusterStyleBlended ||
    !pointsClusterStyleMixed ||
    !pointsMaxPointsInput ||
    !pointsTileBuffer0 ||
    !pointsTileBuffer1 ||
    !pointsTileBuffer2 ||
    !pointsAutoClusterThresholdRow ||
    !pointsAutoClusterThresholdInput ||
    !pointsDisableClusteringAtZoomRow ||
    !pointsDisableClusteringAtZoomInput ||
    !pointsClusterEngineRow ||
    !pointsClusterEngineDefault ||
    !pointsClusterEngineWorker ||
    !pointsUpdateOnMoveInput ||
    !pointsSidebarMessage ||
    !speciesViewResetBtn ||
    !pointsResetBtn
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

  const POINT_MODE_FILTERS_LS_KEY = "tvt:pointModeFilters";
  const POINTS_SIDEBAR_STORAGE_KEY = "tvt:pointsSidebarOpen";
  const POINTS_SETTINGS_STORAGE_KEY = "tvt:pointsSettings";
  const GRID_CELL_M_LS_KEY = "tvt:GridCellM";
  const GRID_CELL_AUTO_LS_KEY = "tvt:GridCellAuto";
  const POINT_CAP_HINT = "Te veel punten in beeld — zoom in of kies Clusters.";
  const ENTRY_TOP_BIRDS_API_BASE = "https://vbn-tvt.northsea.cloud/v1/report";
  const WORKER_CLUSTER_FALLBACK_HINT = "Worker-clustering niet beschikbaar. Standaard clustering wordt gebruikt.";
  const WORKER_CLUSTER_RADIUS = 80;

  function removeStorageKeys(keys) {
    for (const key of keys) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore storage failures
      }
    }
  }

  function normalizeOptionalMaxPointsInView(value, fallback = null) {
    if (value == null) return fallback;
    const raw = String(value).trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(500000, Math.max(1, Math.round(n)));
  }

  const POINTS_SETTINGS_DEFAULTS = {
    displayMode: pointsDisplayClusters.checked
      ? "clusters"
      : (pointsDisplayPoints.checked ? "points" : "auto"),
    clusterEngine: "worker",
    clusterStyle: pointsClusterStyleMixed.checked ? "split" : "blended",
    maxPointsInView: normalizeOptionalMaxPointsInView(pointsMaxPointsInput.value, null),
    tileBuffer: pointsTileBuffer2.checked ? 2 : (pointsTileBuffer0.checked ? 0 : 1),
    autoClusterThreshold: toIntInRange(pointsAutoClusterThresholdInput.value, 10, 0, 22),
    disableClusteringAtZoom: toIntInRange(pointsDisableClusteringAtZoomInput.value, 12, 0, 22),
    updateOnMove: Boolean(pointsUpdateOnMoveInput.checked),
  };

  function toIntInRange(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function normalizePointsSettings(raw) {
    const displayMode = ["auto", "points", "clusters"].includes(raw?.displayMode)
      ? raw.displayMode
      : POINTS_SETTINGS_DEFAULTS.displayMode;
    const clusterEngine = ["default", "worker"].includes(raw?.clusterEngine)
      ? raw.clusterEngine
      : POINTS_SETTINGS_DEFAULTS.clusterEngine;
    const clusterStyle = ["blended", "split"].includes(raw?.clusterStyle)
      ? raw.clusterStyle
      : POINTS_SETTINGS_DEFAULTS.clusterStyle;
    return {
      displayMode,
      clusterEngine,
      clusterStyle,
      maxPointsInView: normalizeOptionalMaxPointsInView(raw?.maxPointsInView, POINTS_SETTINGS_DEFAULTS.maxPointsInView),
      tileBuffer: toIntInRange(raw?.tileBuffer, POINTS_SETTINGS_DEFAULTS.tileBuffer, 0, 2),
      autoClusterThreshold: toIntInRange(raw?.autoClusterThreshold, POINTS_SETTINGS_DEFAULTS.autoClusterThreshold, 0, 22),
      disableClusteringAtZoom: toIntInRange(raw?.disableClusteringAtZoom, POINTS_SETTINGS_DEFAULTS.disableClusteringAtZoom, 0, 22),
      updateOnMove: Boolean(raw?.updateOnMove),
    };
  }

  function readPointsSettingsFromStorage() {
    try {
      const raw = window.localStorage.getItem(POINTS_SETTINGS_STORAGE_KEY);
      if (!raw) return { ...POINTS_SETTINGS_DEFAULTS };
      return normalizePointsSettings(JSON.parse(raw));
    } catch {
      return { ...POINTS_SETTINGS_DEFAULTS };
    }
  }

  let pointsSettings = readPointsSettingsFromStorage();
  let pointZoomForControls = 11;
  let controlsRenderKind = "points";
  let controlsIsCapExceeded = false;
  let workerClusterSource = null;
  let workerClusterFailed = false;
  let workerClusterPointSignature = "";
  let pointStatsOverride = null;

  function readPointModeFiltersFromStorage() {
    try {
      const raw = window.localStorage.getItem(POINT_MODE_FILTERS_LS_KEY);
      if (!raw) return { private: true, isorg: true };
      const parsed = JSON.parse(raw);
      return {
        private: Boolean(parsed?.private),
        isorg: Boolean(parsed?.isorg),
      };
    } catch {
      return { private: true, isorg: true };
    }
  }

  function persistPointModeFiltersToStorage() {
    try {
      const payload = {
        private: Boolean(pointsModePrivateInput.checked),
        isorg: Boolean(pointsModeIsorgInput.checked),
      };
      window.localStorage.setItem(POINT_MODE_FILTERS_LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  function applyPointModeFiltersFromStorage() {
    const saved = readPointModeFiltersFromStorage();
    applyPointModeFilters({
      privateChecked: saved.private,
      isorgChecked: saved.isorg,
    });
  }

  function persistPointsSettingsToStorage() {
    try {
      window.localStorage.setItem(POINTS_SETTINGS_STORAGE_KEY, JSON.stringify(pointsSettings));
    } catch {
      // ignore storage failures
    }
  }

  function updatePointsControlsVisibility() {
    const clusterStyleEnabled = pointsSettings.displayMode !== "points";
    const autoClusterThresholdEnabled = pointsSettings.displayMode === "auto";
    const disableClusteringAtZoomEnabled = pointsSettings.displayMode !== "points";
    const clusterEngineEnabled = pointsSettings.displayMode !== "points";
    const workerAvailable = isWorkerClusterAvailable();

    pointsClusterStyleRow.hidden = false;
    pointsClusterStyleRow.classList.toggle("is-disabled", !clusterStyleEnabled);
    for (const input of pointsClusterStyleRow.querySelectorAll("input")) {
      input.disabled = !clusterStyleEnabled;
    }

    pointsAutoClusterThresholdRow.classList.toggle("is-disabled", !autoClusterThresholdEnabled);
    pointsAutoClusterThresholdInput.disabled = !autoClusterThresholdEnabled;

    pointsDisableClusteringAtZoomRow.classList.toggle("is-disabled", !disableClusteringAtZoomEnabled);
    pointsDisableClusteringAtZoomInput.disabled = !disableClusteringAtZoomEnabled;

    pointsClusterEngineRow.hidden = false;
    pointsClusterEngineRow.classList.toggle("is-disabled", !clusterEngineEnabled);
    for (const input of pointsClusterEngineRow.querySelectorAll("input")) {
      input.disabled = !clusterEngineEnabled;
    }
    pointsClusterEngineWorker.disabled = !workerAvailable || !clusterEngineEnabled;
  }

  function applyPointsSettingsToUI() {
    pointsDisplayAuto.checked = pointsSettings.displayMode === "auto";
    pointsDisplayPoints.checked = pointsSettings.displayMode === "points";
    pointsDisplayClusters.checked = pointsSettings.displayMode === "clusters";
    pointsClusterEngineDefault.checked = pointsSettings.clusterEngine === "default";
    pointsClusterEngineWorker.checked = pointsSettings.clusterEngine === "worker";

    pointsClusterStyleBlended.checked = pointsSettings.clusterStyle === "blended";
    pointsClusterStyleMixed.checked = pointsSettings.clusterStyle === "split";

    pointsMaxPointsInput.value = pointsSettings.maxPointsInView == null
      ? ""
      : String(pointsSettings.maxPointsInView);

    pointsTileBuffer0.checked = pointsSettings.tileBuffer === 0;
    pointsTileBuffer1.checked = pointsSettings.tileBuffer === 1;
    pointsTileBuffer2.checked = pointsSettings.tileBuffer === 2;
    pointsAutoClusterThresholdInput.value = String(pointsSettings.autoClusterThreshold);
    pointsDisableClusteringAtZoomInput.value = String(pointsSettings.disableClusteringAtZoom);

    pointsUpdateOnMoveInput.checked = pointsSettings.updateOnMove;
    updatePointsControlsVisibility();
  }

  function applyPointModeFilters({ privateChecked, isorgChecked }) {
    pointsModePrivateInput.checked = Boolean(privateChecked);
    pointsModeIsorgInput.checked = Boolean(isorgChecked);
  }

  function resetPointsSettings() {
    const yearDefault = String(yearInput.defaultValue || "").trim();
    if (yearDefault) yearInput.value = yearDefault;
    else yearInput.value = String(Number(yearInput.value || 0) || 0);

    pc4Input.value = "";
    applyPointModeFilters({
      privateChecked: pointsModePrivateInput.defaultChecked,
      isorgChecked: pointsModeIsorgInput.defaultChecked,
    });

    pointsSettings = { ...POINTS_SETTINGS_DEFAULTS };
    applyPointsSettingsToUI();
    setPointsSidebarMessage("");

    removeStorageKeys([
      POINT_MODE_FILTERS_LS_KEY,
      POINTS_SETTINGS_STORAGE_KEY,
      POINTS_SIDEBAR_STORAGE_KEY,
    ]);

    if (pointsClusterLayer?.options) {
      pointsClusterLayer.options.disableClusteringAtZoom = pointsSettings.disableClusteringAtZoom;
    }

    if (mode === "points") schedulePointTileFetch({ immediate: true });
  }

  function readPointsSettingsFromUI() {
    const next = normalizePointsSettings({
      displayMode: pointsDisplayClusters.checked
        ? "clusters"
        : (pointsDisplayPoints.checked ? "points" : "auto"),
      clusterEngine: pointsClusterEngineWorker.checked ? "worker" : "default",
      clusterStyle: pointsClusterStyleMixed.checked ? "split" : "blended",
      maxPointsInView: pointsMaxPointsInput.value,
      tileBuffer: pointsTileBuffer2.checked ? 2 : (pointsTileBuffer0.checked ? 0 : 1),
      autoClusterThreshold: pointsAutoClusterThresholdInput.value,
      disableClusteringAtZoom: pointsDisableClusteringAtZoomInput.value,
      updateOnMove: pointsUpdateOnMoveInput.checked,
    });
    pointsSettings = next;
    applyPointsSettingsToUI();
    persistPointsSettingsToStorage();
  }

  function setPointsSidebarMessage(message = "") {
    const text = String(message || "").trim();
    pointsSidebarMessage.hidden = !text;
    pointsSidebarMessage.textContent = text;
  }

  applyPointModeFiltersFromStorage();
  applyPointsSettingsToUI();

  // Manual value is always persisted, even when Auto is on (so you can toggle back).
  let gridCellMManual = (() => {
    const v = Number(localStorage.getItem(GRID_CELL_M_LS_KEY));
    return Number.isFinite(v) && v > 0 ? v : GRID_CELL_M_DEFAULT;
  })();

  let gridCellAutoEnabled = readBoolLS(GRID_CELL_AUTO_LS_KEY, true);

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
        localStorage.setItem(GRID_CELL_M_LS_KEY, String(gridCellMManual));

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
      localStorage.setItem(GRID_CELL_M_LS_KEY, String(gridCellMManual));
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
        localStorage.setItem(GRID_CELL_AUTO_LS_KEY, gridCellAutoEnabled ? "1" : "0");
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
    // minZoom: 8,
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

  function clusterToneForCounts({ privateCount, isorgCount }) {
    if (isorgCount === 0) return "private";
    if (privateCount === 0) return "isorg";
    return pointsSettings.clusterStyle === "split" ? "mixed-indicator" : "mixed";
  }

  function createPointsClusterLayer() {
    if (typeof globalThis.L?.markerClusterGroup === "function") {
      return globalThis.L.markerClusterGroup({
        showCoverageOnHover: false,
        removeOutsideVisibleBounds: true,
        chunkedLoading: true,
        spiderfyOnMaxZoom: false,
        disableClusteringAtZoom: pointsSettings.disableClusteringAtZoom,
        iconCreateFunction: (cluster) => {
          const markers = cluster.getAllChildMarkers();
          let privateCount = 0;
          let isorgCount = 0;
          for (const marker of markers) {
            if (marker?.options?.tvtIsorg) isorgCount += 1;
            else privateCount += 1;
          }
          const total = privateCount + isorgCount;
          const tone = clusterToneForCounts({ privateCount, isorgCount });

          return globalThis.L.divIcon({
            className: `tvt-cluster tvt-cluster--${tone}`,
            html: `<div><span>${total}</span></div>`,
            iconSize: [42, 42],
          });
        },
      });
    }
    return globalThis.L.layerGroup();
  }

  const pointCanvasRenderer = typeof globalThis.L?.canvas === "function"
    ? globalThis.L.canvas({ padding: 0.25 })
    : null;
  const pointsClusterLayer = createPointsClusterLayer();
  const pointsWorkerClusterLayer = globalThis.L.layerGroup();
  const pointsCanvasLayer = globalThis.L.layerGroup();
  let pointRenderKind = "points"; // points | clusters
  let pointsLayer = pointsCanvasLayer;
  pointsLayer.addTo(map);

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

  // Min. inzendingen per vak.
  let minN = Number(minNSlider?.value || 3);
  minNValue.textContent = String(minN);
  const SPECIES_VIEW_DEFAULTS = {
    metric: metricSum.defaultChecked ? "sum" : (metricAvg.defaultChecked ? "avg" : "presence"),
    style: styleHeatmap.defaultChecked ? "heatmap" : (styleGrid.defaultChecked ? "grid" : "auto"),
    minN: Math.max(1, Number(minNSlider?.defaultValue || minNSlider?.value || 1)),
    gridCellMManual: snapGridCellM(Number(gridCellSlider?.defaultValue || GRID_CELL_M_DEFAULT)),
    gridCellAutoEnabled: gridCellAuto ? Boolean(gridCellAuto.defaultChecked) : true,
  };

  let sidebarOpen = true;
  let hudStats = { entries: 0, birds: 0 };
  let hudControl = null;
  let sidebarToggleControl = null;
  let sidebarTab = "species"; // "species" | "view"
  let isComputing = false;
  const pointTilesSource = new StaticTilesSource();
  let pointTileFetchSeq = 0;
  let pointTileFetchTimer = 0;
  let pointTileAbortController = null;
  let pointTileYear = 0;
  let latestPointEntryCount = 0;
  let isPointCapExceeded = false;
  const pointMarkerStateById = new Map();
  const pointEntryDetailsPromiseByKey = new Map();
  const pointEntryDetailsByKey = new Map();
  const pointEntryByKeyForCurrentRender = new Map();

  let legendPrivateTextEl = null;
  let legendIsorgTextEl = null;

  function isWorkerClusterAvailable() {
    return Boolean(workerClusterSource) && !workerClusterFailed;
  }

  function effectiveClusterEngine() {
    if (pointsSettings.clusterEngine !== "worker") return "default";
    return isWorkerClusterAvailable() ? "worker" : "default";
  }

  function resolveClusterLayer() {
    return effectiveClusterEngine() === "worker"
      ? pointsWorkerClusterLayer
      : pointsClusterLayer;
  }

  function clearWorkerClusterLayer() {
    if (typeof pointsWorkerClusterLayer.clearLayers === "function") {
      pointsWorkerClusterLayer.clearLayers();
    }
  }

  function fallbackFromWorkerCluster(err) {
    if (workerClusterFailed) return;
    workerClusterFailed = true;
    if (workerClusterSource) {
      workerClusterSource.destroy();
      workerClusterSource = null;
    }
    console.warn("Worker clustering failed; falling back to default clustering.", err);
    if (pointsSettings.clusterEngine === "worker") {
      pointsSettings.clusterEngine = "default";
      applyPointsSettingsToUI();
      persistPointsSettingsToStorage();
      setPointsSidebarMessage(WORKER_CLUSTER_FALLBACK_HINT);
    }
    updatePointsControlsVisibility();
    if (mode === "points" && pointRenderKind === "clusters") {
      setPointRenderKind("clusters", { force: true });
      schedulePointTileFetch({ immediate: true });
    }
  }

  if (typeof globalThis.Worker === "function") {
    try {
      workerClusterSource = new WorkerClusterSource();
      workerClusterSource.ensureReady().catch((err) => {
        fallbackFromWorkerCluster(err);
      });
    } catch (err) {
      fallbackFromWorkerCluster(err);
    }
  } else {
    workerClusterFailed = true;
    if (pointsSettings.clusterEngine === "worker") {
      pointsSettings.clusterEngine = "default";
      applyPointsSettingsToUI();
      persistPointsSettingsToStorage();
    }
  }

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
  const restoredSelectedSpecies = readSelectedSpeciesFromStorage();
  const shouldAutoSelectInitialSpecies = !restoredSelectedSpecies;
  let didAutoSelectInitialSpecies = false;
  setSelectedSpecies(restoredSelectedSpecies, { persist: false });

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

  function labelForEntry(entry) {
    return pointEntryIsorg(entry) ? "School" : "Particulier";
  }

  function updateViewportStats() {
    // During early startup (e.g. mode=species from URL), this can run before setView().
    // In that case Leaflet throws "Set map center and zoom first.".
    let b = null;
    try {
      b = map.getBounds();
    } catch {
      b = null;
    }

    if (mode === "points" && pointStatsOverride) {
      const inViewEntries = Number(pointStatsOverride.entries) || 0;
      const inViewPrivate = Number(pointStatsOverride.privateCount) || 0;
      const inViewIsorg = Number(pointStatsOverride.isorgCount) || 0;
      const inViewBirds = 0;

      hudStats = { entries: inViewEntries, birds: inViewBirds };
      const main = document.createElement("span");
      main.className = "stats-main";
      main.textContent = `${fmtInt(inViewEntries)} inzendingen in beeld`;

      const provisional = document.createElement("span");
      provisional.className = "stats-provisional";
      provisional.textContent = `(${fmtInt(totals.entries)} totaal) • ${fmtInt(inViewBirds)} vogels geteld (${fmtInt(totals.birds)} totaal)`;

      statsEl.replaceChildren(main, document.createTextNode(" "), provisional);
      if (legendPrivateTextEl) legendPrivateTextEl.textContent = `Particulier (${inViewPrivate})`;
      if (legendIsorgTextEl) legendIsorgTextEl.textContent = `School (${inViewIsorg})`;
      updateHud();
      return;
    }

    let inViewEntries = 0;
    let inViewBirds = 0;
    let inViewPrivate = 0;
    let inViewIsorg = 0;

    for (const r of rendered) {
      if (b && !b.contains(r.latlng)) continue;
      inViewEntries += 1;
      inViewBirds += r.birdsTotal;
      if (r.isPrivate) inViewPrivate += 1;
      if (r.isIsorg) inViewIsorg += 1;
    }

    hudStats = { entries: inViewEntries, birds: inViewBirds };
    const main = document.createElement("span");
    main.className = "stats-main";
    main.textContent = `${fmtInt(inViewEntries)} inzendingen in beeld`;

    const provisional = document.createElement("span");
    provisional.className = "stats-provisional";
    provisional.textContent = `(${fmtInt(totals.entries)} totaal) • ${fmtInt(inViewBirds)} vogels geteld (${fmtInt(totals.birds)} totaal)`;

    statsEl.replaceChildren(main, document.createTextNode(" "), provisional);

    if (legendPrivateTextEl) legendPrivateTextEl.textContent = `Particulier (${inViewPrivate})`;
    if (legendIsorgTextEl) legendIsorgTextEl.textContent = `School (${inViewIsorg})`;
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
        label: "Particulier (0)",
        color: "#fb923c",
        getTextEl: (el) => {
          legendPrivateTextEl = el;
        },
      })
    );
    div.appendChild(
      row({
        label: "School (0)",
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

  function setPointsLayerVisible(show) {
    if (show) {
      if (!map.hasLayer(pointsLayer)) pointsLayer.addTo(map);
      return;
    }
    if (map.hasLayer(pointsLayer)) map.removeLayer(pointsLayer);
  }

  function setPointRenderKind(nextKind, { force = false } = {}) {
    const resolved = nextKind === "clusters" ? "clusters" : "points";
    const nextLayer = resolved === "clusters" ? resolveClusterLayer() : pointsCanvasLayer;
    if (!force && resolved === pointRenderKind && pointsLayer === nextLayer) return;
    const previousLayer = pointsLayer;
    const wasVisible = map.hasLayer(previousLayer);
    if (wasVisible) map.removeLayer(previousLayer);
    if (typeof previousLayer.clearLayers === "function") previousLayer.clearLayers();
    pointRenderKind = resolved;
    controlsRenderKind = pointRenderKind;
    pointsLayer = nextLayer;
    pointMarkerStateById.clear();
    refreshRenderedPointStats();
    if (wasVisible && mode === "points") pointsLayer.addTo(map);
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
  let gridLegendTooltipEl = null;

  const gridLegend = globalThis.L.control({ position: "bottomright" });
  gridLegend.onAdd = () => {
    const div = globalThis.L.DomUtil.create("div", "pill tvt-legend tvt-grid-legend");

    const title = document.createElement("div");
    title.className = "tvt-grid-legend-title";
    div.appendChild(title);
    gridLegendTitleEl = title;

    const tooltipIcon = document.createElement("span");
    tooltipIcon.className = "help-icon tvt-grid-legend-tooltip-icon";
    tooltipIcon.textContent = "?";
    tooltipIcon.setAttribute("data-controller", "tooltip");
    tooltipIcon.setAttribute("data-tooltip-content-value", "");
    gridLegendTooltipEl = tooltipIcon;
    div.appendChild(tooltipIcon);

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
    const m = ["sum", "avg", "presence"].includes(metric) ? metric : "presence";
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

    // Centralized legend copy & formatting (keeps UI strings in one place).
    const LEGEND_COPY = {
      presence: {
        // label per stop (0..1)
        formatLabel: (s) => `${Math.round(s * 100)}%`,
        colorLine: "<b>Kleur:</b> hoger % aanwezig = donkerder",
      },
      avg: {
        formatLabel: (s, maxOk) => (maxOk ? fmtAvg(s * maxOk) : "0"),
        colorLine: "<b>Kleur:</b> hoger gemiddeld per inzending = donkerder",
        scaleLine: (maxOk) => (maxOk ? `<b>Schaal:</b> in beeld (max: ${fmtAvg(maxOk)})` : ""),
      },
      sum: {
        formatLabel: (s, maxOk) => (maxOk ? fmtInt(s * maxOk) : "0"),
        colorLine: "<b>Kleur:</b> meer geteld = donkerder",
        scaleLine: (maxOk) => (maxOk ? `<b>Schaal:</b> in beeld (max: ${fmtInt(maxOk)})` : ""),
      },
      transparencyLine: "<b>Transparantie:</b> meer inzendingen in vak = minder transparant",
    };

    const legend = LEGEND_COPY[m] || LEGEND_COPY.presence;
    legend.transparencyLine = LEGEND_COPY.transparencyLine;

    for (const s of stops) {
      const el = document.createElement("span");
      el.textContent = legend.formatLabel.length >= 2 ? legend.formatLabel(s, maxOk) : legend.formatLabel(s);
      gridLegendLabelsEl.appendChild(el);
    }

    // Tooltip (kort, menselijk)
    const tooltipText = [legend.scaleLine?.(maxOk), legend.colorLine, legend.transparencyLine].filter(Boolean).join(" • ");
    gridLegendTooltipEl.setAttribute("data-tooltip-content-value", tooltipText);

    // Min-N only when it actually filters something.
    gridLegendNoteEl.innerHTML = minN > 1 ? `Min. inzendingen per vak: ${minN}` : "";
  }

  function setMode(nextMode) {
    const prevMode = mode;
    mode = nextMode === "species" ? "species" : "points";
    syncModeToUrl(mode);

    modePointsBtn.setAttribute("aria-pressed", mode === "points" ? "true" : "false");
    modeSpeciesBtn.setAttribute("aria-pressed", mode === "species" ? "true" : "false");

    // Allow mode-based styling without touching JS again.
    document.body.dataset.mode = mode;

    if (mode === "species") {
      initSidebarOpenOnEnterSpeciesMode();
    } else {
      initSidebarOpenOnEnterPointsMode();
    }

    updateSidebarToggleControl();

    if (mode === "species") {
      clearPointTileFetchTimer();
      abortPointTileFetchCycle();
      if (prevMode === "points") clearPointMarkers();
      setPointsSidebarMessage("");
      setPointsLayerVisible(false);
      if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
      setLegendVisible(false);
      setGridLegendVisible(true);
    } else {
      if (map.hasLayer(gridLayer)) map.removeLayer(gridLayer);
      gridLayer.clearLayers();
      setPointsLayerVisible(true);
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

  function sidebarStorageKeyForMode(targetMode) {
    if (targetMode === "points") return POINTS_SIDEBAR_STORAGE_KEY;
    return `tvt:speciesSidebarOpen:${isMobile() ? "mobile" : "desktop"}`;
  }

  function getSavedSidebarOpen(targetMode) {
    try {
      const v = window.localStorage.getItem(sidebarStorageKeyForMode(targetMode));
      if (v == null) return null;
      return v === "1" || v === "true" || v === "open";
    } catch {
      return null;
    }
  }

  function saveSidebarOpenForMode(targetMode, open) {
    try {
      window.localStorage.setItem(sidebarStorageKeyForMode(targetMode), open ? "open" : "closed");
    } catch {
      // ignore
    }
  }

  function setSidebarOpen(open, { persist = true, reason = "" } = {}) {
    sidebarOpen = Boolean(open);
    if (mode === "species") {
      sidebarSpeciesEl.hidden = !sidebarOpen;
      sidebarPointsEl.hidden = true;
    } else if (mode === "points") {
      sidebarPointsEl.hidden = !sidebarOpen;
      sidebarSpeciesEl.hidden = true;
    } else {
      sidebarSpeciesEl.hidden = true;
      sidebarPointsEl.hidden = true;
    }
    updateSidebarToggleControl();

    if (mode === "species" && sidebarOpen) {
      if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
    }

    if (mode === "species" || mode === "points") {
      // Sidebar open/close changes map size.
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

    if (persist) saveSidebarOpenForMode(mode, sidebarOpen);
    updateHud();
    if (mode === "species" && !sidebarOpen) schedulePresenceGridCompute();
  }

  function initSidebarOpenOnEnterSpeciesMode() {
    const saved = getSavedSidebarOpen("species");
    if (saved == null) {
      // First time: open sidebar (friendly), except on mobile with species selected.
      if (isMobile() && selectedSpecies) setSidebarOpen(false, { persist: false, reason: "mobile-default-closed" });
      else setSidebarOpen(true, { persist: false, reason: "first-time-open" });
      return;
    }
    setSidebarOpen(saved, { persist: false, reason: "restore" });
  }

  function initSidebarOpenOnEnterPointsMode() {
    const saved = getSavedSidebarOpen("points");
    if (saved == null) {
      // Points sidebar starts collapsed by default on desktop and mobile.
      setSidebarOpen(false, { persist: false, reason: "points-default-collapsed" });
      return;
    }
    setSidebarOpen(saved, { persist: false, reason: "restore" });
  }

  sidebarSpeciesCloseBtn.addEventListener("click", () => {
    if (mode !== "species") return;
    setSidebarOpen(false, { persist: true, reason: "close" });
  });

  sidebarPointsCloseBtn.addEventListener("click", () => {
    if (mode !== "points") return;
    setSidebarOpen(false, { persist: true, reason: "close" });
  });

  function updateSidebarToggleControl() {
    if (mode !== "species" && mode !== "points") {
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
        btn.dataset.controller = "icon";
        btn.addEventListener("click", () => setSidebarOpen(!sidebarOpen, { persist: true, reason: "map-toggle" }));
        globalThis.L.DomEvent.disableClickPropagation(btn);
        globalThis.L.DomEvent.disableScrollPropagation(btn);
        return btn;
      };
      sidebarToggleControl.addTo(map);
    }

    const el = sidebarToggleControl.getContainer();
    if (el) {
      el.dataset.iconSrcValue = sidebarOpen ? "img/icons/sidebar-close.svg" : "img/icons/sidebar-open.svg";
      const sidebarName = mode === "species" ? "Soorten" : "Tellingen";
      el.ariaLabel = sidebarOpen ? `${sidebarName}-zijbalk sluiten` : `${sidebarName}-zijbalk openen`;
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
        const imageName = selectedSpecies?.name || "";

        const imgEl = document.createElement("div");
        imgEl.className = "tvt-hud-image";
        imgEl.innerHTML = birdImageHtml(imageName);
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
      refs.imgEl.innerHTML = birdImageHtml(selectedSpecies?.name || "");
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
    const { pc4, includePrivate, includeIsorg } = getFilters();
    return preparedEntries.filter((p) => {
      if (pc4 && p.pc4 !== pc4) return false;
      return (includePrivate && p.isPrivate) || (includeIsorg && p.isOrg);
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

    // If there is no stored selection, auto-select the first visible species once.
    if (
      shouldAutoSelectInitialSpecies &&
      !didAutoSelectInitialSpecies &&
      !selectedSpecies &&
      list.length > 0
    ) {
      setSelectedSpecies(list[0], { persist: false });
      didAutoSelectInitialSpecies = true;
    }

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

  function resetSpeciesViewSettings() {
    metricPresence.checked = SPECIES_VIEW_DEFAULTS.metric === "presence";
    metricAvg.checked = SPECIES_VIEW_DEFAULTS.metric === "avg";
    metricSum.checked = SPECIES_VIEW_DEFAULTS.metric === "sum";

    styleAuto.checked = SPECIES_VIEW_DEFAULTS.style === "auto";
    styleGrid.checked = SPECIES_VIEW_DEFAULTS.style === "grid";
    styleHeatmap.checked = SPECIES_VIEW_DEFAULTS.style === "heatmap";

    minNSlider.value = String(SPECIES_VIEW_DEFAULTS.minN);
    gridCellMManual = SPECIES_VIEW_DEFAULTS.gridCellMManual;
    gridCellAutoEnabled = SPECIES_VIEW_DEFAULTS.gridCellAutoEnabled;
    gridCellM = gridCellAutoEnabled ? autoGridCellMForZoom(map.getZoom()) : snapGridCellM(gridCellMManual);
    updateGridCellUI(gridCellM);

    removeStorageKeys([GRID_CELL_M_LS_KEY, GRID_CELL_AUTO_LS_KEY]);
    onSpeciesControlsChanged();
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
  speciesViewResetBtn.addEventListener("click", resetSpeciesViewSettings);

  function onPointsControlsChanged({ immediate = true } = {}) {
    const prevEngine = pointsSettings.clusterEngine;
    readPointsSettingsFromUI();
    const engineChanged = prevEngine !== pointsSettings.clusterEngine;
    if (pointsClusterLayer?.options) {
      pointsClusterLayer.options.disableClusteringAtZoom = pointsSettings.disableClusteringAtZoom;
    }
    if (engineChanged && pointRenderKind === "clusters") {
      setPointRenderKind("clusters", { force: true });
      workerClusterPointSignature = "";
    }
    updatePointsControlsVisibility();
    if (mode !== "points") return;
    schedulePointTileFetch({ immediate });
  }

  pointsDisplayAuto.addEventListener("change", () => onPointsControlsChanged());
  pointsDisplayPoints.addEventListener("change", () => onPointsControlsChanged());
  pointsDisplayClusters.addEventListener("change", () => onPointsControlsChanged());
  pointsClusterStyleBlended.addEventListener("change", () => onPointsControlsChanged());
  pointsClusterStyleMixed.addEventListener("change", () => onPointsControlsChanged());
  pointsClusterEngineDefault.addEventListener("change", () => onPointsControlsChanged());
  pointsClusterEngineWorker.addEventListener("change", () => onPointsControlsChanged());
  pointsMaxPointsInput.addEventListener("change", () => onPointsControlsChanged());
  pointsTileBuffer0.addEventListener("change", () => onPointsControlsChanged());
  pointsTileBuffer1.addEventListener("change", () => onPointsControlsChanged());
  pointsTileBuffer2.addEventListener("change", () => onPointsControlsChanged());
  pointsAutoClusterThresholdInput.addEventListener("change", () => onPointsControlsChanged());
  pointsDisableClusteringAtZoomInput.addEventListener("change", () => onPointsControlsChanged());
  pointsUpdateOnMoveInput.addEventListener("change", () => onPointsControlsChanged({ immediate: false }));
  pointsResetBtn.addEventListener("click", resetPointsSettings);

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

      let tooltip = `<b>${selectedSpecies.name}</b> — `;

      switch (metric) {
        case "presence":
          // aanwezig in 20/23 inzendingen (87%)
          // 	N_present=20, N_total=23
          const pct = formatNumber((total ? (withN / total) * 100 : 0), { maxDecimals: 1 });
          tooltip += `aanwezig in ${formatNumber(withN, { maxDecimals: 0 })}/${formatNumber(total, { maxDecimals: 0 })} inzendingen (${pct}%)`;
          break;
        case "avg":
          // gem. 2,8 per inzending · N=23 inzendingen
          // avg = sum / N
          const avgFmt = formatNumber((total ? sum / total : 0), { maxDecimals: 2 });
          tooltip += `gemiddeld ${avgFmt} per inzending in ${formatNumber(total, { maxDecimals: 0 })} inzendingen`;
          break;
        case "sum":
          // totaal 45 geteld in 23 inzendingen
          // sum = Σ aantal per inzending
          const sumFmt = formatNumber(sum, { maxDecimals: 0 });
          tooltip += `totaal ${sumFmt} geteld in ${formatNumber(total, { maxDecimals: 0 })} inzendingen`;
          break;
      }

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

  function popupHtml(entry, birdsOverride = null) {
    const birds = Array.isArray(birdsOverride)
      ? birdsOverride
      : (Array.isArray(entry?.birds) ? entry.birds : []);
    const total = sumBirds(birds);
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

  function popupLoadingHtml(entry) {
    return `
      <div class="tvt-popup">
        <h3>Inzending ${entry.id}</h3>
        <p class="meta">PC4 ${entry.pc4} • ${labelForEntry(entry)} • details laden…</p>
        <ol class="list"><li class="row"><span class="name">Laden…</span><span class="count"></span></li></ol>
      </div>
    `;
  }

  function popupErrorHtml(entry, message) {
    return `
      <div class="tvt-popup">
        <h3>Inzending ${entry.id}</h3>
        <p class="meta">PC4 ${entry.pc4} • ${labelForEntry(entry)}</p>
        <ol class="list"><li class="row"><span class="name">${escapeHtml(message || "Details laden mislukt.")}</span><span class="count"></span></li></ol>
      </div>
    `;
  }

  function pointDetailsKey({ year, id }) {
    return `${Number(year) || 0}:${Number(id) || 0}`;
  }

  function pointDetailsUrl({ id, year, limit = 9999 }) {
    const params = new URLSearchParams();
    if (Number(year) > 0) params.set("year", String(Number(year)));
    params.set("id", String(id));
    params.set("limit", String(limit));
    return `${ENTRY_TOP_BIRDS_API_BASE}/entry-top-birds?${params.toString()}`;
  }

  function normalizeBirdRows(json) {
    const data = Array.isArray(json?.data) ? json.data : [];
    return data
      .map((b) => ({
        name: String(b?.name ?? b?.vogelnaam ?? "").trim(),
        count: Number(b?.number ?? b?.count ?? 0) || 0,
      }))
      .filter((b) => b.name)
      .sort((a, b) => b.count - a.count);
  }

  async function getPointEntryDetails({ year, id }) {
    const key = pointDetailsKey({ year, id });
    if (pointEntryDetailsByKey.has(key)) return pointEntryDetailsByKey.get(key);
    if (pointEntryDetailsPromiseByKey.has(key)) return pointEntryDetailsPromiseByKey.get(key);

    const req = (async () => {
      const url = pointDetailsUrl({ year, id, limit: 9999 });
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const birds = normalizeBirdRows(json);
      pointEntryDetailsByKey.set(key, birds);
      return birds;
    })()
      .finally(() => {
        pointEntryDetailsPromiseByKey.delete(key);
      });

    pointEntryDetailsPromiseByKey.set(key, req);
    return req;
  }

  function bindPointMarkerPopup(marker, markerId) {
    marker.on("popupopen", async () => {
      const state = pointMarkerStateById.get(markerId);
      if (!state) return;

      const entry = state.entry;
      marker.setPopupContent(popupLoadingHtml(entry));

      try {
        const birds = await getPointEntryDetails({
          year: pointTileYear || Number(yearInput.value || 0) || 0,
          id: entry.id,
        });
        const latestState = pointMarkerStateById.get(markerId);
        if (!latestState || latestState.marker !== marker) return;
        latestState.entry = { ...latestState.entry, birds };
        marker.setPopupContent(popupHtml(latestState.entry, birds));
      } catch (err) {
        marker.setPopupContent(popupErrorHtml(entry, `Details laden mislukt (${err?.message || "onbekend"}).`));
      }
    });
  }

  function ensurePointPopupToggle(marker) {
    if (!marker || marker.__tvtPopupToggleBound) return;

    // Replace Leaflet's default click->open handler with explicit toggle behavior.
    if (typeof marker.off === "function") {
      marker.off("click");
    }

    marker.on("click", () => {
      if (typeof marker.isPopupOpen === "function" && marker.isPopupOpen()) {
        marker.closePopup();
        return;
      }
      marker.openPopup();
    });

    marker.__tvtPopupToggleBound = true;
  }

  function birdImageHtml(name) {
    const filename = guessImageFilename(name);
    const src = birdImageUrl(filename);
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
    const includePrivate = mode === "species" ? true : pointsModePrivateInput.checked;
    const includeIsorg = mode === "species" ? true : pointsModeIsorgInput.checked;
    const enabledPointModes = [];
    if (pointsModePrivateInput.checked) enabledPointModes.push("private");
    if (pointsModeIsorgInput.checked) enabledPointModes.push("isorg");
    return { year, pc4, includePrivate, includeIsorg, enabledPointModes };
  }

  function abortPointTileFetchCycle() {
    if (!pointTileAbortController) return;
    pointTileAbortController.abort();
    pointTileAbortController = null;
  }

  function clearPointTileFetchTimer() {
    if (!pointTileFetchTimer) return;
    window.clearTimeout(pointTileFetchTimer);
    pointTileFetchTimer = 0;
  }

  function clearPointMarkers() {
    if (typeof pointsCanvasLayer.clearLayers === "function") pointsCanvasLayer.clearLayers();
    if (typeof pointsClusterLayer.clearLayers === "function") pointsClusterLayer.clearLayers();
    clearWorkerClusterLayer();
    workerClusterPointSignature = "";
    pointMarkerStateById.clear();
    pointStatsOverride = null;
    pointEntryByKeyForCurrentRender.clear();
    refreshRenderedPointStats();
  }

  async function mapWithConcurrency(items, limit, worker) {
    const out = new Array(items.length);
    let cursor = 0;
    const workers = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));

    async function run() {
      while (true) {
        const i = cursor;
        cursor += 1;
        if (i >= items.length) return;
        out[i] = await worker(items[i], i);
      }
    }

    await Promise.all(Array.from({ length: workers }, () => run()));
    return out;
  }

  function pointEntryIsorg(entry) {
    if (typeof entry?.isorg === "boolean") return entry.isorg;
    return entryHasMode(entry, "isorg");
  }

  function pointMarkerIdKey(entry) {
    if (entry?.key != null) return String(entry.key);
    const id = Number(entry?.id);
    const safeId = Number.isFinite(id) ? String(id) : "unknown";
    return `${pointEntryIsorg(entry) ? "isorg" : "private"}:${safeId}`;
  }

  function pointMarkerIcon(isorg) {
    const pointMode = isorg ? "isorg" : "private";
    return globalThis.L.divIcon({
      className: "tvt-point-marker-wrap",
      html: `<span class="tvt-point-marker ${pointMode}"></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      popupAnchor: [0, -8],
    });
  }

  function pointMarkerPathStyle(isorg) {
    return {
      radius: 5,
      color: "rgba(255,255,255,0.92)",
      weight: 2,
      fillColor: isorg ? "#60a5fa" : "#fb923c",
      fillOpacity: 0.9,
      opacity: 1,
      renderer: pointCanvasRenderer || undefined,
    };
  }

  function setPointMarkerVisual(marker, isorg) {
    if (pointRenderKind === "clusters") {
      marker.setIcon(pointMarkerIcon(isorg));
      marker.setZIndexOffset(isorg ? 1000 : 0);
    } else if (typeof marker.setStyle === "function") {
      marker.setStyle(pointMarkerPathStyle(isorg));
    }
    marker.options.tvtIsorg = Boolean(isorg);
  }

  function createPointMarker(latlng, isorg) {
    if (pointRenderKind === "clusters") {
      return globalThis.L.marker(latlng, {
        icon: pointMarkerIcon(isorg),
        zIndexOffset: isorg ? 1000 : 0,
        tvtIsorg: isorg,
      });
    }
    return globalThis.L.circleMarker(latlng, {
      ...pointMarkerPathStyle(isorg),
      tvtIsorg: isorg,
    });
  }

  function resolveAutoPointRenderKind({ zoom }) {
    return zoom < pointsSettings.autoClusterThreshold ? "clusters" : "points";
  }

  function hasMaxPointsInViewCap() {
    return Number.isFinite(pointsSettings.maxPointsInView) && pointsSettings.maxPointsInView > 0;
  }

  function resolvePointRenderKind({ zoom, totalCount }) {
    const requested = pointsSettings.displayMode === "auto"
      ? resolveAutoPointRenderKind({ zoom })
      : pointsSettings.displayMode;
    if (pointsSettings.displayMode === "auto" && hasMaxPointsInViewCap() && totalCount > pointsSettings.maxPointsInView) {
      return "clusters";
    }
    return requested === "clusters" ? "clusters" : "points";
  }

  function maybeMessageForPointCap() {
    if (!isPointCapExceeded || !hasMaxPointsInViewCap()) return;
    setPointsSidebarMessage(
      `${POINT_CAP_HINT} (${fmtInt(Math.min(latestPointEntryCount, pointsSettings.maxPointsInView))} / ${fmtInt(latestPointEntryCount)})`
    );
  }

  function refreshRenderedPointStats() {
    pointStatsOverride = null;
    rendered = Array.from(pointMarkerStateById.values()).map((state) => ({
      latlng: state.latlng,
      birdsTotal: 0,
      isPrivate: !state.isIsorg,
      isIsorg: state.isIsorg,
      birdIds: new Set(),
      birdNames: new Set(),
      entry: state.entry,
    }));
    totals = { entries: rendered.length, birds: 0 };
    updateViewportStats();
    maybeMessageForPointCap();
  }

  function upsertPointMarkers(entries) {
    const nextById = new Map();
    for (const entry of entries) {
      const id = Number(entry?.id);
      const lat = Number(entry?.lat);
      const lng = Number(entry?.lng);
      if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      nextById.set(pointMarkerIdKey(entry), entry);
    }

    for (const [markerId, state] of pointMarkerStateById.entries()) {
      if (nextById.has(markerId)) continue;
      try {
        pointsLayer.removeLayer(state.marker);
      } catch {
        // ignore
      }
      pointMarkerStateById.delete(markerId);
    }

    for (const [markerId, entry] of nextById.entries()) {
      const id = Number(entry.id);
      const latlng = globalThis.L.latLng(Number(entry.lat), Number(entry.lng));
      const existing = pointMarkerStateById.get(markerId);
      const isorg = pointEntryIsorg(entry);
      const detailKey = pointDetailsKey({ year: pointTileYear || Number(yearInput.value || 0) || 0, id });
      const cachedBirds = pointEntryDetailsByKey.get(detailKey) || [];

      if (existing) {
        const moved =
          Math.abs(existing.latlng.lat - latlng.lat) > 1e-9 ||
          Math.abs(existing.latlng.lng - latlng.lng) > 1e-9;
        const modeChanged = existing.isIsorg !== isorg;
        if (moved || modeChanged) {
          existing.marker.setLatLng(latlng);
          setPointMarkerVisual(existing.marker, isorg);
        }
        existing.marker.setPopupContent(
          cachedBirds.length > 0 ? popupHtml(entry, cachedBirds) : popupLoadingHtml(entry)
        );
        ensurePointPopupToggle(existing.marker);
        existing.latlng = latlng;
        existing.entry = cachedBirds.length > 0 ? { ...entry, birds: cachedBirds } : entry;
        existing.isIsorg = isorg;
        continue;
      }

      const marker = createPointMarker(latlng, isorg)
        .bindPopup(
          cachedBirds.length > 0 ? popupHtml(entry, cachedBirds) : popupLoadingHtml(entry),
          {
            maxWidth: 340,
            closeOnClick: false,
            autoClose: true,
          }
        )
        .addTo(pointsLayer);
      bindPointMarkerPopup(marker, markerId);
      ensurePointPopupToggle(marker);

      pointMarkerStateById.set(markerId, {
        marker,
        latlng,
        entry: cachedBirds.length > 0 ? { ...entry, birds: cachedBirds } : entry,
        isIsorg: isorg,
      });
    }

    if (pointRenderKind === "clusters" && typeof pointsLayer.refreshClusters === "function") {
      pointsLayer.refreshClusters();
    }
  }

  function buildPointWorkerFeature(entry) {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(entry.lng), Number(entry.lat)],
      },
      properties: {
        id: Number(entry.id),
        isorg: Boolean(pointEntryIsorg(entry)),
      },
    };
  }

  function workerClusterMaxZoom() {
    const disableAt = Number(pointsSettings.disableClusteringAtZoom);
    if (!Number.isFinite(disableAt)) return 16;
    return Math.max(0, Math.min(22, Math.round(disableAt) - 1));
  }

  function buildWorkerClusterOptions() {
    return {
      radius: WORKER_CLUSTER_RADIUS,
      maxZoom: workerClusterMaxZoom(),
      minPoints: 2,
    };
  }

  function buildPointWorkerSignature(entries, options = null) {
    // Cheap rolling hash to avoid unnecessary worker index rebuilds.
    let hash = 2166136261;
    for (const entry of entries) {
      const id = Number(entry?.id) || 0;
      const isorg = pointEntryIsorg(entry) ? 1 : 0;
      hash ^= id & 0xff_ff_ff_ff;
      hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= isorg;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    const optRadius = Number(options?.radius) || 0;
    const optMaxZoom = Number(options?.maxZoom) || 0;
    const optMinPoints = Number(options?.minPoints) || 0;
    return `${pointTileYear}:${entries.length}:${hash >>> 0}:${optRadius}:${optMaxZoom}:${optMinPoints}`;
  }

  function pointClusterToneForWorkerFeature(clusterProps) {
    const total = Number(clusterProps?.point_count) || 0;
    const isorgCount = Number(clusterProps?.isorg_count) || 0;
    const privateCount = Number(clusterProps?.private_count) || 0;
    if (total > 0) {
      return clusterToneForCounts({
        privateCount: privateCount || Math.max(0, total - isorgCount),
        isorgCount: isorgCount || Math.max(0, total - privateCount),
      });
    }
    return "mixed";
  }

  async function onWorkerClusterClick({ clusterId, latlng }) {
    if (!isWorkerClusterAvailable() || !Number.isFinite(clusterId)) return;
    const currentZoom = map.getZoom();

    try {
      const expansion = await workerClusterSource.getClusterExpansionZoom(clusterId);
      if (Number.isFinite(expansion) && expansion > currentZoom) {
        map.flyTo(latlng, Math.min(expansion, map.getMaxZoom()));
        return;
      }
    } catch (err) {
      fallbackFromWorkerCluster(err);
      return;
    }

    try {
      const leaves = await workerClusterSource.getLeaves({ clusterId, limit: 200, offset: 0 });
      const points = leaves
        .map((feature) => {
          const coords = feature?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return globalThis.L.latLng(lat, lng);
        })
        .filter(Boolean);

      if (points.length > 1) {
        const bb = globalThis.L.latLngBounds(points);
        if (bb.isValid()) {
          map.fitBounds(bb, { padding: [30, 30], maxZoom: map.getMaxZoom() });
          return;
        }
      }
    } catch (err) {
      fallbackFromWorkerCluster(err);
      return;
    }

    map.flyTo(latlng, Math.min(map.getMaxZoom(), currentZoom + 1));
  }

  function renderWorkerClusterFeatures(features) {
    clearWorkerClusterLayer();
    pointMarkerStateById.clear();

    let inViewEntries = 0;
    let inViewPrivate = 0;
    let inViewIsorg = 0;

    for (const feature of features) {
      const coords = feature?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const latlng = globalThis.L.latLng(lat, lng);

      const props = feature?.properties || {};
      const isCluster = Boolean(props?.cluster);
      if (isCluster) {
        const total = Number(props?.point_count) || 0;
        const isorgCount = Number(props?.isorg_count) || 0;
        const privateCount = Number(props?.private_count) || 0;
        const tone = pointClusterToneForWorkerFeature(props);

        const clusterMarker = globalThis.L.marker(latlng, {
          icon: globalThis.L.divIcon({
            className: `tvt-cluster tvt-cluster--${tone}`,
            html: `<div><span>${total}</span></div>`,
            iconSize: [42, 42],
          }),
        });
        clusterMarker.on("click", () => {
          void onWorkerClusterClick({
            clusterId: Number(props?.cluster_id),
            latlng,
          });
        });
        clusterMarker.addTo(pointsWorkerClusterLayer);

        inViewEntries += total;
        inViewIsorg += isorgCount;
        inViewPrivate += privateCount;
        if (isorgCount + privateCount < total) {
          inViewPrivate += Math.max(0, total - (isorgCount + privateCount));
        }
        continue;
      }

      const id = Number(props?.id);
      const isorg = Boolean(props?.isorg);
      if (!Number.isFinite(id)) continue;

      const markerId = `${isorg ? "isorg" : "private"}:${id}`;
      const entry =
        pointEntryByKeyForCurrentRender.get(markerId) ||
        {
          id,
          key: markerId,
          lat,
          lng,
          pc4: "",
          isorg,
          modes: [isorg ? "isorg" : "private"],
          birds: [],
        };
      const detailKey = pointDetailsKey({ year: pointTileYear || Number(yearInput.value || 0) || 0, id });
      const cachedBirds = pointEntryDetailsByKey.get(detailKey) || [];

      const marker = createPointMarker(latlng, isorg)
        .bindPopup(
          cachedBirds.length > 0 ? popupHtml(entry, cachedBirds) : popupLoadingHtml(entry),
          {
            maxWidth: 340,
            closeOnClick: false,
            autoClose: true,
          }
        )
        .addTo(pointsWorkerClusterLayer);
      bindPointMarkerPopup(marker, markerId);
      ensurePointPopupToggle(marker);

      pointMarkerStateById.set(markerId, {
        marker,
        latlng,
        entry: cachedBirds.length > 0 ? { ...entry, birds: cachedBirds } : entry,
        isIsorg: isorg,
      });
      inViewEntries += 1;
      if (isorg) inViewIsorg += 1;
      else inViewPrivate += 1;
    }

    pointStatsOverride = {
      entries: inViewEntries,
      privateCount: inViewPrivate,
      isorgCount: inViewIsorg,
    };
    rendered = [];
    totals = { entries: latestPointEntryCount, birds: 0 };
    updateViewportStats();
    maybeMessageForPointCap();
  }

  function schedulePointTileFetch({ immediate = false } = {}) {
    if (mode !== "points") return;
    clearPointTileFetchTimer();
    if (immediate) {
      void refreshPointTilesForViewport();
      return;
    }
    pointTileFetchTimer = window.setTimeout(() => {
      pointTileFetchTimer = 0;
      void refreshPointTilesForViewport();
    }, 160);
  }

  async function refreshPointTilesForViewport() {
    if (mode !== "points") return;

    const seq = ++pointTileFetchSeq;
    abortPointTileFetchCycle();
    const controller = new AbortController();
    pointTileAbortController = controller;

    const { year, pc4, enabledPointModes } = getFilters();

    try {
      if (enabledPointModes.length === 0) {
        latestPointEntryCount = 0;
        isPointCapExceeded = false;
        controlsIsCapExceeded = false;
        updatePointsControlsVisibility();
        clearPointMarkers();
        setPointsSidebarMessage("Selecteer minimaal één filter.");
        statsEl.textContent = "Selecteer minimaal één filter.";
        return;
      }

      const manifest = await pointTilesSource.getManifest();
      if (seq !== pointTileFetchSeq || mode !== "points") return;

      const yearsAvailable = Array.isArray(manifest?.years_available)
        ? manifest.years_available.map((v) => Number(v)).filter((v) => Number.isFinite(v))
        : [];
      const defaultYear = Number(manifest?.defaults?.year ?? yearsAvailable[0] ?? 0) || 0;
      const targetYear = Number(year || 0) || defaultYear;

      if (!targetYear) {
        throw new Error("No tile year available");
      }
      if (yearsAvailable.length > 0 && !yearsAvailable.includes(targetYear)) {
        latestPointEntryCount = 0;
        isPointCapExceeded = false;
        controlsIsCapExceeded = false;
        updatePointsControlsVisibility();
        clearPointMarkers();
        setPointsSidebarMessage("");
        statsEl.textContent = `Geen puntendataset beschikbaar voor ${targetYear}.`;
        return;
      }

      pointTileYear = targetYear;

      const zoomMin = Number(manifest?.defaults?.zoom_min ?? 6) || 6;
      const zoomMax = Number(manifest?.defaults?.zoom_max ?? 13) || 13;
      const z = Math.max(zoomMin, Math.min(zoomMax, Math.floor(map.getZoom())));
      const tiles = tilesForBounds(map.getBounds(), z, pointsSettings.tileBuffer);

      if (tiles.length === 0) {
        latestPointEntryCount = 0;
        isPointCapExceeded = false;
        controlsIsCapExceeded = false;
        updatePointsControlsVisibility();
        setPointsSidebarMessage("");
        clearPointMarkers();
        return;
      }

      const modesAvailable = new Set(
        (Array.isArray(manifest?.modes_available) ? manifest.modes_available : [])
          .map((m) => String(m || "").trim())
          .filter(Boolean)
      );

      const fetchModes = enabledPointModes.filter((pointMode) => (
        modesAvailable.size === 0 || modesAvailable.has(pointMode)
      ));

      if (fetchModes.length === 0) {
        latestPointEntryCount = 0;
        isPointCapExceeded = false;
        controlsIsCapExceeded = false;
        updatePointsControlsVisibility();
        clearPointMarkers();
        setPointsSidebarMessage("Geen puntendataset beschikbaar voor de geselecteerde filters.");
        statsEl.textContent = "Geen puntendataset beschikbaar voor de geselecteerde filters.";
        return;
      }

      const requests = [];
      for (const pointMode of fetchModes) {
        for (const tile of tiles) {
          requests.push({ mode: pointMode, z: tile.z, x: tile.x, y: tile.y });
        }
      }

      const tileResults = await mapWithConcurrency(requests, 8, async (req) => {
        const json = await pointTilesSource.getPointTile({
          year: targetYear,
          mode: req.mode,
          z: req.z,
          x: req.x,
          y: req.y,
          signal: controller.signal,
        });
        return { mode: req.mode, json };
      });

      if (seq !== pointTileFetchSeq || mode !== "points") return;

      const nextEntriesById = new Map();

      for (const result of tileResults) {
        const tileJson = result?.json;
        const points = Array.isArray(tileJson?.points) ? tileJson.points : [];
        const isorg = result?.mode === "isorg";
        for (const p of points) {
          const id = Number(p?.id);
          const lat = Number(p?.lat);
          const lng = Number(p?.lng);
          if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const pc4Value = String(p?.pc4 ?? "");
          if (pc4 && pc4Value !== pc4) continue;

          const markerId = `${isorg ? "isorg" : "private"}:${id}`;
          if (nextEntriesById.has(markerId)) continue;

          nextEntriesById.set(markerId, {
            id,
            key: markerId,
            lat,
            lng,
            pc4: pc4Value,
            isorg,
            modes: [isorg ? "isorg" : "private"],
            birds: [],
          });
        }
      }

      latestPointEntryCount = nextEntriesById.size;
      isPointCapExceeded = hasMaxPointsInViewCap() && latestPointEntryCount > pointsSettings.maxPointsInView;
      controlsIsCapExceeded = isPointCapExceeded;
      pointZoomForControls = map.getZoom();
      updatePointsControlsVisibility();

      setPointRenderKind(resolvePointRenderKind({
        zoom: map.getZoom(),
        totalCount: latestPointEntryCount,
      }));

      let entriesForRender = Array.from(nextEntriesById.values());
      if (isPointCapExceeded && hasMaxPointsInViewCap()) {
        entriesForRender = entriesForRender.slice(0, pointsSettings.maxPointsInView);
        setPointsSidebarMessage(
          `${POINT_CAP_HINT} (${fmtInt(entriesForRender.length)} / ${fmtInt(latestPointEntryCount)})`
        );
      } else {
        if (!(workerClusterFailed && pointsSettings.clusterEngine === "worker")) {
          setPointsSidebarMessage("");
        }
      }

      pointEntryByKeyForCurrentRender.clear();
      for (const entry of entriesForRender) {
        pointEntryByKeyForCurrentRender.set(pointMarkerIdKey(entry), entry);
      }

      const wantsWorkerClusters =
        pointRenderKind === "clusters" &&
        pointsSettings.clusterEngine === "worker" &&
        isWorkerClusterAvailable();

      if (wantsWorkerClusters) {
        try {
          const features = entriesForRender.map((entry) => buildPointWorkerFeature(entry));
          const workerClusterOptions = buildWorkerClusterOptions();
          const signature = buildPointWorkerSignature(entriesForRender, workerClusterOptions);
          if (signature !== workerClusterPointSignature) {
            await workerClusterSource.setPoints(features, {
              signature,
              options: workerClusterOptions,
            });
            workerClusterPointSignature = signature;
          }
          if (seq !== pointTileFetchSeq || mode !== "points") return;

          const bounds = map.getBounds();
          const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
          const workerQueryZoom = Math.floor(map.getZoom());
          const clusters = await workerClusterSource.getClusters({
            bbox,
            zoom: workerQueryZoom,
          });
          if (seq !== pointTileFetchSeq || mode !== "points") return;
          renderWorkerClusterFeatures(clusters);
        } catch (workerErr) {
          fallbackFromWorkerCluster(workerErr);
          setPointRenderKind("clusters", { force: true });
          upsertPointMarkers(entriesForRender);
          refreshRenderedPointStats();
        }
      } else {
        upsertPointMarkers(entriesForRender);
        refreshRenderedPointStats();
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.warn("Viewport tile fetch failed:", err);
      statsEl.textContent = `Laden van puntentiles mislukt: ${err?.message || String(err)}`;
    } finally {
      if (pointTileAbortController === controller) pointTileAbortController = null;
    }
  }

  function render() {
    if (mode === "points") {
      schedulePointTileFetch({ immediate: true });
      return;
    }

    if (!dataset) return;

    const { year, pc4, includePrivate, includeIsorg } = getFilters();
    const dataYear = Number(dataset?.meta?.year ?? 0) || 0;

    if (year && dataYear && year !== dataYear) {
      gridLayer.clearLayers();
      statsEl.textContent = `Geen dataset voor ${year} (alleen ${dataYear} beschikbaar).`;
      return;
    }

    const filtered = preparedEntries.filter((p) => {
      if (pc4 && p.pc4 !== pc4) return false;
      return (includePrivate && p.isPrivate) || (includeIsorg && p.isOrg);
    });

    rendered = filtered.map((p) => ({
      latlng: p.latlng,
      birdsTotal: p.birdsTotal,
      isPrivate: p.isPrivate,
      isIsorg: p.isOrg,
      birdIds: p.birdIds,
      birdNames: p.birdNames,
      entry: p.entry,
    }));

    const bounds = filtered.map((p) => p.latlng);

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

    schedulePresenceGridCompute();
  }

  function onFiltersChanged() {
    // Normalize PC4 input "while typing" (only on change events).
    const pc4 = normalizePc4(pc4Input.value);
    if (pc4Input.value && pc4Input.value !== pc4) pc4Input.value = pc4;
    persistPointModeFiltersToStorage();
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
      if (mode === "species") {
        clearPointMarkers();
        gridLayer.clearLayers();
        statsEl.textContent = `Dataset laden mislukt: ${err?.message || String(err)}`;
      }
    }
  }

  async function probeStaticTilesSource() {
    try {
      const manifest = await pointTilesSource.getManifest();
      const defaultYear = Number(manifest?.defaults?.year ?? 0) || Number(manifest?.years_available?.[0] ?? 0);
      const year = defaultYear || (Number(yearInput.value || 0) || 0);
      const modesAvailable = new Set(
        (Array.isArray(manifest?.modes_available) ? manifest.modes_available : [])
          .map((m) => String(m || "").trim())
          .filter(Boolean)
      );
      const mode = modesAvailable.has("private")
        ? "private"
        : (modesAvailable.has("isorg")
          ? "isorg"
          : (String(manifest?.defaults?.mode || manifest?.modes_available?.[0] || "private").trim() || "private"));
      const z = Number(manifest?.defaults?.zoom_min ?? 9) || 9;

      // Probe one deterministic NL tile near the country's geographic center.
      const { x, y } = lngLatToTileXY({ lng: 5.2913, lat: 52.1326, z });
      const sampleTile = await pointTilesSource.getPointTile({ year, mode, z, x, y });

      globalThis.__tvtStaticTilesProbe = {
        manifest,
        sampleTile,
        request: { year, mode, z, x, y },
      };
    } catch (err) {
      console.warn("StaticTilesSource probe failed:", err);
    }
  }

  yearInput.addEventListener("change", () => {
    const year = Number(yearInput.value || 0) || 0;
    if (mode === "points") {
      render();
      return;
    }
    loadForYear(year);
  });
  pc4Input.addEventListener("change", onFiltersChanged);
  pointsModePrivateInput.addEventListener("change", onFiltersChanged);
  pointsModeIsorgInput.addEventListener("change", onFiltersChanged);

  // Initial view while loading.
  map.setView([53.22, 6.57], 11);
  pointZoomForControls = map.getZoom();
  updatePointsControlsVisibility();
  const onViewportSettled = () => {
    pointZoomForControls = map.getZoom();
    updatePointsControlsVisibility();
    if (mode === "points") {
      schedulePointTileFetch();
      updateViewportStats();
      return;
    }
    updateViewportStats();
    if (mode === "species") {
      if (speciesScope === "viewport") renderSpeciesList({ query: speciesSearchInput.value });
      schedulePresenceGridCompute();
    }
  };

  map.on("moveend", onViewportSettled);
  map.on("zoomend", onViewportSettled);
  map.on("move", () => {
    if (mode !== "points") return;
    if (!pointsSettings.updateOnMove) return;
    pointZoomForControls = map.getZoom();
    schedulePointTileFetch();
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
  window.addEventListener("beforeunload", () => {
    if (workerClusterSource) workerClusterSource.destroy();
  });

  // Initial load (defaults to the year input value).
  probeStaticTilesSource();
  loadForYear(Number(yearInput.value || 0) || 0);
}
