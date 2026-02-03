import { clear, renderPills, setHidden, text } from "./dom.js";

function fmtMeters(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function makeTable({ columns, rows }) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  columns.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    r.forEach((cell) => {
      const td = document.createElement("td");
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = cell == null ? "" : String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

export function showError(errorBox, err) {
  if (!err) {
    setHidden(errorBox, true);
    text(errorBox, "");
    return;
  }
  setHidden(errorBox, false);
  text(errorBox, String(err?.message ?? err));
}

export function setStatus(statusBar, msg) {
  text(statusBar, msg ?? "");
}

export function renderGeocode(geocodeBox, metaBox, result) {
  if (!result) {
    text(geocodeBox, "Geen adres gezocht.");
    renderPills(metaBox, []);
    return;
  }

  const { best, fromCache, url } = result;
  if (!best) {
    text(geocodeBox, "Geen match gevonden.");
    renderPills(metaBox, [
      { label: "PDOK", kind: "warn" },
      url ? { label: url } : null,
      fromCache ? { label: `cache: ${fromCache}`, kind: "cache" } : null,
    ].filter(Boolean));
    return;
  }

  const lines = [
    best.label,
    `lat/lng: ${best.lat.toFixed(6)}, ${best.lng.toFixed(6)}`,
    best.postcode ? `postcode: ${best.postcode}` : "postcode: (niet gevonden)",
    best.pc4 ? `PC4: ${best.pc4}` : "PC4: (niet gevonden)",
  ];
  text(geocodeBox, lines.join("\n"));
  renderPills(metaBox, [
    { label: "PDOK", kind: "ok" },
    fromCache ? { label: `cache: ${fromCache}`, kind: "cache" } : null,
  ].filter(Boolean));
}

export function renderRemoteTop(remoteTopBox, remoteTopMeta, data) {
  clear(remoteTopBox);
  if (!data) {
    text(remoteTopBox, "Nog geen data.");
    renderPills(remoteTopMeta, []);
    return;
  }
  const { list, url, fromCache } = data;
  renderPills(remoteTopMeta, [
    url ? { label: url } : null,
    fromCache ? { label: `cache: ${fromCache}`, kind: "cache" } : null,
  ].filter(Boolean));

  if (!list || list.length === 0) {
    text(remoteTopBox, "Lege response.");
    return;
  }

  const table = makeTable({
    columns: ["#", "Soort", "Aantal"],
    rows: list.map((b, i) => [String(i + 1), b.name, String(b.number)]),
  });
  remoteTopBox.appendChild(table);
}

export function renderParticipants(participantsBox, participantsMeta, data) {
  clear(participantsBox);
  if (!data) {
    text(participantsBox, "Nog geen data.");
    renderPills(participantsMeta, []);
    return;
  }
  const { points, url, fromCache } = data;
  renderPills(participantsMeta, [
    { label: `punten: ${points.length}` },
    url ? { label: url } : null,
    fromCache ? { label: `cache: ${fromCache}`, kind: "cache" } : null,
  ].filter(Boolean));

  if (!points.length) {
    text(participantsBox, "Geen punten gevonden voor deze PC4/jaar.");
    return;
  }

  const table = makeTable({
    columns: ["id", "lat", "lng"],
    rows: points.slice(0, 200).map((p) => [String(p.id), p.lat.toFixed(6), p.lng.toFixed(6)]),
  });
  participantsBox.appendChild(table);

  if (points.length > 200) {
    const note = document.createElement("div");
    note.className = "muted";
    note.style.marginTop = "10px";
    note.textContent = `Toont eerste 200 van ${points.length} punten.`;
    participantsBox.appendChild(note);
  }
}

export function renderComputed(computedBox, computedMeta, computedProgress, data) {
  clear(computedBox);
  if (!data) {
    text(computedBox, "Nog geen data.");
    renderPills(computedMeta, []);
    return;
  }
  const { topList, totalEntries, okCount, failCount, fromCacheHint } = data;
  renderPills(computedMeta, [
    { label: `entries: ${totalEntries}` },
    { label: `ok: ${okCount}`, kind: "ok" },
    failCount ? { label: `fail: ${failCount}`, kind: "warn" } : null,
    fromCacheHint ? { label: fromCacheHint, kind: "cache" } : null,
  ].filter(Boolean));

  if (!topList?.length) {
    text(computedBox, "Geen data om te tonen.");
    return;
  }

  const table = makeTable({
    columns: ["#", "Soort", "Totaal"],
    rows: topList.map((b, i) => [String(i + 1), b.name, String(b.total)]),
  });
  computedBox.appendChild(table);
}

export function setComputedProgress(computedProgress, msg) {
  text(computedProgress, msg ?? "");
}

export function renderCandidates(candidatesBox, candidatesMeta, data) {
  clear(candidatesBox);
  if (!data) {
    text(candidatesBox, "Nog geen data.");
    renderPills(candidatesMeta, []);
    return;
  }
  const { candidates, url, fromCache } = data;
  renderPills(candidatesMeta, [
    { label: `kandidaten: ${candidates.length}` },
    url ? { label: url } : null,
    fromCache ? { label: `cache: ${fromCache}`, kind: "cache" } : null,
  ].filter(Boolean));

  if (!candidates.length) {
    text(candidatesBox, "Geen kandidaten (binnen radius of topN).");
    return;
  }

  const rows = candidates.map((c) => {
    const birds = (c.topBirds ?? []).slice(0, 8);
    const birdsText = birds.map((b) => `${b.name} (${b.number})`).join(", ");
    const link = document.createElement("a");
    link.href = c.entryUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = String(c.id);

    return [link, fmtMeters(c.distance_m), c.lat.toFixed(6), c.lng.toFixed(6), birdsText || "(geen data)"];
  });

  const table = makeTable({
    columns: ["id", "afstand", "lat", "lng", "top birds (max 8)"],
    rows,
  });
  candidatesBox.appendChild(table);
}

