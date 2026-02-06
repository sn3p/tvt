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
  const el = document.createElement("span");
  el.className = `pill${kind ? ` ${kind}` : ""}`;
  el.textContent = label ?? "";
  return el;
}

export function renderPills(node, pills) {
  clear(node);
  if (!pills || pills.length === 0) return;
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "8px";
  pills.forEach((p) => {
    if (!p) return;
    const { href, title, ...rest } = p;
    const base = pill(rest);
    if (title) base.title = title;
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.className = base.className;
      a.textContent = base.textContent;
      if (title) a.title = title;
      wrap.appendChild(a);
    } else {
      wrap.appendChild(base);
    }
  });
  node.appendChild(wrap);
}

