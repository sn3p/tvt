import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASEMAP_BRT_GRIJS,
  BASEMAP_ESRI_GRAY,
  BASEMAP_OPENFREEMAP_POSITRON,
  BASEMAP_OSM_HOT,
  BASEMAPS,
  DEFAULT_BASEMAP,
  KIND_MAPLIBRE,
  canCreateBasemapLayer,
  createBasemapLayer,
  leafletBaseLayers,
} from "./basemap.mjs";

describe("basemap tile set", () => {
  it("defaults to OSM HOT without a Carto API key", () => {
    assert.equal(DEFAULT_BASEMAP, BASEMAP_OSM_HOT);
    assert.equal(BASEMAPS[0], BASEMAP_OSM_HOT);
    assert.match(DEFAULT_BASEMAP.url, /tile\.openstreetmap\.fr\/hot/);
    assert.doesNotMatch(DEFAULT_BASEMAP.url, /cartocdn|carto\.com|\?key=/);
  });

  it("lists OSM HOT first, then the other try-out layers", () => {
    const layers = leafletBaseLayers();
    assert.deepEqual(Object.keys(layers), [
      "OSM HOT",
      "Esri World Light Gray Canvas",
      "OpenFreeMap Positron",
      "BRT Achtergrondkaart grijs",
    ]);
    assert.equal(layers["OSM HOT"], BASEMAP_OSM_HOT);
    assert.equal(layers["Esri World Light Gray Canvas"], BASEMAP_ESRI_GRAY);
    assert.equal(layers["OpenFreeMap Positron"], BASEMAP_OPENFREEMAP_POSITRON);
    assert.equal(layers["BRT Achtergrondkaart grijs"], BASEMAP_BRT_GRIJS);
    assert.equal(BASEMAPS.length, 4);
    assert.equal(layers["Esri World Imagery"], undefined);
  });

  it("keeps attribution as short as the old OSM-only line", () => {
    for (const spec of BASEMAPS) {
      const credit = spec.options.attribution;
      assert.ok(credit.length < 90, credit);
      assert.doesNotMatch(
        credit,
        /i-cubed|DeLorme|GIS User Community|OpenMapTiles|Humanitarian|Kaartgegevens/,
      );
    }
    assert.match(BASEMAP_ESRI_GRAY.options.attribution, /Esri/);
    assert.match(BASEMAP_OSM_HOT.options.attribution, /openstreetmap\.org\/copyright/);
    assert.match(
      BASEMAP_OPENFREEMAP_POSITRON.options.attribution,
      /openstreetmap\.org\/copyright/,
    );
    assert.match(BASEMAP_BRT_GRIJS.options.attribution, /Kadaster/);
  });

  it("does not use osm.org Mapnik or Stadia/Stamen", () => {
    const blob = JSON.stringify(BASEMAPS);
    assert.doesNotMatch(blob, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(blob, /stadiamaps|stamen-tiles|stamen\.com/i);
    assert.doesNotMatch(blob, /World_Imagery/);
  });

  it("uses OpenFreeMap vector Positron, not Carto raster", () => {
    assert.equal(BASEMAP_OPENFREEMAP_POSITRON.kind, KIND_MAPLIBRE);
    assert.equal(
      BASEMAP_OPENFREEMAP_POSITRON.styleUrl,
      "https://tiles.openfreemap.org/styles/positron",
    );
    assert.match(BASEMAP_BRT_GRIJS.url, /brt\/achtergrondkaart.+grijs/);
  });

  it("skips MapLibre Positron when the plugin is missing", () => {
    const L = {
      tileLayer: () => "xyz",
    };
    assert.equal(canCreateBasemapLayer(BASEMAP_ESRI_GRAY, L), true);
    assert.equal(canCreateBasemapLayer(BASEMAP_OPENFREEMAP_POSITRON, L), false);
    L.maplibreGL = (opts) => opts;
    assert.equal(canCreateBasemapLayer(BASEMAP_OPENFREEMAP_POSITRON, L), true);
    const gl = createBasemapLayer(BASEMAP_OPENFREEMAP_POSITRON, L);
    assert.equal(
      gl.attributionControl.customAttribution,
      BASEMAP_OPENFREEMAP_POSITRON.options.attribution,
    );
  });
});
