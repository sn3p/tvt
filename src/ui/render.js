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
    url ? { label: "remote-top-results", href: url, title: url } : null,
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
    url ? { label: "local-participants", href: url, title: url } : null,
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
  // After combining the top tables, this section is mainly for progress/status.
  const { status, totalEntries, okCount, failCount, cacheHits, done } = data;
  const isDone = status === "done";
  const isRunning = status === "running";
  const complete = isDone && failCount === 0 && okCount === totalEntries;

  const entriesLabel = isRunning
    ? `entries: ${done}/${totalEntries}`
    : complete
      ? `entries: ${totalEntries}`
      : isDone
        ? `entries: ${okCount}/${totalEntries}`
        : `entries: ${totalEntries}`;

  renderPills(computedMeta, [
    { label: entriesLabel, kind: complete ? "ok" : (isDone && failCount ? "warn" : null) },
    cacheHits ? { label: `cache hits: ${cacheHits}`, kind: "cache" } : null,
    failCount ? { label: `missing: ${failCount}`, kind: "warn" } : null,
  ].filter(Boolean));

  if (isRunning) {
    text(computedBox, "Bezig met berekenen… (resultaten verschijnen in de Top soorten tabel)");
  } else if (isDone) {
    text(computedBox, complete ? "Klaar." : "Klaar (onvolledig door errors/timeouts).");
  } else {
    text(computedBox, "Nog niet gestart.");
  }
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
    url ? { label: "local-participants", href: url, title: url } : null,
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

function getComputedTotalByName(computed, name) {
  if (!computed) return null;
  const byName = computed.totalsByName;
  if (byName && Object.prototype.hasOwnProperty.call(byName, name)) return byName[name];
  return null;
}

function isComputedComplete(computed) {
  return (
    computed &&
    computed.status === "done" &&
    computed.failCount === 0 &&
    computed.okCount === computed.totalEntries
  );
}

function countCell({ remoteCount, computedCount, mismatch }) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "8px";

  const span = document.createElement("span");
  span.textContent = mismatch ? `${computedCount}/${remoteCount}` : String(remoteCount);
  wrap.appendChild(span);

  if (mismatch) {
    const warn = document.createElement("span");
    warn.className = "pill warn";
    warn.textContent = "!";
    warn.title = `Verschil: berekend=${computedCount}, snel=${remoteCount}`;
    wrap.appendChild(warn);
  }
  return wrap;
}

export function renderTopBirdsCombined(topBox, metaBox, remote, computed) {
  clear(topBox);

  const pills = [];
  if (remote?.url) pills.push({ label: "remote-top-results", href: remote.url, title: remote.url });
  if (remote?.fromCache) pills.push({ label: `cache: ${remote.fromCache}`, kind: "cache" });

  const complete = isComputedComplete(computed);
  if (computed) {
    if (computed.status === "running") {
      pills.push({ label: `entries: ${computed.done}/${computed.totalEntries}` });
    } else if (computed.status === "done") {
      const entriesLabel = complete ? `entries: ${computed.totalEntries}` : `entries: ${computed.okCount}/${computed.totalEntries}`;
      pills.push({ label: entriesLabel, kind: complete ? "ok" : (computed.failCount ? "warn" : null) });
      if (computed.failCount) pills.push({ label: `missing: ${computed.failCount}`, kind: "warn" });
    }
  }

  renderPills(metaBox, pills);

  const remoteTop10 = remote?.list ?? [];
  if (!remoteTop10.length) {
    text(topBox, "Nog geen data.");
    return;
  }

  const rows = [];

  // Rows 1–10: always from remote, optionally show mismatch if computed is complete.
  for (let i = 0; i < remoteTop10.length; i++) {
    const r = remoteTop10[i];
    const computedTotal = complete ? getComputedTotalByName(computed, r.name) : null;
    const mismatch = complete && typeof computedTotal === "number" && computedTotal !== r.number;
    const cell =
      mismatch && typeof computedTotal === "number"
        ? countCell({ remoteCount: r.number, computedCount: computedTotal, mismatch: true })
        : String(r.number);
    rows.push([String(i + 1), r.name, cell]);
  }

  // Rows 11+: only show when computed is complete (avoid misleading partial data).
  if (complete) {
    const remoteNames = new Set(remoteTop10.map((x) => x.name));
    const computedList = computed?.topList ?? [];
    for (const c of computedList) {
      if (remoteNames.has(c.name)) continue;
      rows.push([String(rows.length + 1), c.name, String(c.total)]);
    }
  }

  const table = makeTable({
    columns: ["#", "Soort", "Aantal"],
    rows,
  });
  topBox.appendChild(table);
}

