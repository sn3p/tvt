import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effortHeatRadiusForZoom } from "./effort_heatmap.mjs";
import {
  colorForLiftCell,
  divergingTFromLift,
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
  paintSpeciesHeatField,
  parseCssRgb,
  speciesCellCenterLatLng,
  speciesHeatKernelsFromCells,
  speciesHeatRadiusForZoom,
  speciesHeatRadiusPx,
  speciesHeatZoomAnimationEnabled,
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
    assert.equal(kernels[0].isAbsent, true);
    assert.equal(kernels[1].isAbsent, false);
    assert.equal(kernels[1].amount, divergingTFromLift(occupancyLift(1, 0.5)));
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

  it("grows with cell size when zoomed in so city view is not dots", () => {
    const country = speciesHeatRadiusPx(8, { cellSizeM: 2500, lat: 52.1 });
    const city = speciesHeatRadiusPx(15, { cellSizeM: 200, lat: 53.2 });
    assert.ok(city > country);
    assert.ok(city >= 40);
    assert.ok(country >= 8);
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
            width: 300,
            height: 150,
            parentNode: { removeChild() {} },
            getContext: () => ({
              clearRect() {},
              createImageData(w, h) {
                return {
                  data: new Uint8ClampedArray(w * h * 4),
                  width: w,
                  height: h,
                };
              },
              putImageData() {},
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
      getPanes: () => ({ overlayPane: { appendChild() {} } }),
      getPane: () => null,
      on() {},
      off() {},
      getSize: () => ({ x: 8, y: 8 }),
      getCenter: () => ({ lat: 52.1, lng: 5.2 }),
      containerPointToLayerPoint: () => ({ x: 0, y: 0 }),
      latLngToContainerPoint: () => ({ x: 1, y: 1 }),
      getZoom: () => 8,
      hasLayer: () => true,
      removeLayer(next) {
        next.onRemove(map);
      },
    };
    layer.onAdd(map);
    assert.equal(layer._canvas.width, 8);
    assert.equal(layer._canvas.height, 8);
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

  it("rewrites canvas bitmap size after detach so zoom is not a 300x150 tile", () => {
    const L = {
      setOptions(obj, options) {
        obj.options = options || {};
      },
      DomUtil: {
        create(_tag, className) {
          return {
            className,
            style: {},
            width: 300,
            height: 150,
            parentNode: { removeChild() {} },
            getContext: () => ({
              clearRect() {},
              createImageData(w, h) {
                return {
                  data: new Uint8ClampedArray(w * h * 4),
                  width: w,
                  height: h,
                };
              },
              putImageData() {},
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
      getPanes: () => ({ overlayPane: { appendChild() {} } }),
      on() {},
      off() {},
      getSize: () => ({ x: 12, y: 9 }),
      getCenter: () => ({ lat: 52.1, lng: 5.2 }),
      containerPointToLayerPoint: () => ({ x: 0, y: 0 }),
      latLngToContainerPoint: () => ({ x: 2, y: 2 }),
      getZoom: () => 10,
      hasLayer: () => true,
      removeLayer(next) {
        next.onRemove(map);
      },
    };
    layer.onAdd(map);
    assert.equal(layer._canvas.width, 12);
    detachSpeciesHeatLayer(layer, map, L);
    layer.onAdd(map);
    assert.equal(layer._canvas.width, 12);
    assert.equal(layer._canvas.height, 9);
    assert.notEqual(layer._canvas.width, 300);
  });
});

describe("species heat field", () => {
  it("leaves empty land transparent and averages lift instead of last-colour-wins", () => {
    const width = 21;
    const height = 21;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const ctx = {
      createImageData: (w, h) => ({ data: pixels, width: w, height: h }),
      putImageData() {},
    };
    paintSpeciesHeatField(ctx, width, height, [], {
      viz: "relatief",
      radius: 4,
    });
    assert.ok(pixels.every((n) => n === 0));

    paintSpeciesHeatField(
      ctx,
      width,
      height,
      [
        { x: 4, y: 10, amount: -1, isAbsent: false },
        { x: 16, y: 10, amount: 1, isAbsent: false },
      ],
      { viz: "relatief", radius: 8 },
    );
    const mid = (10 * width + 10) * 4;
    const left = (10 * width + 4) * 4;
    const right = (10 * width + 16) * 4;
    assert.ok(pixels[left + 3] > 0);
    assert.ok(pixels[right + 3] > 0);
    assert.ok(pixels[mid + 3] > 0);
    assert.ok(pixels[right] < pixels[left]);
    assert.ok(pixels[right + 2] > pixels[left + 2]);
    assert.notEqual(pixels[mid], pixels[right]);
  });
});

describe("species heat zoom animation", () => {
  it("uses the same zoomanim gate as leaflet.heat", () => {
    assert.equal(
      speciesHeatZoomAnimationEnabled(
        { options: { zoomAnimation: true } },
        { Browser: { any3d: true } },
      ),
      true,
    );
    assert.equal(
      speciesHeatZoomAnimationEnabled(
        { options: { zoomAnimation: true }, _zoomAnimated: true },
        {},
      ),
      false,
    );
  });

  it("scales the canvas from its centre during zoomanim like Tellingen heat", () => {
    const transforms = [];
    const bound = [];
    const L = {
      Browser: { any3d: true },
      setOptions(obj, options) {
        obj.options = options || {};
      },
      DomUtil: {
        testProp: () => "transformOrigin",
        addClass(el, className) {
          el.className = `${el.className} ${className}`.trim();
        },
        create(_tag, className) {
          return {
            className,
            style: {},
            width: 300,
            height: 150,
            parentNode: null,
            getContext: () => ({
              clearRect() {},
              createImageData(w, h) {
                return {
                  data: new Uint8ClampedArray(w * h * 4),
                  width: w,
                  height: h,
                };
              },
              putImageData() {},
            }),
          };
        },
        setPosition() {},
        setTransform(el, offset, scale) {
          transforms.push({ el, offset, scale });
        },
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
      options: { zoomAnimation: true },
      getPanes: () => ({
        overlayPane: {
          appendChild(el) {
            el.parentNode = this;
          },
        },
      }),
      on(type) {
        bound.push(type);
      },
      off() {},
      getSize: () => ({ x: 20, y: 10 }),
      getCenter: () => ({ lat: 52.1, lng: 5.2 }),
      containerPointToLayerPoint: () => ({ x: 3, y: 4 }),
      latLngToContainerPoint: () => ({ x: 2, y: 2 }),
      getZoom: () => 8,
      getZoomScale: () => 2,
      _getCenterOffset: () => ({
        _multiplyBy() {
          return {
            subtract() {
              return { x: 6, y: 7 };
            },
          };
        },
      }),
      _getMapPanePos: () => ({ x: 0, y: 0 }),
    };
    layer.onAdd(map);
    assert.equal(layer._canvas.style.transformOrigin, "50% 50%");
    assert.match(layer._canvas.className, /leaflet-zoom-animated/);
    assert.deepEqual(bound, ["moveend", "zoomanim"]);
    assert.ok(!bound.includes("viewreset"));
    layer._animateZoom({ zoom: 9, center: { lat: 52, lng: 5 } });
    assert.equal(transforms.length, 1);
    assert.equal(transforms[0].scale, 2);
    assert.deepEqual(transforms[0].offset, { x: 6, y: 7 });
  });

  it("does not wipe the canvas bitmap when the viewport size is unchanged", () => {
    let widthWrites = 0;
    const L = {
      Browser: { any3d: true },
      setOptions(obj, options) {
        obj.options = options || {};
      },
      DomUtil: {
        testProp: () => "transformOrigin",
        addClass() {},
        create() {
          const canvas = {
            className: "",
            style: {},
            parentNode: null,
            getContext: () => ({
              clearRect() {},
              createImageData(w, h) {
                return {
                  data: new Uint8ClampedArray(w * h * 4),
                  width: w,
                  height: h,
                };
              },
              putImageData() {},
            }),
          };
          let width = 300;
          Object.defineProperty(canvas, "width", {
            get() {
              return width;
            },
            set(value) {
              widthWrites += 1;
              width = value;
            },
          });
          canvas.height = 150;
          return canvas;
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
      options: { zoomAnimation: true },
      getPanes: () => ({ overlayPane: { appendChild() {} } }),
      on() {},
      off() {},
      getSize: () => ({ x: 20, y: 10 }),
      getCenter: () => ({ lat: 52.1, lng: 5.2 }),
      containerPointToLayerPoint: () => ({ x: 0, y: 0 }),
      latLngToContainerPoint: () => ({ x: 1, y: 1 }),
      getZoom: () => 8,
    };
    layer.onAdd(map);
    const afterInit = widthWrites;
    assert.ok(afterInit >= 1);
    layer._reset();
    assert.equal(widthWrites, afterInit);
  });
});
