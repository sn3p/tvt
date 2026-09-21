import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effortHeatRadiusForZoom } from "./effort_heatmap.mjs";
import {
  colorForLiftCell,
  occupancyLift,
} from "./species_lift.mjs";
import { occupancySequentialColor } from "./species_sequential.mjs";
import {
  SPECIES_HEAT_LAYER_CLASS,
  canCreateSpeciesHeatLayer,
  colorWithAlpha,
  createSpeciesHeatLayer,
  detachSpeciesHeatLayer,
  occupancyHeatIntensity,
  occupancyHeatKernel,
  parseCssRgb,
  speciesCellCenterLatLng,
  speciesHeatCompositeForViz,
  speciesHeatKernelsFromCells,
  speciesHeatRadiusForZoom,
} from "./species_heatmap.mjs";

const unproject = (x, y) => ({ lat: y / 1000, lng: x / 1000 });

describe("occupancy-masked species heat", () => {
  it("skips cells with no tellingen even when bird totals are huge", () => {
    const empty = {
      entry_count: 0,
      with_count: 0,
      sum_count: 999,
      value: 1,
      lat: 52.1,
      lng: 5.1,
    };
    assert.equal(occupancyHeatIntensity(empty, { metric: "presence" }), 0);
    assert.equal(
      occupancyHeatIntensity(empty, { metric: "sum", maxMetric: 999 }),
      0,
    );
    assert.equal(occupancyHeatKernel(empty, { metric: "presence" }), null);
    assert.deepEqual(
      speciesHeatKernelsFromCells([empty], { viz: "absoluut" }),
      [],
    );
    assert.deepEqual(
      speciesHeatKernelsFromCells([empty], { viz: "relatief", baseline: 0.2 }),
      [],
    );
  });

  it("uses occupancy for Absoluut presence, not sum_count or value stretch", () => {
    const cell = {
      entry_count: 10,
      with_count: 2,
      sum_count: 400,
      value: 0.9,
      lat: 52.2,
      lng: 6.1,
    };
    assert.equal(occupancyHeatIntensity(cell, { metric: "presence" }), 0.2);
    const kernel = occupancyHeatKernel(cell, { metric: "presence" });
    assert.equal(kernel.color, occupancySequentialColor(0.2));
    assert.notEqual(kernel.color, occupancySequentialColor(0.9));
    assert.equal(kernel.color, occupancySequentialColor(0.2));
    assert.ok(!("sum_count" in kernel));
    assert.ok(!("intensity" in kernel) || kernel.intensity !== 400);
    assert.notEqual(
      kernel.color,
      colorForLiftCell({ occupancy: 0.2, lift: occupancyLift(0.2, 0.1) }),
    );
  });

  it("keeps Relatief lift colours and paints sampled absences", () => {
    const present = {
      entry_count: 8,
      with_count: 8,
      sum_count: 80,
      lat: 52.3,
      lng: 6.2,
    };
    const absent = {
      entry_count: 5,
      with_count: 0,
      sum_count: 0,
      lat: 52.4,
      lng: 6.3,
    };
    const kernels = speciesHeatKernelsFromCells([present, absent], {
      viz: "relatief",
      baseline: 0.5,
    });
    assert.equal(kernels.length, 2);
    assert.equal(
      kernels[0].color,
      colorForLiftCell({ occupancy: 0, lift: 0 }),
    );
    assert.equal(
      kernels[1].color,
      colorForLiftCell({
        occupancy: 1,
        lift: occupancyLift(1, 0.5),
      }),
    );
    assert.equal(speciesHeatCompositeForViz("relatief"), "source-over");
    assert.equal(speciesHeatCompositeForViz("absoluut"), "lighter");
  });

  it("does not turn Relatief into sequential occupancy density", () => {
    const cell = {
      entry_count: 10,
      with_count: 8,
      sum_count: 40,
      lat: 51.9,
      lng: 4.5,
    };
    const [kernel] = speciesHeatKernelsFromCells([cell], {
      viz: "relatief",
      baseline: 0.2,
    });
    assert.equal(
      kernel.color,
      colorForLiftCell({ occupancy: 0.8, lift: occupancyLift(0.8, 0.2) }),
    );
    assert.notEqual(kernel.color, occupancySequentialColor(0.8));
  });
});

