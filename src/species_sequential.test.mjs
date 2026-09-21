import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIFT_COLOR_HIGH,
  LIFT_COLOR_LOW,
  LIFT_COLOR_MID,
  colorForLiftCell,
  colorFromDivergingT,
} from "./species_lift.mjs";
import {
  SEQUENTIAL_COLORMAP_YLORRD,
  applyHighEndGamma,
  colorFromSequentialRamp,
  occupancySequentialColor,
} from "./species_sequential.mjs";

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

describe("YlOrRd sequential ramp", () => {
  it("starts pale yellow and ends dark red", () => {
    assert.equal(colorFromSequentialRamp(0), rgb(SEQUENTIAL_COLORMAP_YLORRD[0]));
    assert.equal(
      colorFromSequentialRamp(1),
      rgb(SEQUENTIAL_COLORMAP_YLORRD.at(-1)),
    );
    assert.equal(colorFromSequentialRamp(0), "rgb(255,255,204)");
    assert.equal(colorFromSequentialRamp(1), "rgb(128,0,38)");
  });

  it("is not ColorBrewer Blues and not Relatief lift", () => {
    assert.notEqual(colorFromSequentialRamp(0), "rgb(247,251,255)");
    assert.notEqual(colorFromSequentialRamp(1), "rgb(8,48,107)");
    assert.notEqual(colorFromSequentialRamp(0), rgb(LIFT_COLOR_MID));
    assert.notEqual(colorFromSequentialRamp(1), rgb(LIFT_COLOR_HIGH));
    assert.notEqual(colorFromSequentialRamp(0), rgb(LIFT_COLOR_LOW));
    assert.notEqual(colorFromSequentialRamp(0.5), colorFromDivergingT(0));
    assert.notEqual(
      occupancySequentialColor(0.8),
      colorForLiftCell({ occupancy: 0.8, lift: 1 }),
    );
  });

  it("maps occupancy on a fixed 0–100% domain", () => {
    const common = occupancySequentialColor(0.8);
    const ifStretchedToView = colorFromSequentialRamp(applyHighEndGamma(0));
    assert.equal(occupancySequentialColor(0), colorFromSequentialRamp(0));
    assert.equal(occupancySequentialColor(1), colorFromSequentialRamp(1));
    assert.equal(common, colorFromSequentialRamp(applyHighEndGamma(0.8)));
    assert.notEqual(common, ifStretchedToView);
    assert.notEqual(occupancySequentialColor(0.7), occupancySequentialColor(0.9));
  });

  it("clamps out-of-range occupancy", () => {
    assert.equal(occupancySequentialColor(-2), occupancySequentialColor(0));
    assert.equal(occupancySequentialColor(3), occupancySequentialColor(1));
    assert.equal(occupancySequentialColor(Number.NaN), occupancySequentialColor(0));
  });
});
