import {
  cancelEffortHeatRedraw,
  effortHeatBlurForZoom,
  effortHeatRadiusForZoom,
} from "./effort_heatmap.mjs";
import {
  SPECIES_VIZ_RELATIEF,
  cellOccupancy,
  colorForLiftCell,
  occupancyLift,
  parseSpeciesViz,
} from "./species_lift.mjs";
import {
  applyHighEndGamma,
  colorFromSequentialRamp,
  occupancySequentialColor,
} from "./species_sequential.mjs";

export const SPECIES_HEAT_PANE = "speciesHeat";
export const SPECIES_HEAT_LAYER_CLASS = "tvt-species-heat-layer";

export function parseCssRgb(color) {
  const match = String(color || "").match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  );
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

export function colorWithAlpha(color, alpha) {
  const parsed = parseCssRgb(color);
  const a = Math.max(0, Math.min(1, Number(alpha)));
  const opacity = Number.isFinite(a) ? a : 0;
  if (!parsed) return `rgba(0,0,0,${opacity})`;
  return `rgba(${parsed.r},${parsed.g},${parsed.b},${opacity})`;
}

export function speciesHeatCompositeForViz(viz) {
  return parseSpeciesViz(viz) === SPECIES_VIZ_RELATIEF
    ? "source-over"
    : "lighter";
}

export function speciesHeatRadiusForZoom(zoom) {
  return (
    effortHeatRadiusForZoom(zoom) +
    Math.round(effortHeatBlurForZoom(zoom) * 0.35)
  );
}

