import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTellingPopupMapClickGuard,
  isOutsideTellingPopupTarget,
} from "./popup_outside_click.js";

function node({ closest = () => null } = {}) {
  return { closest };
}

test("closes on chrome outside the map", () => {
  const mapRoot = { contains: () => false };
  const target = node();
  assert.equal(isOutsideTellingPopupTarget(target, { mapRoot }), true);
});

test("keeps the popup open when clicking inside it", () => {
  const popup = node();
  const target = node({
    closest: (selector) => (selector === ".leaflet-popup" ? popup : null),
  });
  const mapRoot = { contains: (el) => el === target };
  assert.equal(isOutsideTellingPopupTarget(target, { mapRoot }), false);
});

test("defers map-surface clicks to Leaflet", () => {
  const target = node();
  const mapRoot = { contains: (el) => el === target };
  assert.equal(isOutsideTellingPopupTarget(target, { mapRoot }), false);
});

test("closes when the target is not an element", () => {
  assert.equal(isOutsideTellingPopupTarget(null, { mapRoot: {} }), true);
  assert.equal(isOutsideTellingPopupTarget("x", { mapRoot: {} }), true);
});

test("keeps the popup open across bubbled map clicks from a telling", () => {
  const queued = [];
  const guard = createTellingPopupMapClickGuard({
    schedule: (fn) => queued.push(fn),
  });

  assert.equal(guard.shouldCloseOnMapClick(), true);
  guard.notePointMarkerClick();
  assert.equal(guard.shouldCloseOnMapClick(), false);
  assert.equal(guard.shouldCloseOnMapClick(), false);
  queued.forEach((fn) => fn());
  assert.equal(guard.shouldCloseOnMapClick(), true);
});
