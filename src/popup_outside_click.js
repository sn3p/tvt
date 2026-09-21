/**
 * Clicks on the map surface are handled by Leaflet (empty-map `click` vs
 * marker click). This predicate only covers chrome outside `#map`.
 */
export function isOutsideTellingPopupTarget(
  target,
  { mapRoot, popupSelector = ".leaflet-popup" } = {},
) {
  if (target == null || typeof target.closest !== "function") return true;
  if (target.closest(popupSelector)) return false;
  if (
    mapRoot &&
    typeof mapRoot.contains === "function" &&
    mapRoot.contains(target)
  ) {
    return false;
  }
  return true;
}

/**
 * CircleMarkers bubble `click` to the map in the same turn as the marker
 * handler. Ignore those map clicks so opening a telling is not dismissed.
 */
export function createTellingPopupMapClickGuard({
  schedule = queueMicrotask,
} = {}) {
  let ignoreMapClick = false;

  return {
    notePointMarkerClick() {
      ignoreMapClick = true;
      schedule(() => {
        ignoreMapClick = false;
      });
    },
    shouldCloseOnMapClick() {
      return !ignoreMapClick;
    },
  };
}
