import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPECIES_VIZ_ABSOLUUT,
  SPECIES_VIZ_RELATIEF,
  cellOccupancy,
  colorForLiftCell,
  colorFromDivergingT,
  divergingTFromLift,
  occupancyLift,
  parseSpeciesViz,
  summaryOccupancy,
} from "./species_lift.mjs";

describe("parseSpeciesViz", () => {
  it("defaults to absoluut", () => {
    assert.equal(parseSpeciesViz(null), SPECIES_VIZ_ABSOLUUT);
    assert.equal(parseSpeciesViz(""), SPECIES_VIZ_ABSOLUUT);
    assert.equal(parseSpeciesViz("grid"), SPECIES_VIZ_ABSOLUUT);
    assert.equal(parseSpeciesViz("classic"), SPECIES_VIZ_ABSOLUUT);
    assert.equal(parseSpeciesViz("absoluut"), SPECIES_VIZ_ABSOLUUT);
  });

  it("accepts relatief aliases", () => {
    assert.equal(parseSpeciesViz("relatief"), SPECIES_VIZ_RELATIEF);
    assert.equal(parseSpeciesViz("lift"), SPECIES_VIZ_RELATIEF);
    assert.equal(parseSpeciesViz(" Relatief "), SPECIES_VIZ_RELATIEF);
  });
});

describe("occupancy and lift", () => {
  it("computes cell occupancy", () => {
    assert.equal(cellOccupancy({ entry_count: 10, with_count: 8 }), 0.8);
    assert.equal(cellOccupancy({ entry_count: 0, with_count: 1 }), null);
  });

  it("uses the viewport summary as baseline", () => {
    assert.equal(summaryOccupancy({ entry_count: 50, with_count: 40 }), 0.8);
    assert.equal(summaryOccupancy({ entry_count: 0, with_count: 0 }), 0);
  });

  it("is occupancy divided by baseline", () => {
    assert.equal(occupancyLift(0.9, 0.8), 1.125);
    assert.equal(occupancyLift(0, 0.8), 0);
    assert.equal(occupancyLift(0.2, 0), Number.POSITIVE_INFINITY);
    assert.equal(occupancyLift(0, 0), 0);
  });
});

describe("diverging colour", () => {
  it("maps 1× to the midpoint", () => {
    assert.equal(divergingTFromLift(1), 0);
    assert.equal(colorFromDivergingT(0), "rgb(241,237,228)");
  });

  it("treats absence as the distinct gray, not the low end of the ramp", () => {
    assert.equal(
      colorForLiftCell({ occupancy: 0, lift: 0 }),
      "rgb(148,163,184)",
    );
    assert.notEqual(
      colorForLiftCell({ occupancy: 0, lift: 0 }),
      colorFromDivergingT(-1),
    );
  });

  it("clamps strong hotspots to the high end", () => {
    assert.equal(divergingTFromLift(4), 1);
    assert.equal(divergingTFromLift(Number.POSITIVE_INFINITY), 1);
  });
});
