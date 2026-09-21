import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEGACY_POINTS_SIDEBAR_STORAGE_KEY,
  defaultSidebarOpen,
  legacySpeciesSidebarStorageKey,
  parseSidebarOpenStoredValue,
  readSavedSidebarOpen,
  resolveSidebarOpenOnModeEnter,
  sidebarOpenStorageKey,
  writeSidebarOpen,
} from "./sidebar_open.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

describe("parseSidebarOpenStoredValue", () => {
  it("treats missing as unset", () => {
    assert.equal(parseSidebarOpenStoredValue(null), null);
    assert.equal(parseSidebarOpenStoredValue(undefined), null);
  });

  it("accepts the stored open tokens", () => {
    assert.equal(parseSidebarOpenStoredValue("open"), true);
    assert.equal(parseSidebarOpenStoredValue("1"), true);
    assert.equal(parseSidebarOpenStoredValue("true"), true);
  });

  it("treats any other stored value as closed", () => {
    assert.equal(parseSidebarOpenStoredValue("closed"), false);
    assert.equal(parseSidebarOpenStoredValue("0"), false);
    assert.equal(parseSidebarOpenStoredValue("false"), false);
  });
});

describe("defaultSidebarOpen", () => {
  it("opens Soorten on first visit, except mobile with a species selected", () => {
    assert.equal(defaultSidebarOpen({ mode: "species" }), true);
    assert.equal(
      defaultSidebarOpen({
        mode: "species",
        isMobile: true,
        hasSelectedSpecies: true,
      }),
      false,
    );
  });

  it("starts Tellingen collapsed", () => {
    assert.equal(defaultSidebarOpen({ mode: "points" }), false);
    assert.equal(defaultSidebarOpen({ mode: "points", isMobile: true }), false);
  });
});

describe("shared sidebar storage", () => {
  it("writes one key for both views", () => {
    const storage = memoryStorage();
    writeSidebarOpen(storage, true, { isMobile: false });
    writeSidebarOpen(storage, false, { isMobile: true });
    assert.equal(storage.data[sidebarOpenStorageKey(false)], "open");
    assert.equal(storage.data[sidebarOpenStorageKey(true)], "closed");
  });

  it("prefers the shared key over legacy per-view keys", () => {
    const storage = memoryStorage({
      [sidebarOpenStorageKey(false)]: "closed",
      [legacySpeciesSidebarStorageKey(false)]: "open",
      [LEGACY_POINTS_SIDEBAR_STORAGE_KEY]: "open",
    });
    assert.equal(
      readSavedSidebarOpen(storage, { isMobile: false, preferMode: "species" }),
      false,
    );
    assert.equal(
      readSavedSidebarOpen(storage, { isMobile: false, preferMode: "points" }),
      false,
    );
  });

  it("falls back to the current view's legacy key, then the other", () => {
    const storage = memoryStorage({
      [legacySpeciesSidebarStorageKey(false)]: "open",
      [LEGACY_POINTS_SIDEBAR_STORAGE_KEY]: "closed",
    });
    assert.equal(
      readSavedSidebarOpen(storage, { isMobile: false, preferMode: "species" }),
      true,
    );
    assert.equal(
      readSavedSidebarOpen(storage, { isMobile: false, preferMode: "points" }),
      false,
    );
  });
});

describe("resolveSidebarOpenOnModeEnter", () => {
  it("keeps the current value when switching Tellingen and Soorten", () => {
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: true,
        currentOpen: false,
        savedOpen: true,
        mode: "species",
      }),
      false,
    );
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: true,
        currentOpen: true,
        savedOpen: false,
        mode: "points",
      }),
      true,
    );
  });

  it("restores the shared saved value on first enter", () => {
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: false,
        currentOpen: true,
        savedOpen: false,
        mode: "species",
      }),
      false,
    );
  });

  it("uses the first-mode default when nothing is saved", () => {
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: false,
        savedOpen: null,
        mode: "points",
      }),
      false,
    );
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: false,
        savedOpen: null,
        mode: "species",
      }),
      true,
    );
  });

  it("reloads the saved value when the breakpoint changes", () => {
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: true,
        breakpointChanged: true,
        currentOpen: true,
        savedOpen: false,
        mode: "points",
        isMobile: true,
      }),
      false,
    );
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: true,
        breakpointChanged: true,
        currentOpen: false,
        savedOpen: true,
        mode: "species",
        isMobile: false,
      }),
      true,
    );
  });

  it("keeps the current value when the new breakpoint has nothing saved", () => {
    assert.equal(
      resolveSidebarOpenOnModeEnter({
        initialized: true,
        breakpointChanged: true,
        currentOpen: true,
        savedOpen: null,
        mode: "points",
        isMobile: true,
      }),
      true,
    );
  });
});
