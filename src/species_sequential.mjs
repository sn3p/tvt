/** ColorBrewer YlOrRd 9-class (light → dark). Sequential occupancy, not Relatief lift. */
export const SEQUENTIAL_COLORMAP_YLORRD = [
  [255, 255, 204],
  [255, 237, 160],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [189, 0, 38],
  [128, 0, 38],
];

export const SEQUENTIAL_COLORMAP_GAMMA = 0.6;

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function applyHighEndGamma(t, gamma = SEQUENTIAL_COLORMAP_GAMMA) {
  const x = clamp01(t);
  const g = Number(gamma);
  if (!Number.isFinite(g) || g <= 0) return x;
  return 1 - Math.pow(1 - x, g);
}

export function rgbFromSequentialRamp(
  t,
  stops = SEQUENTIAL_COLORMAP_YLORRD,
) {
  const x = clamp01(t);
  const ramp = Array.isArray(stops) && stops.length ? stops : SEQUENTIAL_COLORMAP_YLORRD;
  const n = ramp.length;
  if (n <= 1) {
    const c = ramp[0] || SEQUENTIAL_COLORMAP_YLORRD[0];
    return [c[0], c[1], c[2]];
  }
  const f = x * (n - 1);
  const i = Math.floor(f);
  const w = f - i;
  const c0 = ramp[Math.min(n - 1, Math.max(0, i))];
  const c1 = ramp[Math.min(n - 1, Math.max(0, i + 1))];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * w),
    Math.round(c0[1] + (c1[1] - c0[1]) * w),
    Math.round(c0[2] + (c1[2] - c0[2]) * w),
  ];
}

export function colorFromSequentialRamp(
  t,
  stops = SEQUENTIAL_COLORMAP_YLORRD,
) {
  const c = rgbFromSequentialRamp(t, stops);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Occupancy fill on a fixed 0–100% domain. Do not pass viewport-stretched values. */
export function occupancySequentialRgb(occupancy) {
  return rgbFromSequentialRamp(applyHighEndGamma(clamp01(occupancy)));
}

export function occupancySequentialColor(occupancy) {
  const c = occupancySequentialRgb(occupancy);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
