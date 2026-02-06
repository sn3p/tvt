export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function rankByDistance(points, { lat, lng }, { topN = 10, maxDistanceMeters = Infinity } = {}) {
  const ranked = points
    .map((p) => ({
      ...p,
      distance_m: haversineMeters(lat, lng, p.lat, p.lng),
    }))
    .filter((p) => p.distance_m <= maxDistanceMeters)
    .sort((a, b) => a.distance_m - b.distance_m);

  return ranked.slice(0, topN);
}

