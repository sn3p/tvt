import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EFFORT_HEAT_GRADIENT,
  EFFORT_HEAT_INTENSITY_ZOOM,
  EFFORT_HEAT_LEGEND,
  POINTS_DISPLAY_AUTO,
  POINTS_DISPLAY_CLUSTERS,
  POINTS_DISPLAY_HEATMAP,
  POINTS_DISPLAY_POINTS,
  canCreateEffortHeatLayer,
  clusterControlsEnabled,
  createEffortHeatLayer,
  detachEffortHeatLayer,
  effortHeatLatLngs,
  effortHeatLayerHasMap,
  effortHeatLayerOptions,
  effortHeatMax,
  effortIntensityForEntry,
  isHeatmapDisplayMode,
  parsePointsDisplayMode,
  pointsDisplayModeFromRadios,
  resetEffortHeatData,
  resolvePointsDisplayRenderKind,
  setEffortHeatLatLngs,
  setEffortHeatOptions,
  shouldSlicePointsForCap,
} from "./effort_heatmap.mjs";

describe("Tellingen display mode", () => {
  it("accepts heatmap and defaults unknown values to auto", () => {
    assert.equal(parsePointsDisplayMode("heatmap"), POINTS_DISPLAY_HEATMAP);
    assert.equal(parsePointsDisplayMode("AUTO"), POINTS_DISPLAY_AUTO);
    assert.equal(parsePointsDisplayMode("nope"), POINTS_DISPLAY_AUTO);
    assert.equal(parsePointsDisplayMode("nope", "clusters"), POINTS_DISPLAY_CLUSTERS);
  });

  it("reads heatmap from radios before falling through to auto", () => {
    assert.equal(
      pointsDisplayModeFromRadios({ heatmap: true }),
      POINTS_DISPLAY_HEATMAP,
    );
    assert.equal(
      pointsDisplayModeFromRadios({ clusters: true }),
      POINTS_DISPLAY_CLUSTERS,
    );
    assert.equal(
      pointsDisplayModeFromRadios({ points: true }),
      POINTS_DISPLAY_POINTS,
    );
    assert.equal(pointsDisplayModeFromRadios({}), POINTS_DISPLAY_AUTO);
  });

  it("never lets Automatisch pick heatmap", () => {
    assert.equal(
      resolvePointsDisplayRenderKind({
        displayMode: "auto",
        totalCount: 9e6,
        maxPointsInView: 1000,
      }),
      POINTS_DISPLAY_CLUSTERS,
    );
    assert.equal(
      resolvePointsDisplayRenderKind({
        displayMode: "auto",
        totalCount: 10,
        maxPointsInView: 1000,
      }),
      POINTS_DISPLAY_POINTS,
    );
    assert.notEqual(
      resolvePointsDisplayRenderKind({ displayMode: "auto" }),
      POINTS_DISPLAY_HEATMAP,
    );
  });

  it("keeps heatmap even when cell tiles would force clusters", () => {
    assert.equal(
      resolvePointsDisplayRenderKind({
        displayMode: "heatmap",
        forceClusters: true,
        preferCellDots: true,
        totalCount: 9e6,
        maxPointsInView: 1,
      }),
      POINTS_DISPLAY_HEATMAP,
    );
  });

  it("disables cluster chrome and point-cap slicing for heatmap", () => {
    assert.equal(clusterControlsEnabled("heatmap"), false);
    assert.equal(clusterControlsEnabled("points"), false);
    assert.equal(clusterControlsEnabled("auto"), true);
    assert.equal(clusterControlsEnabled("clusters"), true);
    assert.equal(shouldSlicePointsForCap("heatmap"), false);
    assert.equal(shouldSlicePointsForCap("points"), true);
    assert.equal(isHeatmapDisplayMode("heatmap"), true);
  });
});

describe("effort intensity", () => {
  it("uses N tellingen and ignores bird totals", () => {
    assert.equal(
      effortIntensityForEntry({
        kind: "point",
        count: 1,
        sum_count: 400,
        birds: [{ count: 400 }],
        bird_sum_count: 400,
      }),
      1,
    );
    assert.equal(
      effortIntensityForEntry({
        kind: "cell",
        count: 7,
        sum_count: 999,
      }),
      7,
    );
    const latlngs = effortHeatLatLngs([
      {
        lat: 52.1,
        lng: 5.1,
        kind: "point",
        count: 1,
        sum_count: 80,
        birds: [{ count: 80 }],
      },
      { lat: 52.2, lng: 5.2, kind: "cell", count: 4, sum_count: 200 },
      { lat: 52.3, lng: 5.3, kind: "cell", count: 0, sum_count: 50 },
      { lat: Number.NaN, lng: 5.4, count: 3 },
    ]);
    assert.deepEqual(latlngs, [
      [52.1, 5.1, 1],
      [52.2, 5.2, 4],
    ]);
  });

  it("does not stretch max to a single outlier or to bird sums", () => {
    assert.equal(effortHeatMax([1, 1, 1, 1, 1, 1, 1, 1, 1, 80]), 1);
    assert.equal(effortHeatMax([1, 2, 3, 400]), 3);
    assert.notEqual(effortHeatMax([1, 2, 3, 400]), 400);
  });
});

