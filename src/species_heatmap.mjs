import {
  cancelEffortHeatRedraw,
  effortHeatBlurForZoom,
  effortHeatRadiusForZoom,
} from "./effort_heatmap.mjs";
import {
  LIFT_COLOR_ABSENT,
  SPECIES_VIZ_RELATIEF,
  cellOccupancy,
  colorForLiftCell,
  divergingTFromLift,
  occupancyLift,
  parseSpeciesViz,
  rgbFromDivergingT,
} from "./species_lift.mjs";
import {
  occupancySequentialColor,
  occupancySequentialRgb,
  rgbFromSequentialRamp,
  applyHighEndGamma,
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

export function metersPerPixelAtLat(lat, zoom) {
  const latRad =
    ((Number.isFinite(Number(lat)) ? Number(lat) : 52.1) * Math.PI) / 180;
  const z = Number(zoom);
  const zoomPow = Number.isFinite(z) ? z : 8;
  return (156543.03392 * Math.cos(latRad)) / 2 ** zoomPow;
}

export function speciesHeatRadiusPx(
  zoom,
  { lat = 52.1, cellSizeM = 0 } = {},
) {
  const glow =
    effortHeatRadiusForZoom(zoom) +
    Math.round(effortHeatBlurForZoom(zoom) * 0.35);
  const cellM = Number(cellSizeM);
  if (!(cellM > 0)) return glow;
  const cellPx = cellM / metersPerPixelAtLat(lat, zoom);
  if (!(cellPx > 0) || !Number.isFinite(cellPx)) return glow;
  const blend = Math.min(glow, cellPx * 2.2);
  return Math.max(8, Math.round(Math.max(cellPx * 0.75, blend)));
}

export function speciesHeatRadiusForZoom(zoom) {
  return speciesHeatRadiusPx(zoom);
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
      : colorFromSequentialRampString(intensity);
  return {
    lat: center.lat,
    lng: center.lng,
    color,
    alpha: Math.min(0.85, 0.28 + 0.55 * intensity),
    amount: intensity,
    isAbsent: false,
    z: intensity,
  };
}

function colorFromSequentialRampString(intensity) {
  const rgb = rgbFromSequentialRamp(applyHighEndGamma(intensity));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
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
    amount: isAbsent ? 0 : divergingTFromLift(lift),
    isAbsent,
    z: isAbsent ? -1 : 0,
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

export function stampSpeciesHeatKernel(
  present,
  value,
  absent,
  width,
  height,
  x,
  y,
  radius,
  amount,
  isAbsent,
) {
  const rad = Number(radius);
  if (!(rad > 0) || !present || !value || !absent) return;
  const sigma = rad / 2.5;
  const twoSigma2 = 2 * sigma * sigma;
  const rCeil = Math.ceil(rad);
  const r2 = rad * rad;
  const minX = Math.max(0, Math.floor(x - rCeil));
  const maxX = Math.min(width - 1, Math.ceil(x + rCeil));
  const minY = Math.max(0, Math.floor(y - rCeil));
  const maxY = Math.min(height - 1, Math.ceil(y + rCeil));
  for (let py = minY; py <= maxY; py++) {
    const dy = py - y;
    const dy2 = dy * dy;
    const row = py * width;
    for (let px = minX; px <= maxX; px++) {
      const dx = px - x;
      const d2 = dx * dx + dy2;
      if (d2 > r2) continue;
      const w = Math.exp(-d2 / twoSigma2);
      const i = row + px;
      if (isAbsent) {
        absent[i] += w;
      } else {
        present[i] += w;
        value[i] += amount * w;
      }
    }
  }
}

export function paintSpeciesHeatField(
  ctx,
  width,
  height,
  projected,
  { viz = "absoluut", radius = 16 } = {},
) {
  if (!ctx || !(width > 0) || !(height > 0)) return;
  if (typeof ctx.createImageData !== "function") return;
  const n = width * height;
  const present = new Float32Array(n);
  const value = new Float32Array(n);
  const absent = new Float32Array(n);
  const r = Number(radius) || 16;
  for (const point of Array.isArray(projected) ? projected : []) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < -r || y < -r || x > width + r || y > height + r) continue;
    stampSpeciesHeatKernel(
      present,
      value,
      absent,
      width,
      height,
      x,
      y,
      r,
      Number(point?.amount) || 0,
      Boolean(point?.isAbsent),
    );
  }
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const relatief = parseSpeciesViz(viz) === SPECIES_VIZ_RELATIEF;
  for (let i = 0; i < n; i++) {
    const p = present[i];
    const a = absent[i];
    const density = p + a;
    if (density < 0.06) continue;
    let rgb;
    if (relatief && a > p) {
      rgb = LIFT_COLOR_ABSENT;
    } else if (relatief) {
      rgb = rgbFromDivergingT(p > 0 ? value[i] / p : 0);
    } else if (p > 0) {
      rgb = occupancySequentialRgb(value[i] / p);
    } else {
      continue;
    }
    const alpha = Math.round(Math.min(210, 36 + density * 48));
    const o = i * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = alpha;
  }
  if (typeof ctx.putImageData === "function") ctx.putImageData(image, 0, 0);
}