export function speciesCellCenterLatLng(cell, { cellSizeM, unproject } = {}) {
  const lat = Number(cell?.lat);
  const lng = Number(cell?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const ix = Number(cell?.ix);
  const iy = Number(cell?.iy);
  const size = Number(cellSizeM);
  if (
    !Number.isFinite(ix) ||
    !Number.isFinite(iy) ||
    !(size > 0) ||
    typeof unproject !== "function"
  ) {
    return null;
  }
  const point = unproject(ix * size + size / 2, iy * size + size / 2);
  if (!point) return null;
  const plat = Number(point.lat ?? point.y);
  const plng = Number(point.lng ?? point.x);
  if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
  return { lat: plat, lng: plng };
}

/** Occupancy or sequential metric, never bird totals. Empty land stays empty. */
export function occupancyHeatIntensity(
  cell,
  { metric = "presence", maxMetric = 0 } = {},
) {
  const total = Number(cell?.entry_count ?? 0) || 0;
  if (total <= 0) return 0;
  if (metric === "presence") {
    const occupancy = cellOccupancy(cell);
    return occupancy != null && occupancy > 0 ? occupancy : 0;
  }
  const value = Number(cell?.value ?? 0) || 0;
  if (!(value > 0)) return 0;
  const max = Number(maxMetric);
  if (!(max > 0)) return 0;
  return Math.min(1, value / max);
}

export function occupancyHeatKernel(
  cell,
  { metric = "presence", maxMetric = 0, cellSizeM, unproject } = {},
) {
  const intensity = occupancyHeatIntensity(cell, { metric, maxMetric });
  if (!(intensity > 0)) return null;
  const center = speciesCellCenterLatLng(cell, { cellSizeM, unproject });
  if (!center) return null;
  const color =
    metric === "presence"
      ? occupancySequentialColor(intensity)
      : colorFromSequentialRamp(applyHighEndGamma(intensity));
  return {
    lat: center.lat,
    lng: center.lng,
    color,
    alpha: Math.min(0.85, 0.28 + 0.55 * intensity),
    z: intensity,
  };
}

export function liftHeatKernel(
  cell,
  { baseline = 0, cellSizeM, unproject } = {},
) {
  const occupancy = cellOccupancy(cell);
  if (occupancy == null) return null;
  const lift = occupancyLift(occupancy, baseline);
  const color = colorForLiftCell({ occupancy, lift });
  if (!color) return null;
  const center = speciesCellCenterLatLng(cell, { cellSizeM, unproject });
  if (!center) return null;
  const isAbsent = occupancy <= 0;
  return {
    lat: center.lat,
    lng: center.lng,
    color,
    alpha: isAbsent ? 0.4 : 0.72,
    z: isAbsent ? -1 : Math.abs(Number(lift) || 0),
  };
}

export function speciesHeatKernelsFromCells(cells, options = {}) {
  const viz = parseSpeciesViz(options.viz);
  const kernels = [];
  for (const cell of Array.isArray(cells) ? cells : []) {
    const kernel =
      viz === SPECIES_VIZ_RELATIEF
        ? liftHeatKernel(cell, options)
        : occupancyHeatKernel(cell, options);
    if (kernel) kernels.push(kernel);
  }
  kernels.sort((a, b) => a.z - b.z);
  return kernels;
}

export function drawColoredKernel(ctx, x, y, radius, color, alpha) {
  if (!ctx || typeof ctx.createRadialGradient !== "function") return;
  const r = Number(radius);
  if (!(r > 0)) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, colorWithAlpha(color, alpha));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = gradient;
  if (typeof ctx.beginPath === "function" && typeof ctx.arc === "function") {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function canCreateSpeciesHeatLayer(L) {
  return (
    typeof L?.Layer?.extend === "function" &&
    typeof L?.DomUtil?.create === "function"
  );
}

function speciesHeatPane(map) {
  if (typeof map?.getPane === "function") {
    const existing = map.getPane(SPECIES_HEAT_PANE);
    if (existing) return existing;
  }
  if (typeof map?.createPane === "function") {
    const pane = map.createPane(SPECIES_HEAT_PANE);
    if (pane?.style) {
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    return pane;
  }
  return map?.getPanes?.()?.overlayPane || null;
}

export function resetSpeciesHeatKernels(layer, L) {
  cancelEffortHeatRedraw(layer, L);
  if (layer) layer._kernels = [];
  return layer;
}

export function detachSpeciesHeatLayer(layer, map, L) {
  if (!layer) return layer;
  resetSpeciesHeatKernels(layer, L);
  if (map && typeof map.hasLayer === "function" && map.hasLayer(layer)) {
    map.removeLayer(layer);
  } else if (layer._map && map && typeof map.removeLayer === "function") {
    map.removeLayer(layer);
  }
  return layer;
}

export function createSpeciesHeatLayer(L) {
  if (!canCreateSpeciesHeatLayer(L)) return null;
  const SpeciesHeat = L.Layer.extend({
    initialize(options) {
      if (typeof L.setOptions === "function") {
        L.setOptions(this, options || {});
      } else {
        this.options = options || {};
      }
      this._kernels = [];
      this._composite = "source-over";
    },
    onAdd(map) {
      this._map = map;
      this._canvas = L.DomUtil.create(
        "canvas",
        `leaflet-layer leaflet-zoom-hide leaflet-heatmap-layer ${SPECIES_HEAT_LAYER_CLASS}`,
      );
      this._canvas.style.pointerEvents = "none";
      const pane = speciesHeatPane(map);
      if (pane && typeof pane.appendChild === "function") {
        pane.appendChild(this._canvas);
      }
      if (typeof map.on === "function") {
        map.on("moveend zoomend viewreset", this._reset, this);
      }
      this._reset();
    },
    onRemove(map) {
      cancelEffortHeatRedraw(this, L);
      if (this._canvas?.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      if (map && typeof map.off === "function") {
        map.off("moveend zoomend viewreset", this._reset, this);
      }
      this._canvas = null;
      this._map = null;
    },
    setKernels(kernels, { composite } = {}) {
      this._kernels = Array.isArray(kernels) ? kernels : [];
      if (composite) this._composite = composite;
      if (this._map && this._canvas) this._redraw();
    },
    _reset() {
      if (!this._map || !this._canvas) return;
      if (typeof this._map.getSize !== "function") return;
      const topLeft =
        typeof this._map.containerPointToLayerPoint === "function"
          ? this._map.containerPointToLayerPoint([0, 0])
          : { x: 0, y: 0 };
      if (typeof L.DomUtil.setPosition === "function") {
        L.DomUtil.setPosition(this._canvas, topLeft);
      }
      const size = this._map.getSize();
      const width = Number(size?.x) || 0;
      const height = Number(size?.y) || 0;
      if (this._width !== width) {
        this._canvas.width = this._width = width;
      }
      if (this._height !== height) {
        this._canvas.height = this._height = height;
      }
      this._redraw();
    },
    _redraw() {
      if (!this._map || !this._canvas) return;
      const ctx =
        typeof this._canvas.getContext === "function"
          ? this._canvas.getContext("2d")
          : null;
      if (!ctx) return;
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      const radius = speciesHeatRadiusForZoom(
        typeof this._map.getZoom === "function" ? this._map.getZoom() : 8,
      );
      ctx.save();
      ctx.globalCompositeOperation = this._composite || "source-over";
      const toPoint =
        typeof this._map.latLngToContainerPoint === "function"
          ? this._map.latLngToContainerPoint.bind(this._map)
          : null;
      if (!toPoint) {
        ctx.restore();
        return;
      }
      for (const kernel of this._kernels) {
        const point = toPoint([kernel.lat, kernel.lng]);
        drawColoredKernel(
          ctx,
          Number(point?.x) || 0,
          Number(point?.y) || 0,
          radius,
          kernel.color,
          kernel.alpha,
        );
      }
      ctx.restore();
    },
  });
  return new SpeciesHeat();
}