describe("effort heat options and legend", () => {
  it("keeps full intensity at NL zoom 8", () => {
    const options = effortHeatLayerOptions(8, { max: 4 });
    assert.equal(options.maxZoom, EFFORT_HEAT_INTENSITY_ZOOM);
    assert.equal(EFFORT_HEAT_INTENSITY_ZOOM, 8);
    assert.equal(options.max, 4);
    assert.equal(options.gradient, EFFORT_HEAT_GRADIENT);
    assert.ok(options.radius >= 24);
  });

  it("describes tel-inspanning, not occupancy or aantallen", () => {
    const blob = `${EFFORT_HEAT_LEGEND.title} ${EFFORT_HEAT_LEGEND.note} ${EFFORT_HEAT_LEGEND.tooltip}`;
    assert.match(blob, /tel-inspanning/i);
    assert.match(blob, /waar is geteld/i);
    assert.match(blob, /n tellingen/i);
    assert.match(blob, /niet aantallen vogels/i);
    assert.match(blob, /geen occupancy/i);
    assert.doesNotMatch(blob, /0–100%|vogelsom ontbreekt/i);
  });

  it("creates a heat layer only when leaflet.heat is present", () => {
    const created = [];
    const L = {
      heatLayer(latlngs, options) {
        created.push({ latlngs, options });
        return { latlngs, options };
      },
    };
    assert.equal(canCreateEffortHeatLayer({}), false);
    assert.equal(createEffortHeatLayer({}), null);
    const layer = createEffortHeatLayer(L, 8);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].latlngs, []);
    assert.equal(layer.options.maxZoom, 8);
  });

  it("does not call leaflet.heat redraw after the layer is removed", () => {
    const detachedCalls = [];
    const detached = {
      _map: null,
      _latlngs: [[52, 5, 1]],
      options: { max: 1 },
      setLatLngs(latlngs) {
        detachedCalls.push("setLatLngs");
        if (!this._map) throw new TypeError("Cannot read properties of null (reading '_animating')");
        this._latlngs = latlngs;
      },
      setOptions(options) {
        detachedCalls.push("setOptions");
        if (!this._map) throw new TypeError("Cannot read properties of null (reading '_animating')");
        this.options = options;
      },
    };
    assert.equal(effortHeatLayerHasMap(detached), false);
    assert.doesNotThrow(() => setEffortHeatLatLngs(detached, []));
    assert.doesNotThrow(() => setEffortHeatOptions(detached, { max: 4 }));
    assert.deepEqual(detachedCalls, []);
    assert.deepEqual(detached._latlngs, []);
    assert.equal(detached.options.max, 4);

    const attachedCalls = [];
    const map = { _animating: false };
    const attached = {
      _map: map,
      _latlngs: [],
      setLatLngs(latlngs) {
        attachedCalls.push("setLatLngs");
        this._latlngs = latlngs;
        return this;
      },
      setOptions(options) {
        attachedCalls.push("setOptions");
        this.options = options;
        return this;
      },
    };
    setEffortHeatOptions(attached, { radius: 16 });
    setEffortHeatLatLngs(attached, [[52.1, 5.1, 1]]);
    assert.deepEqual(attachedCalls, ["setOptions", "setLatLngs"]);
    assert.deepEqual(attached._latlngs, [[52.1, 5.1, 1]]);
  });

  it("cancels a pending _redraw before Heatmap is detached", () => {
    const cancelled = [];
    const L = {
      Util: {
        cancelAnimFrame(id) {
          cancelled.push(id);
        },
      },
    };
    const map = {
      hasLayer: () => true,
      removeLayer(layer) {
        layer._map = null;
      },
    };
    const layer = {
      _map: map,
      _frame: 77,
      _latlngs: [[52, 5, 1]],
      setLatLngs() {
        throw new TypeError("Cannot read properties of null (reading 'getSize')");
      },
    };
    assert.doesNotThrow(() => detachEffortHeatLayer(layer, map, L));
    assert.deepEqual(cancelled, [77]);
    assert.equal(layer._frame, null);
    assert.equal(layer._map, null);
    assert.deepEqual(layer._latlngs, []);
  });

  it("does not schedule leaflet.heat redraw when clearing attached heat data", () => {
    let setLatLngsCalls = 0;
    const layer = {
      _map: { getSize() { throw new TypeError("Cannot read properties of null (reading 'getSize')"); } },
      _frame: 3,
      _latlngs: [[52, 5, 1]],
      setLatLngs() {
        setLatLngsCalls += 1;
        this._frame = 4;
      },
    };
    const cancelled = [];
    resetEffortHeatData(layer, {
      Util: { cancelAnimFrame(id) { cancelled.push(id); } },
    });
    assert.deepEqual(cancelled, [3]);
    assert.equal(setLatLngsCalls, 0);
    assert.equal(layer._frame, null);
    assert.deepEqual(layer._latlngs, []);
  });

  it("cancels pending redraw from heat layer onRemove", () => {
    const cancelled = [];
    const originalRemoves = [];
    const L = {
      heatLayer() {
        return {
          onRemove(map) {
            originalRemoves.push(map);
          },
        };
      },
      Util: {
        cancelAnimFrame(id) {
          cancelled.push(id);
        },
      },
    };
    const layer = createEffortHeatLayer(L, 8);
    layer._frame = 9;
    layer.onRemove({ id: "map" });
    assert.deepEqual(cancelled, [9]);
    assert.equal(layer._frame, null);
    assert.deepEqual(originalRemoves, [{ id: "map" }]);
  });
});
