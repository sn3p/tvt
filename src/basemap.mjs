export const BASEMAP_ESRI_GRAY = {
  id: "esri-gray",
  label: "Esri World Light Gray Canvas",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  options: {
    maxNativeZoom: 16,
    maxZoom: 19,
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
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

export const DEFAULT_BASEMAP = BASEMAP_ESRI_GRAY;

export function leafletBaseLayers() {
  return {
    [BASEMAP_ESRI_GRAY.label]: BASEMAP_ESRI_GRAY,
    [BASEMAP_OSM_HOT.label]: BASEMAP_OSM_HOT,
  };
}
