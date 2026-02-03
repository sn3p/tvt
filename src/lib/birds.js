export function normalizeEntryTopBirds(json) {
  const arr = json?.data;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((b) => ({
      name: b?.name ?? b?.vogelnaam ?? "",
      number: Number(b?.number ?? b?.count ?? b?.value ?? 0),
    }))
    .filter((b) => b.name && Number.isFinite(b.number));
}

export function aggregateTotals(map, birds) {
  for (const b of birds) {
    const prev = map.get(b.name) ?? 0;
    map.set(b.name, prev + b.number);
  }
  return map;
}

export function sortTopList(map, topK = 20) {
  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topK);
}

