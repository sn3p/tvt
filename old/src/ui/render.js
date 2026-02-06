import { clear, renderPills, setHidden, text } from "./dom.js";
import { getEntryTopBirdsCached } from "../api/vbnCache.js";

function entryTopBirdsUrl({ year, id, limit = 9999 }) {
  return `https://vbn-tvt.northsea.cloud/v1/report/entry-top-birds?year=${encodeURIComponent(
    String(year)
  )}&id=${encodeURIComponent(String(id))}&limit=${encodeURIComponent(String(limit))}`;
}

function birdImageBase() {
  // Observed in Vogelbescherming DOM & data json:
  // https://cdn-cf.newstory.nl/vbn/tvt/media/img/resultaten/<filename>.png
  return "https://cdn-cf.newstory.nl/vbn/tvt/media/img/resultaten/";
}

function birdFallbackFilename() {
  return "niet-herkend.png";
}

function guessImageFilename(name) {
  // best-effort: lowercase, strip diacritics, spaces -> underscore
  // (only used as fallback when we can't map id->image)
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .concat(".png");
}

function makeImg({ filename, alt }) {
  const base = birdImageBase();
  const fallback = birdFallbackFilename();

  const wrap = document.createElement("div");
  wrap.className = "mvt-img";

  const img = document.createElement("img");
  img.alt = alt || "";
  img.loading = "lazy";
  img.decoding = "async";

  const setToNA = () => {
    wrap.innerHTML = "";
    const na = document.createElement("div");
    na.className = "mvt-img-na";
    na.textContent = "N/A";
    wrap.appendChild(na);
  };

  let triedFallback = false;
  img.onerror = () => {
    if (!triedFallback && fallback) {
      triedFallback = true;
      img.src = `${base}${fallback}`;
      return;
    }
    setToNA();
  };

  img.src = `${base}${String(filename || "")}`;
  wrap.appendChild(img);
  return wrap;
}

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
  const { points, urls, counts, includeSchool, includeOrg, year } = data;
  const pills = [
    { label: `punten: ${points.length}` },
    counts ? { label: `type=1: ${counts.school} · isorg: ${counts.org} · uniek: ${counts.merged}` } : null,
    includeSchool === false ? { label: "type=1 uit", kind: "warn" } : null,
    includeOrg === false ? { label: "isorg uit", kind: "warn" } : null,
  ].filter(Boolean);

  (urls ?? []).forEach((u) => {
    if (!u?.url) return;
    pills.push({ label: u.label ?? "local-participants", href: u.url, title: u.url });
    if (u.fromCache) pills.push({ label: `cache: ${u.fromCache}`, kind: "cache" });
  });

  renderPills(participantsMeta, pills);

  if (!points.length) {
    text(participantsBox, "Geen punten gevonden voor deze PC4/jaar.");
    return;
  }

  const viewKey = "mvt:participantsView";
  const getView = () => window.localStorage.getItem(viewKey) || "map";
  const setView = (v) => window.localStorage.setItem(viewKey, v);

  const tabs = document.createElement("div");
  tabs.className = "subtabs";

  const btnMap = document.createElement("button");
  btnMap.type = "button";
  btnMap.className = "subtab-btn";
  btnMap.textContent = "Kaart";

  tabs.appendChild(btnMap);

  const btnList = document.createElement("button");
  btnList.type = "button";
  btnList.className = "subtab-btn";
  btnList.textContent = "Lijst";
  tabs.appendChild(btnList);
  participantsBox.appendChild(tabs);

  const panelList = document.createElement("div");
  const panelMap = document.createElement("div");
  panelMap.className = "map-box";
  panelMap.setAttribute("aria-label", "Kaart met inzendingen");
  participantsBox.appendChild(panelList);
  participantsBox.appendChild(panelMap);

  function kindLabel(p) {
    // If an entry is present in both lists, treat it as "schoolinzending" for coloring/labeling.
    if (p.source === "org" || p.source === "both") return "Schoolinzending";
    return "Inzending";
  }

  function renderList() {
    clear(panelList);

    const rows = points.slice(0, 200).map((p) => {
      const kind = document.createElement("strong");
      kind.textContent = kindLabel(p);

      const link = document.createElement("a");
      link.href = entryTopBirdsUrl({ year, id: p.id, limit: 9999 });
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "open endpoint";
      link.title = link.href;

      return [kind, p.lat.toFixed(6), p.lng.toFixed(6), link];
    });

    const table = makeTable({
      columns: ["", "lat", "lng", ""],
      rows,
    });
    panelList.appendChild(table);

    if (points.length > 200) {
      const note = document.createElement("div");
      note.className = "muted";
      note.style.marginTop = "10px";
      note.textContent = `Toont eerste 200 van ${points.length} punten.`;
      panelList.appendChild(note);
    }
  }

  function initMap() {
    if (panelMap._leafletMap) return;
    const L = window.L;
    if (!L) {
      panelMap.textContent = "Leaflet is nog niet geladen.";
      return;
    }

    const map = L.map(panelMap, { preferCanvas: true });
    panelMap._leafletMap = map;

    // OpenStreetMap tiles: attribution is required by OSM.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    const colorSchool = "#fb923c"; // orange
    const colorOrg = "#60a5fa"; // blue

    const markers = [];

    const popupCache = new Map(); // entryId -> Promise<void> load guard

    function setPopupLoading(node) {
      node.innerHTML = "";
      const title = document.createElement("div");
      title.className = "mvt-popup-title";
      title.textContent = "Loading…";
      node.appendChild(title);
      const body = document.createElement("div");
      body.className = "mvt-popup-body muted";
      body.textContent = "Loading…";
      node.appendChild(body);
      return { title, body };
    }

    async function loadEntryDetailsInto({ entryId, kind, titleEl, bodyEl }) {
      const r = await getEntryTopBirdsCached({ year, id: entryId, limit: 9999 });
      const arr = Array.isArray(r.json?.data) ? r.json.data : [];
      const birds = arr
        .map((b) => ({ id: Number(b?.id), name: b?.name ?? b?.vogelnaam ?? "", number: Number(b?.number ?? 0) }))
        .filter((b) => b.name && Number.isFinite(b.number))
        .sort((a, b) => b.number - a.number);

      titleEl.textContent = kind;
      bodyEl.classList.remove("muted");
      bodyEl.innerHTML = "";

      const link = document.createElement("a");
      link.href = r.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open endpoint";
      link.className = "muted";
      link.style.display = "inline-block";
      link.style.marginBottom = "10px";
      bodyEl.appendChild(link);

      if (!birds.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "Geen vogels gevonden.";
        bodyEl.appendChild(empty);
        return;
      }

      const list = document.createElement("div");
      list.className = "mvt-popup-list";
      bodyEl.appendChild(list);

      birds.forEach((b, idx) => {
        const row = document.createElement("div");
        row.className = "mvt-bird-row";

        const left = document.createElement("div");
        left.className = "mvt-bird-left";

        const rank = document.createElement("div");
        rank.className = "mvt-rank";
        rank.textContent = String(idx + 1);
        left.appendChild(rank);

        const filename = guessImageFilename(b.name);
        left.appendChild(makeImg({ filename, alt: b.name }));

        const name = document.createElement("div");
        name.className = "mvt-bird-name";
        name.textContent = b.name;
        left.appendChild(name);

        const count = document.createElement("div");
        count.className = "mvt-bird-count";
        count.textContent = String(b.number);

        row.appendChild(left);
        row.appendChild(count);
        list.appendChild(row);
      });
    }

    for (const p of points) {
      const fillColor = p.source === "org" || p.source === "both" ? colorOrg : colorSchool;
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        opacity: 0.9,
        fillColor,
        fillOpacity: 0.9,
      });
      const popup = document.createElement("div");
      popup.className = "mvt-popup";
      const { title, body } = setPopupLoading(popup);

      m.bindPopup(popup, { maxWidth: 380, closeButton: true, autoPan: true });

      m.on("popupopen", () => {
        if (popupCache.has(p.id)) return;
        popupCache.set(
          p.id,
          loadEntryDetailsInto({ entryId: p.id, kind: kindLabel(p), titleEl: title, bodyEl: body }).catch((err) => {
            title.textContent = kindLabel(p);
            body.className = "mvt-popup-body muted";
            body.textContent = `Error: ${String(err?.message ?? err)}`;
          })
        );
      });
      m.addTo(map);
      markers.push(m);
    }

    // Legend
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "pill");
      div.style.display = "grid";
      div.style.gap = "6px";
      div.style.padding = "10px 10px";
      div.style.background = "rgba(0, 0, 0, 0.45)";
      div.style.backdropFilter = "blur(8px)";
      div.style.borderRadius = "12px";
      div.style.color = "rgba(255, 255, 255, 0.9)";
      div.style.maxWidth = "220px";

      const row = (label, color) => {
        const r = document.createElement("div");
        r.style.display = "flex";
        r.style.alignItems = "center";
        r.style.gap = "8px";
        const dot = document.createElement("span");
        dot.style.width = "12px";
        dot.style.height = "12px";
        dot.style.borderRadius = "999px";
        dot.style.border = "2px solid #fff";
        dot.style.background = color;
        const t = document.createElement("span");
        t.textContent = label;
        r.appendChild(dot);
        r.appendChild(t);
        return r;
      };

      div.appendChild(row("Inzending", colorSchool));
      div.appendChild(row("Schoolinzending", colorOrg));
      return div;
    };
    legend.addTo(map);

    if (markers.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.12));
    } else {
      map.setView([52.1, 5.3], 7);
    }

    // Leaflet needs a resize tick when shown.
    setTimeout(() => map.invalidateSize(), 0);
  }

  function setActive(view) {
    const isList = view === "list";
    btnList.setAttribute("aria-pressed", isList ? "true" : "false");
    btnMap.setAttribute("aria-pressed", isList ? "false" : "true");
    panelList.hidden = !isList;
    panelMap.hidden = isList;
    setView(view);
    if (!isList) initMap();
  }

  btnList.addEventListener("click", () => setActive("list"));
  btnMap.addEventListener("click", () => setActive("map"));

  renderList();
  setActive(getView());

}

export function renderCandidates(candidatesBox, candidatesMeta, data) {
  clear(candidatesBox);
  if (!data) {
    text(candidatesBox, "Nog geen data.");
    renderPills(candidatesMeta, []);
    return;
  }
  const { candidates, urls } = data;
  const pills = [{ label: `kandidaten: ${candidates.length}` }];
  (urls ?? []).forEach((u) => {
    if (!u?.url) return;
    pills.push({ label: u.label ?? "local-participants", href: u.url, title: u.url });
    if (u.fromCache) pills.push({ label: `cache: ${u.fromCache}`, kind: "cache" });
  });
  renderPills(candidatesMeta, pills);

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

export function renderComputed(computedBox, computedMeta, computedProgress, data) {
  clear(computedBox);
  if (!data) {
    text(computedBox, "Nog geen data.");
    renderPills(computedMeta, []);
    return;
  }
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

