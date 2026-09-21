export const KIND_XYZ = "xyz";
export const KIND_MAPLIBRE = "maplibre";

export const BASEMAP_ESRI_GRAY = {
  id: "esri-gray",
  kind: KIND_XYZ,
  label: "Esri World Light Gray Canvas",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  options: {
    maxNativeZoom: 16,
    maxZoom: 19,
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
  },
};

export const BASEMAP_OPENFREEMAP_POSITRON = {
  id: "openfreemap-positron",
  kind: KIND_MAPLIBRE,
  label: "OpenFreeMap Positron",
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  options: {
    attribution:
      '&copy; <a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

export const BASEMAP_BRT_GRIJS = {
  id: "brt-grijs",
  kind: KIND_XYZ,
  label: "BRT Achtergrondkaart grijs",
  url: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png",
  options: {
    maxZoom: 19,
    attribution:
      'Kaartgegevens &copy; <a href="https://www.kadaster.nl/">Kadaster</a>',
  },
};

export const BASEMAP_OSM_HOT = {
  id: "osm-hot",
  kind: KIND_XYZ,
  label: "OSM HOT",
  url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  options: {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/">OpenStreetMap France</a>',
  },
};

export const BASEMAP_ESRI_IMAGERY = {
  id: "esri-imagery",
  kind: KIND_XYZ,
  label: "Esri World Imagery",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  options: {
    maxZoom: 19,
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
};

export const BASEMAPS = [
  BASEMAP_ESRI_GRAY,
  BASEMAP_OPENFREEMAP_POSITRON,
  BASEMAP_BRT_GRIJS,
  BASEMAP_OSM_HOT,
  BASEMAP_ESRI_IMAGERY,
];

export const DEFAULT_BASEMAP = BASEMAP_ESRI_GRAY;

export function leafletBaseLayers() {
  return Object.fromEntries(BASEMAPS.map((spec) => [spec.label, spec]));
}

export function canCreateBasemapLayer(spec, L) {
  if (spec.kind === KIND_MAPLIBRE) return typeof L?.maplibreGL === "function";
  return typeof L?.tileLayer === "function";
}

export function createBasemapLayer(spec, L) {
  if (spec.kind === KIND_MAPLIBRE) {
    return L.maplibreGL({
      style: spec.styleUrl,
      attribution: spec.options?.attribution,
    });
  }
  return L.tileLayer(spec.url, spec.options);
}
