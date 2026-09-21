import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASEMAP_ESRI_GRAY,
  BASEMAP_OSM_HOT,
  DEFAULT_BASEMAP,
  leafletBaseLayers,
} from "./basemap.mjs";

describe("basemap tile set", () => {
  it("defaults to Esri Light Gray without a Carto API key", () => {
    assert.equal(DEFAULT_BASEMAP, BASEMAP_ESRI_GRAY);
    assert.match(
      DEFAULT_BASEMAP.url,
      /World_Light_Gray_Base\/MapServer\/tile/,
    );
    assert.doesNotMatch(DEFAULT_BASEMAP.url, /cartocdn|carto\.com|\?key=/);
    assert.notEqual(DEFAULT_BASEMAP.url, BASEMAP_OSM_HOT.url);
  });

  it("credits Esri on the default tiles", () => {
    assert.match(BASEMAP_ESRI_GRAY.options.attribution, /Esri/);
  });

  it("keeps OSM HOT as a second base layer", () => {
    const layers = leafletBaseLayers();
    assert.equal(layers.Lichtgrijs, BASEMAP_ESRI_GRAY);
    assert.equal(layers["OSM HOT"], BASEMAP_OSM_HOT);
    assert.match(BASEMAP_OSM_HOT.url, /tile\.openstreetmap\.fr\/hot/);
    assert.match(
      BASEMAP_OSM_HOT.options.attribution,
      /Humanitarian OpenStreetMap Team/,
    );
  });
});
