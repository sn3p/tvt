import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASEMAP_OSM_HOT,
  BASEMAP_POSITRON,
  DEFAULT_BASEMAP,
  leafletBaseLayers,
} from "./basemap.mjs";

describe("basemap tile set", () => {
  it("defaults to Carto Positron, not OSM HOT", () => {
    assert.equal(DEFAULT_BASEMAP, BASEMAP_POSITRON);
    assert.match(DEFAULT_BASEMAP.url, /basemaps\.cartocdn\.com\/light_all/);
    assert.notEqual(DEFAULT_BASEMAP.url, BASEMAP_OSM_HOT.url);
  });

  it("credits OpenStreetMap and CARTO on Positron", () => {
    assert.match(BASEMAP_POSITRON.options.attribution, /openstreetmap\.org\/copyright/i);
    assert.match(BASEMAP_POSITRON.options.attribution, /carto\.com\/attributions/i);
  });

  it("keeps OSM HOT as a second base layer", () => {
    const layers = leafletBaseLayers();
    assert.equal(layers["Carto Positron"], BASEMAP_POSITRON);
    assert.equal(layers["OSM HOT"], BASEMAP_OSM_HOT);
    assert.match(BASEMAP_OSM_HOT.url, /tile\.openstreetmap\.fr\/hot/);
    assert.match(BASEMAP_OSM_HOT.options.attribution, /Humanitarian OpenStreetMap Team/);
  });
});
