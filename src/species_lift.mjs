export const SPECIES_VIZ_ABSOLUUT = "absoluut";
export const SPECIES_VIZ_RELATIEF = "relatief";

/** log2 domain of 0.5 → colour saturates at about 0.71× / 1.41× vs baseline. */
export const LIFT_LOG2_DOMAIN = 0.5;

export const LIFT_COLOR_LOW = [196, 80, 62];
export const LIFT_COLOR_MID = [241, 237, 228];
export const LIFT_COLOR_HIGH = [15, 118, 110];
export const LIFT_COLOR_ABSENT = [148, 163, 184];

export function parseSpeciesViz(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "relatief") return SPECIES_VIZ_RELATIEF;
  return SPECIES_VIZ_ABSOLUUT;
}

export function cellOccupancy(cell) {
  const total = Number(cell?.entry_count ?? 0) || 0;
  if (total <= 0) return null;
  const withCount = Number(cell?.with_count ?? 0) || 0;
  return withCount / total;
}

export function summaryOccupancy(summary) {
  const total = Number(summary?.entry_count ?? 0) || 0;
  if (total <= 0) return 0;
  const withCount = Number(summary?.with_count ?? 0) || 0;
  return withCount / total;
}

export function occupancyLift(occupancy, baseline) {
  if (occupancy == null) return null;
  if (!(baseline > 0)) return occupancy > 0 ? Number.POSITIVE_INFINITY : 0;
  return occupancy / baseline;
}

export function divergingTFromLift(liftValue) {
  if (liftValue === Number.POSITIVE_INFINITY) return 1;
  if (!(liftValue > 0) || !Number.isFinite(liftValue)) return -1;
  const log = Math.log2(liftValue);
  const domain = Number(LIFT_LOG2_DOMAIN);
  if (!Number.isFinite(domain) || domain <= 0) return 0;
  return Math.max(-1, Math.min(1, log / domain));
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function rgbString(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function colorFromDivergingT(t) {
  const x = Math.max(-1, Math.min(1, Number(t) || 0));
  if (x < 0) {
    const w = x + 1;
    return rgbString([
      lerpChannel(LIFT_COLOR_LOW[0], LIFT_COLOR_MID[0], w),
      lerpChannel(LIFT_COLOR_LOW[1], LIFT_COLOR_MID[1], w),
      lerpChannel(LIFT_COLOR_LOW[2], LIFT_COLOR_MID[2], w),
    ]);
  }
  return rgbString([
    lerpChannel(LIFT_COLOR_MID[0], LIFT_COLOR_HIGH[0], x),
    lerpChannel(LIFT_COLOR_MID[1], LIFT_COLOR_HIGH[1], x),
    lerpChannel(LIFT_COLOR_MID[2], LIFT_COLOR_HIGH[2], x),
  ]);
}

export function colorForLiftCell({ occupancy, lift }) {
  if (occupancy == null) return null;
  if (occupancy <= 0) return rgbString(LIFT_COLOR_ABSENT);
  return colorFromDivergingT(divergingTFromLift(lift));
}

export function liftLegendStops() {
  return [-1, -0.5, 0, 0.5, 1].map((t) => ({
    t,
    color: colorFromDivergingT(t),
  }));
}
