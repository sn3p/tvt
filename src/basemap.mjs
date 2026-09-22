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
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  },
};

export const BASEMAP_OPENFREEMAP_POSITRON = {
  id: "openfreemap-positron",
  kind: KIND_MAPLIBRE,
  label: "OpenFreeMap Positron",
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  options: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

export const BASEMAP_BRT_GRIJS = {
  id: "brt-grijs",
  kind: KIND_XYZ,
  label: "BRT Achtergrondkaart grijs",
  url: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png",
  options: {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.kadaster.nl/">Kadaster</a>',
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
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

export const BASEMAPS = [
  BASEMAP_OSM_HOT,
  BASEMAP_ESRI_GRAY,
  BASEMAP_OPENFREEMAP_POSITRON,
  BASEMAP_BRT_GRIJS,
];

export const DEFAULT_BASEMAP = BASEMAP_OSM_HOT;
export const DEFAULT_BASEMAP_POINTS = BASEMAP_OSM_HOT;
export const DEFAULT_BASEMAP_SPECIES = BASEMAP_ESRI_GRAY;

export const BASEMAP_STORAGE_KEYS = {
  points: "tvt:basemap:points",
  species: "tvt:basemap:species",
};

export function basemapStorageKeyForMode(mode) {
  return mode === "species"
    ? BASEMAP_STORAGE_KEYS.species
    : BASEMAP_STORAGE_KEYS.points;
}

export function defaultBasemapForMode(mode) {
  return mode === "species"
    ? DEFAULT_BASEMAP_SPECIES
    : DEFAULT_BASEMAP_POINTS;
}

export function parseBasemapId(raw) {
  const id = String(raw || "").trim();
  if (!id) return null;
  return BASEMAPS.find((spec) => spec.id === id) || null;
}

export function resolveBasemapForMode(mode, storedId) {
  return parseBasemapId(storedId) || defaultBasemapForMode(mode);
}

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
      attributionControl: {
        customAttribution: spec.options?.attribution,
      },
    });
  }
  return L.tileLayer(spec.url, spec.options);
}
