export const LEGACY_POINTS_SIDEBAR_STORAGE_KEY = "tvt:pointsSidebarOpen";

export function sidebarOpenStorageKey(isMobile) {
  return `tvt:sidebarOpen:${isMobile ? "mobile" : "desktop"}`;
}

export function legacySpeciesSidebarStorageKey(isMobile) {
  return `tvt:speciesSidebarOpen:${isMobile ? "mobile" : "desktop"}`;
}

export function parseSidebarOpenStoredValue(raw) {
  if (raw == null) return null;
  return raw === "1" || raw === "true" || raw === "open";
}

export function defaultSidebarOpen({
  mode,
  isMobile = false,
  hasSelectedSpecies = false,
} = {}) {
  if (mode === "species") {
    if (isMobile && hasSelectedSpecies) return false;
    return true;
  }
  return false;
}

export function readSavedSidebarOpen(
  storage,
  { isMobile = false, preferMode = "points" } = {},
) {
  if (!storage || typeof storage.getItem !== "function") return null;

  const sharedRaw = storage.getItem(sidebarOpenStorageKey(isMobile));
  if (sharedRaw != null) return parseSidebarOpenStoredValue(sharedRaw);

  const speciesRaw = storage.getItem(legacySpeciesSidebarStorageKey(isMobile));
  const pointsRaw = storage.getItem(LEGACY_POINTS_SIDEBAR_STORAGE_KEY);
  const preferredFirst = preferMode === "species" ? speciesRaw : pointsRaw;
  const preferredSecond = preferMode === "species" ? pointsRaw : speciesRaw;
  if (preferredFirst != null) return parseSidebarOpenStoredValue(preferredFirst);
  if (preferredSecond != null) {
    return parseSidebarOpenStoredValue(preferredSecond);
  }
  return null;
}

export function writeSidebarOpen(storage, open, { isMobile = false } = {}) {
  if (!storage || typeof storage.setItem !== "function") return;
  storage.setItem(sidebarOpenStorageKey(isMobile), open ? "open" : "closed");
}

/**
 * Tellingen and Soorten share one expand/collapse value. Restore or default
 * only on the first mode enter; later switches keep the current value.
 * Crossing the mobile/desktop breakpoint reloads that breakpoint's saved
 * value so a later toggle cannot overwrite the other viewport's preference.
 */
export function resolveSidebarOpenOnModeEnter({
  initialized = false,
  breakpointChanged = false,
  currentOpen = true,
  savedOpen = null,
  mode = "points",
  isMobile = false,
  hasSelectedSpecies = false,
} = {}) {
  if (breakpointChanged) {
    if (savedOpen != null) return Boolean(savedOpen);
    return Boolean(currentOpen);
  }
  if (initialized) return Boolean(currentOpen);
  if (savedOpen != null) return Boolean(savedOpen);
  return defaultSidebarOpen({ mode, isMobile, hasSelectedSpecies });
}