export function canCreateSpeciesHeatLayer(L) {
  return (
    typeof L?.Layer?.extend === "function" &&
    typeof L?.DomUtil?.create === "function"
  );
}

function speciesHeatPane(map) {
  const overlay = map?.getPanes?.()?.overlayPane;
  if (overlay) return overlay;
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
  return null;
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
      this._viz = "absoluut";
      this._cellSizeM = 0;
    },
    onAdd(map) {
      this._map = map;
      this._canvas = L.DomUtil.create(
        "canvas",
        `leaflet-layer leaflet-zoom-animated leaflet-heatmap-layer ${SPECIES_HEAT_LAYER_CLASS}`,
      );
      this._canvas.style.pointerEvents = "none";
      const pane = speciesHeatPane(map);
      if (pane && typeof pane.appendChild === "function") {
        pane.appendChild(this._canvas);
      }
      if (typeof map.on === "function") {
        map.on("moveend resize viewreset", this._reset, this);
        if (map._zoomAnimated) {
          map.on("zoomanim", this._animateZoom, this);
        }
      }
      this._reset();
    },
    onRemove(map) {
      cancelEffortHeatRedraw(this, L);
      if (this._canvas?.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      if (map && typeof map.off === "function") {
        map.off("moveend resize viewreset", this._reset, this);
        map.off("zoomanim", this._animateZoom, this);
      }
      this._canvas = null;
      this._map = null;
      this._width = null;
      this._height = null;
    },
    setKernels(kernels, { viz, cellSizeM } = {}) {
      this._kernels = Array.isArray(kernels) ? kernels : [];
      if (viz) this._viz = parseSpeciesViz(viz);
      if (cellSizeM != null) this._cellSizeM = Number(cellSizeM) || 0;
      if (this._map && this._canvas) this._redraw();
    },
    _animateZoom(e) {
      if (!this._map || !this._canvas) return;
      if (typeof this._map.getZoomScale !== "function") return;
      if (typeof this._map._getCenterOffset !== "function") return;
      if (typeof L.DomUtil.setTransform !== "function") return;
      try {
        const scale = this._map.getZoomScale(e.zoom);
        const offset = this._map
          ._getCenterOffset(e.center)
          ._multiplyBy(-scale)
          .subtract(this._map._getMapPanePos());
        L.DomUtil.setTransform(this._canvas, offset, scale);
      } catch {
        // Ignore zoom-animation internals; _reset on zoomend redraws.
      }
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
      this._canvas.width = this._width = width;
      this._canvas.height = this._height = height;
      this._redraw();
    },
    _redraw() {
      if (!this._map || !this._canvas) return;
      const ctx =
        typeof this._canvas.getContext === "function"
          ? this._canvas.getContext("2d")
          : null;
      if (!ctx) return;
      const width = this._canvas.width || 0;
      const height = this._canvas.height || 0;
      if (!(width > 0) || !(height > 0)) return;
      if (typeof ctx.clearRect === "function") {
        ctx.clearRect(0, 0, width, height);
      }
      const zoom =
        typeof this._map.getZoom === "function" ? this._map.getZoom() : 8;
      const lat =
        typeof this._map.getCenter === "function"
          ? Number(this._map.getCenter()?.lat)
          : 52.1;
      const radius = speciesHeatRadiusPx(zoom, {
        lat,
        cellSizeM: this._cellSizeM,
      });
      const toPoint =
        typeof this._map.latLngToContainerPoint === "function"
          ? this._map.latLngToContainerPoint.bind(this._map)
          : null;
      if (!toPoint) return;
      const projected = [];
      for (const kernel of this._kernels) {
        const point = toPoint([kernel.lat, kernel.lng]);
        projected.push({
          x: Number(point?.x) || 0,
          y: Number(point?.y) || 0,
          amount: kernel.amount,
          isAbsent: kernel.isAbsent,
        });
      }
      paintSpeciesHeatField(ctx, width, height, projected, {
        viz: this._viz,
        radius,
      });
    },
  });
  return new SpeciesHeat();
}
