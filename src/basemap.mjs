export const BASEMAP_POSITRON = {
  id: "positron",
  label: "Carto Positron",
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  options: {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

export const BASEMAP_OSM_HOT = {
  id: "osm-hot",
  label: "OSM HOT",
  url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  options: {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/">OpenStreetMap France</a>',
  },
};

export const DEFAULT_BASEMAP = BASEMAP_POSITRON;

export function leafletBaseLayers() {
  return {
    [BASEMAP_POSITRON.label]: BASEMAP_POSITRON,
    [BASEMAP_OSM_HOT.label]: BASEMAP_OSM_HOT,
  };
}
