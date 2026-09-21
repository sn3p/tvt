export const POINTS_DISPLAY_AUTO = "auto";
export const POINTS_DISPLAY_POINTS = "points";
export const POINTS_DISPLAY_CLUSTERS = "clusters";
export const POINTS_DISPLAY_HEATMAP = "heatmap";

export const POINTS_DISPLAY_MODES = [
  POINTS_DISPLAY_AUTO,
  POINTS_DISPLAY_POINTS,
  POINTS_DISPLAY_CLUSTERS,
  POINTS_DISPLAY_HEATMAP,
];

/** leaflet.heat dims by 2^(maxZoom-zoom). Match the NL default so zoom 8 is visible. */
export const EFFORT_HEAT_INTENSITY_ZOOM = 8;

/** Classic simpleheat / leaflet.heat ramp (US-style glow). */
export const EFFORT_HEAT_GRADIENT = {
  0.4: "#0000ff",
  0.6: "#00ffff",
  0.7: "#00ff00",
  0.8: "#ffff00",
  1: "#ff0000",
};

export const EFFORT_HEAT_LEGEND = {
  title: "Tel-inspanning",
  note: "Waar is geteld (N tellingen), niet aantallen vogels.",
  tooltip:
    "Kleur volgt hoeveel tellingen op die plek liggen. Leeg = niet geteld. Dit is geen occupancy en geen vogelsom.",
  labels: ["weinig", "", "", "", "veel"],
  colors: [
    EFFORT_HEAT_GRADIENT[0.4],
    EFFORT_HEAT_GRADIENT[0.6],
    EFFORT_HEAT_GRADIENT[0.7],
    EFFORT_HEAT_GRADIENT[0.8],
    EFFORT_HEAT_GRADIENT[1],
  ],
};

export function parsePointsDisplayMode(raw, fallback = POINTS_DISPLAY_AUTO) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (POINTS_DISPLAY_MODES.includes(value)) return value;
  return POINTS_DISPLAY_MODES.includes(fallback)
    ? fallback
    : POINTS_DISPLAY_AUTO;
}

export function pointsDisplayModeFromRadios({
  heatmap = false,
  clusters = false,
  points = false,
} = {}) {
  if (heatmap) return POINTS_DISPLAY_HEATMAP;
  if (clusters) return POINTS_DISPLAY_CLUSTERS;
  if (points) return POINTS_DISPLAY_POINTS;
  return POINTS_DISPLAY_AUTO;
}

export function isHeatmapDisplayMode(displayMode) {
  return displayMode === POINTS_DISPLAY_HEATMAP;
}

export function clusterControlsEnabled(displayMode) {
  return (
    displayMode === POINTS_DISPLAY_AUTO ||
    displayMode === POINTS_DISPLAY_CLUSTERS
  );
}

export function shouldSlicePointsForCap(displayMode) {
  return displayMode === POINTS_DISPLAY_POINTS;
}

export function resolvePointsDisplayRenderKind({
  displayMode,
  totalCount = 0,
  maxPointsInView = null,
  forceClusters = false,
  preferCellDots = false,
} = {}) {
  const mode = parsePointsDisplayMode(displayMode);
  if (mode === POINTS_DISPLAY_HEATMAP) return POINTS_DISPLAY_HEATMAP;
  if (forceClusters) return POINTS_DISPLAY_CLUSTERS;
  if (preferCellDots) return POINTS_DISPLAY_POINTS;
  const capped =
    Number.isFinite(maxPointsInView) && maxPointsInView > 0;
  if (
    mode === POINTS_DISPLAY_AUTO &&
    capped &&
    Number(totalCount) > maxPointsInView
  ) {
    return POINTS_DISPLAY_CLUSTERS;
  }
  return mode === POINTS_DISPLAY_CLUSTERS
    ? POINTS_DISPLAY_CLUSTERS
    : POINTS_DISPLAY_POINTS;
}

export function effortIntensityForEntry(entry) {
  const n = Number(entry?.count);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  if (entry?.kind === "cell") return 0;
  return 1;
}

export function effortHeatLatLngs(entries) {
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const lat = Number(entry?.lat);
    const lng = Number(entry?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const intensity = effortIntensityForEntry(entry);
    if (!(intensity > 0)) continue;
    out.push([lat, lng, intensity]);
  }
  return out;
}

export function effortHeatMax(intensities) {
  const values = (Array.isArray(intensities) ? intensities : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!values.length) return 1;
  const idx = Math.floor((values.length - 1) * 0.9);
  return Math.max(1, values[idx]);
}

export function effortHeatRadiusForZoom(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z)) return 28;
  if (z <= 7) return 32;
  if (z <= 8) return 28;
  if (z <= 10) return 24;
  if (z <= 12) return 20;
  return 16;
}

export function effortHeatBlurForZoom(zoom) {
  return Math.max(12, Math.round(effortHeatRadiusForZoom(zoom) * 0.7));
}

export function effortHeatLayerOptions(zoom, { max = 1 } = {}) {
  const maxValue = Number(max);
  return {
    radius: effortHeatRadiusForZoom(zoom),
    blur: effortHeatBlurForZoom(zoom),
    max: Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1,
    maxZoom: EFFORT_HEAT_INTENSITY_ZOOM,
    minOpacity: 0.35,
    gradient: EFFORT_HEAT_GRADIENT,
  };
}

export function canCreateEffortHeatLayer(L) {
  return typeof L?.heatLayer === "function";
}

export function createEffortHeatLayer(L, zoom = EFFORT_HEAT_INTENSITY_ZOOM) {
  if (!canCreateEffortHeatLayer(L)) return null;
  return L.heatLayer([], effortHeatLayerOptions(zoom));
}

export function effortHeatLayerHasMap(layer) {
  return Boolean(layer && layer._map);
}

/**
 * leaflet.heat@0.2.0 redraw() reads `this._map._animating` with no null check.
 * Never call setLatLngs/setOptions after the layer is removed from the map.
 */
export function setEffortHeatLatLngs(layer, latlngs) {
  const next = Array.isArray(latlngs) ? latlngs : [];
  if (!layer) return layer;
  if (typeof layer.setLatLngs === "function" && effortHeatLayerHasMap(layer)) {
    return layer.setLatLngs(next);
  }
  layer._latlngs = next;
  return layer;
}

export function setEffortHeatOptions(layer, options) {
  if (!layer) return layer;
  if (typeof layer.setOptions === "function" && effortHeatLayerHasMap(layer)) {
    return layer.setOptions(options);
  }
  if (options && typeof options === "object") {
    layer.options = { ...(layer.options || {}), ...options };
  }
  return layer;
}