describe("species heat geometry and glow", () => {
  it("projects cell centres from ix/iy meters", () => {
    assert.deepEqual(
      speciesCellCenterLatLng(
        { ix: 2, iy: 4 },
        { cellSizeM: 1000, unproject },
      ),
      { lat: 4.5, lng: 2.5 },
    );
  });

  it("uses a glow radius in the same family as Tellingen heat", () => {
    assert.ok(speciesHeatRadiusForZoom(8) > effortHeatRadiusForZoom(8));
    assert.ok(speciesHeatRadiusForZoom(8) >= 28);
  });

  it("converts rgb fills to rgba for the kernel gradient", () => {
    assert.deepEqual(parseCssRgb("rgb(15,118,110)"), { r: 15, g: 118, b: 110 });
    assert.equal(colorWithAlpha("rgb(15,118,110)", 0.5), "rgba(15,118,110,0.5)");
    assert.equal(colorWithAlpha("rgb(15,118,110)", 0), "rgba(15,118,110,0)");
  });
});

describe("species heat layer detach", () => {
  it("needs a Leaflet Layer canvas, not leaflet.heat", () => {
    assert.equal(canCreateSpeciesHeatLayer({}), false);
    assert.equal(
      canCreateSpeciesHeatLayer({
        Layer: { extend() {} },
        DomUtil: { create() {} },
      }),
      true,
    );
    assert.equal(
      createSpeciesHeatLayer({ heatLayer() { return {}; } }),
      null,
    );
  });

  it("does not redraw after the layer leaves the map", () => {
    const L = {
      setOptions(obj, options) {
        obj.options = options || {};
      },
      DomUtil: {
        create(_tag, className) {
          return {
            className,
            style: {},
            width: 0,
            height: 0,
            parentNode: { removeChild() {} },
            getContext: () => ({
              clearRect() {},
              save() {},
              restore() {},
              beginPath() {},
              arc() {},
              fill() {},
              createRadialGradient: () => ({ addColorStop() {} }),
            }),
          };
        },
        setPosition() {},
      },
      Layer: {
        extend(proto) {
          function Ctor(options) {
            proto.initialize.call(this, options);
          }
          Object.assign(Ctor.prototype, proto);
          return Ctor;
        },
      },
    };
    const layer = createSpeciesHeatLayer(L);
    const map = {
      createPane: () => ({ style: {}, appendChild() {} }),
      getPane: () => null,
      on() {},
      off() {},
      getSize: () => ({ x: 8, y: 8 }),
      containerPointToLayerPoint: () => ({ x: 0, y: 0 }),
      latLngToContainerPoint: () => ({ x: 1, y: 1 }),
      getZoom: () => 8,
      hasLayer: () => true,
      removeLayer(next) {
        next.onRemove(map);
      },
    };
    layer.onAdd(map);
    assert.match(String(layer._canvas.className), new RegExp(SPECIES_HEAT_LAYER_CLASS));
    let redraws = 0;
    const originalRedraw = layer._redraw.bind(layer);
    layer._redraw = function redrawSpy() {
      redraws += 1;
      if (!this._map) {
        throw new TypeError("Cannot read properties of null (reading 'getSize')");
      }
      return originalRedraw();
    };
    layer.setKernels([
      { lat: 52, lng: 5, color: "rgb(227,26,28)", alpha: 0.7 },
    ]);
    assert.ok(redraws >= 1);
    redraws = 0;
    detachSpeciesHeatLayer(layer, map, L);
    assert.equal(layer._map, null);
    assert.deepEqual(layer._kernels, []);
    assert.equal(redraws, 0);
    assert.doesNotThrow(() =>
      layer.setKernels([{ lat: 52, lng: 5, color: "rgb(1,2,3)", alpha: 1 }]),
    );
    assert.equal(redraws, 0);
  });
});
