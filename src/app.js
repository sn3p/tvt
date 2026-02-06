export function initApp() {
  const mapEl = document.querySelector("#map");
  const statsEl = document.querySelector("#statsBar");
  const yearInput = document.querySelector("#yearInput");
  const pc4Input = document.querySelector("#pc4Input");
  const includeType1Input = document.querySelector("#includeType1Input");
  const includeIsorgInput = document.querySelector("#includeIsorgInput");
  const filtersForm = document.querySelector("#filtersForm");

  if (!mapEl || !statsEl || !yearInput || !pc4Input || !includeType1Input || !includeIsorgInput || !filtersForm) {
    return;
  }

  if (!("L" in globalThis)) {
    statsEl.textContent = "Leaflet niet geladen (check netwerk / CDN).";
    return;
  }

  // Prevent accidental form submit refresh on Enter.
  filtersForm.addEventListener("submit", (e) => e.preventDefault());

  statsEl.textContent = "Dataset laden…";

  const map = globalThis.L.map(mapEl, {
    zoomControl: true,
    preferCanvas: true,
  });

  globalThis.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const layer = globalThis.L.layerGroup().addTo(map);

  let dataset = null;
  let didFitOnce = false;
  let lastPc4 = "";
  let rendered = [];
  let totals = { entries: 0, birds: 0 };

  let legendType1TextEl = null;
  let legendIsorgTextEl = null;

  function normalizePc4(v) {
    const m = String(v ?? "").match(/(\d{4})/);
    return m ? m[1] : "";
  }

  function sumBirds(birds) {
    if (!Array.isArray(birds)) return 0;
    let s = 0;
    for (const b of birds) s += Number(b?.count ?? 0) || 0;
    return s;
  }

  function entryHasMode(entry, mode) {
    return Array.isArray(entry?.modes) && entry.modes.includes(mode);
  }

  function colorForEntry(entry) {
    const isType1 = entryHasMode(entry, "type1");
    const isIsorg = entryHasMode(entry, "isorg");
    if (isType1 && isIsorg) return "#a78bfa"; // both
    if (isIsorg) return "#60a5fa"; // blue
    return "#fb923c"; // orange (type1)
  }

  function labelForEntry(entry) {
    const isType1 = entryHasMode(entry, "type1");
    const isIsorg = entryHasMode(entry, "isorg");
    if (isType1 && isIsorg) return "Inzending + Schoolinzending";
    if (isIsorg) return "Schoolinzending";
    return "Inzending";
  }

  function updateViewportStats() {
    if (!dataset) return;

    const b = map.getBounds();
    let inViewEntries = 0;
    let inViewBirds = 0;
    let inViewType1 = 0;
    let inViewIsorg = 0;

    for (const r of rendered) {
      if (!b.contains(r.latlng)) continue;
      inViewEntries += 1;
      inViewBirds += r.birdsTotal;
      if (r.isType1) inViewType1 += 1;
      if (r.isIsorg) inViewIsorg += 1;
    }

    statsEl.textContent = `${inViewEntries} inzendingen in beeld (totaal ${totals.entries}) • ${inViewBirds} vogels geteld (totaal ${totals.birds})`;

    if (legendType1TextEl) legendType1TextEl.textContent = `Inzending (${inViewType1})`;
    if (legendIsorgTextEl) legendIsorgTextEl.textContent = `Schoolinzending (${inViewIsorg})`;
  }

  // Legend (copied from old app style)
  const legend = globalThis.L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = globalThis.L.DomUtil.create("div", "pill");
    div.style.display = "grid";
    div.style.gap = "6px";
    div.style.padding = "10px 10px";
    div.style.background = "rgba(0, 0, 0, 0.45)";
    div.style.backdropFilter = "blur(8px)";
    div.style.borderRadius = "12px";
    div.style.color = "rgba(255, 255, 255, 0.9)";
    div.style.maxWidth = "220px";

    const row = ({ label, color, getTextEl }) => {
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
      if (typeof getTextEl === "function") getTextEl(t);
      return r;
    };

    div.appendChild(
      row({
        label: "Inzending (0)",
        color: "#fb923c",
        getTextEl: (el) => {
          legendType1TextEl = el;
        },
      })
    );
    div.appendChild(
      row({
        label: "Schoolinzending (0)",
        color: "#60a5fa",
        getTextEl: (el) => {
          legendIsorgTextEl = el;
        },
      })
    );

    // Don't let the legend eat map scroll/drag.
    globalThis.L.DomEvent.disableClickPropagation(div);
    globalThis.L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  legend.addTo(map);

  function popupHtml(entry) {
    const birds = Array.isArray(entry?.birds) ? entry.birds : [];
    const total = sumBirds(birds);
    const rows = birds
      .slice()
      .sort((a, b) => (Number(b?.count ?? 0) || 0) - (Number(a?.count ?? 0) || 0))
      .map((b) => {
        const name = String(b?.name ?? "Onbekend");
        const count = Number(b?.count ?? 0) || 0;
        return `<li class="row"><span class="name">${escapeHtml(name)}</span><span class="count">${count}</span></li>`;
      })
      .join("");

    return `
      <div class="tvt-popup">
        <h3>Entry ${entry.id}</h3>
        <p class="meta">PC4 ${entry.pc4} • ${labelForEntry(entry)} • totaal ${total}</p>
        <ul class="list">${rows || '<li class="row"><span class="name">Geen soorten</span><span class="count">0</span></li>'}</ul>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getFilters() {
    const year = Number(yearInput.value || 0) || 0;
    const pc4 = normalizePc4(pc4Input.value);
    const includeType1 = Boolean(includeType1Input.checked);
    const includeIsorg = Boolean(includeIsorgInput.checked);
    return { year, pc4, includeType1, includeIsorg };
  }

  function entryIncludedByModes(entry, { includeType1, includeIsorg }) {
    const isType1 = entryHasMode(entry, "type1");
    const isIsorg = entryHasMode(entry, "isorg");
    return (includeType1 && isType1) || (includeIsorg && isIsorg);
  }

  function render() {
    if (!dataset) return;

    const { year, pc4, includeType1, includeIsorg } = getFilters();
    const dataYear = Number(dataset?.meta?.year ?? 0) || 0;

    if (year && dataYear && year !== dataYear) {
      layer.clearLayers();
      statsEl.textContent = `Geen dataset voor ${year} (alleen ${dataYear} beschikbaar).`;
      return;
    }

    const entries = Array.isArray(dataset?.entries) ? dataset.entries : [];

    const filtered = entries.filter((e) => {
      if (pc4 && String(e?.pc4) !== pc4) return false;
      if (!entryIncludedByModes(e, { includeType1, includeIsorg })) return false;
      return typeof e?.lat === "number" && typeof e?.lng === "number";
    });

    layer.clearLayers();
    rendered = [];

    const bounds = [];
    for (const e of filtered) {
      const latlng = globalThis.L.latLng(e.lat, e.lng);
      bounds.push(latlng);
      const birdsTotal = sumBirds(e.birds);
      const isType1 = entryHasMode(e, "type1");
      const isIsorg = entryHasMode(e, "isorg");
      rendered.push({ latlng, birdsTotal, isType1, isIsorg });

      const color = colorForEntry(e);
      globalThis.L.circleMarker(latlng, {
        radius: 6,
        color: "rgba(255,255,255,0.9)",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(popupHtml(e), { maxWidth: 340 })
        .addTo(layer);
    }

    totals = {
      entries: filtered.length,
      birds: rendered.reduce((acc, r) => acc + r.birdsTotal, 0),
    };

    // Fit bounds on first load, and when PC4 filter changes.
    if (!didFitOnce || pc4 !== lastPc4) {
      if (bounds.length) {
        // Ensure we have an actual bounds object (more robust than raw arrays).
        const bb = globalThis.L.latLngBounds(bounds);
        // Ensure map has measured size before fitting.
        try {
          map.invalidateSize({ animate: false });
        } catch {
          // ignore
        }
        map.fitBounds(bb, { padding: [20, 20] });
        didFitOnce = true;
      } else {
        // Groningen-ish default view
        map.setView([53.22, 6.57], 11);
      }
    }

    lastPc4 = pc4;

    // Initial stats for current viewport (moveend will keep it updated).
    updateViewportStats();
  }

  function onFiltersChanged() {
    // Normalize PC4 input "while typing" (only on change events).
    const pc4 = normalizePc4(pc4Input.value);
    if (pc4Input.value && pc4Input.value !== pc4) pc4Input.value = pc4;
    render();
  }

  yearInput.addEventListener("change", onFiltersChanged);
  pc4Input.addEventListener("change", onFiltersChanged);
  includeType1Input.addEventListener("change", onFiltersChanged);
  includeIsorgInput.addEventListener("change", onFiltersChanged);

  // Initial view while loading.
  map.setView([53.22, 6.57], 11);
  map.on("moveend", () => updateViewportStats());

  // Guard against layout/size timing issues (flex layouts, sticky header).
  const invalidate = () => {
    try {
      map.invalidateSize({ animate: false });
    } catch {
      // ignore
    }
  };
  map.whenReady(() => {
    invalidate();
    // A second invalidate on next tick tends to fix "size is 0" edge cases.
    setTimeout(invalidate, 0);
  });
  window.addEventListener("resize", () => invalidate());

  fetch("./data/2026/municipality_groningen.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} bij laden dataset`);
      return r.json();
    })
    .then((json) => {
      dataset = json;
      render();
    })
    .catch((err) => {
      layer.clearLayers();
      statsEl.textContent = `Dataset laden mislukt: ${err?.message || String(err)}`;
    });
}

