export function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function text(node, value) {
  node.textContent = value == null ? "" : String(value);
}

export function setHidden(node, hidden) {
  node.hidden = Boolean(hidden);
}

export function pill({ label, kind } = {}) {
  const span = document.createElement("span");
  span.className = `pill${kind ? ` ${kind}` : ""}`;
  span.textContent = label ?? "";
  return span;
}

export function renderPills(node, pills) {
  clear(node);
  if (!pills || pills.length === 0) return;
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "8px";
  pills.forEach((p) => wrap.appendChild(pill(p)));
  node.appendChild(wrap);
}

