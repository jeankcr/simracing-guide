"use strict";

const PLATFORMS = [
  { key: "pc", label: "PC", icon: "🖥️", idx: 0 },
  { key: "ps", label: "PlayStation", icon: "🎮", idx: 2 },
  { key: "xbox", label: "Xbox", icon: "🕹️", idx: 1 },
];
const STATUS_LABEL = { yes: "Compatible", check: "Verificar antes de vender", no: "No compatible" };

let DATA, BY_ID, ROLE_ORDER;
const state = { pf: "", role: "", brand: "", q: "", p: null };

/* ---------- helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const money = (n) => (n == null ? "" : "₡" + Math.round(n).toLocaleString("es-CR"));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pfIdx = () => (PLATFORMS.find((p) => p.key === state.pf) || {}).idx;
const visible = (p) => !state.pf || p.pf[pfIdx()] !== "N";

function readHash() {
  const sp = new URLSearchParams(location.hash.slice(1));
  state.pf = PLATFORMS.some((p) => p.key === sp.get("pf")) ? sp.get("pf") : sp.get("pf") === "all" ? "all" : "";
  state.role = sp.get("role") || "";
  state.brand = sp.get("brand") || "";
  state.p = sp.get("p") ? Number(sp.get("p")) : null;
}
function go(patch) {
  const next = { ...state, ...patch };
  const sp = new URLSearchParams();
  if (next.pf) sp.set("pf", next.pf);
  if (next.role) sp.set("role", next.role);
  if (next.brand) sp.set("brand", next.brand);
  if (next.p) sp.set("p", next.p);
  state.q = "";
  document.getElementById("q").value = "";
  if (location.hash.slice(1) === sp.toString()) render();
  else location.hash = sp.toString();
  window.scrollTo(0, 0);
}

function img(src, alt) {
  return src ? h("img", { src, alt: alt || "", loading: "lazy", referrerpolicy: "no-referrer" }) : h("span", {}, "—");
}

function platformBadges(p, only) {
  return h("div", { class: "badges" }, PLATFORMS.filter((x) => !only || only === x.key).map((x) => {
    const s = p.pf[x.idx];
    return h("span", { class: "b " + s, title: { Y: "Compatible", C: "Verificar", N: "No compatible" }[s] }, s === "C" ? x.label + " (verificar)" : x.label);
  }));
}

/* ---------- views ---------- */
function crumbs(extra) {
  const pf = PLATFORMS.find((p) => p.key === state.pf);
  const parts = [h("a", { href: "#" }, "Inicio")];
  parts.push(" › ", state.pf === "all" ? h("span", { class: "pill" }, "Todas las plataformas") : pf ? h("span", { class: "pill" }, pf.label) : "");
  if (pf || state.pf === "all") parts.push(" ", h("button", { onclick: () => go({ pf: "", role: "", brand: "", p: null }) }, "cambiar plataforma"));
  if (extra) parts.push(" › ", extra);
  return h("nav", { class: "crumbs" }, parts);
}

function viewPlatform() {
  const cards = PLATFORMS.map((x) => {
    const n = DATA.products.filter((p) => p.pf[x.idx] !== "N").length;
    return h("button", { class: "pf-card", onclick: () => go({ pf: x.key, role: "", brand: "", p: null }) },
      h("span", { class: "ico", "aria-hidden": "true" }, x.icon), h("strong", {}, x.label), h("span", { class: "n" }, n + " productos disponibles"));
  });
  return h("section", {},
    h("h1", {}, "¿En qué plataforma va a jugar el cliente?"),
    h("p", { class: "lead" }, "Empecemos por ahí: solo verá los productos que funcionan en esa plataforma."),
    h("div", { class: "pf-grid" }, cards),
    h("button", { class: "pf-all", onclick: () => go({ pf: "all" }) }, "No sé / ver todo el catálogo"));
}

function viewList() {
  const q = norm(state.q.trim());
  let items = DATA.products.filter(visible);
  const roleCounts = {};
  items.forEach((p) => (roleCounts[p.role] = (roleCounts[p.role] || 0) + 1));
  if (!q && state.role) items = items.filter((p) => p.role === state.role);
  if (state.brand) items = items.filter((p) => p.brand === state.brand);
  if (q) {
    // También ignora guiones y espacios, para que «941000119» encuentre «941-000119».
    const compacto = (s) => norm(s).replace(/[^a-z0-9]/g, "");
    const qc = compacto(q);
    items = items.filter((p) => {
      const texto = [p.name, p.brand, p.sku || "", String(p.id)].join(" ");
      return norm(texto).includes(q) || (qc && compacto(texto).includes(qc));
    });
  }
  const brands = [...new Set(DATA.products.filter(visible).map((p) => p.brand))].filter(Boolean).sort();

  const chips = [h("button", { class: "chip", "aria-pressed": String(!state.role), onclick: () => go({ role: "" }) }, "Todo")]
    .concat(ROLE_ORDER.filter((r) => roleCounts[r]).map((r) =>
      h("button", { class: "chip", "aria-pressed": String(state.role === r), onclick: () => go({ role: r }) }, DATA.roles[r], h("span", { class: "c" }, roleCounts[r]))));
  const brandSel = h("select", { "aria-label": "Marca", onchange: (e) => go({ brand: e.target.value }) },
    h("option", { value: "" }, "Todas las marcas"),
    brands.map((b) => h("option", { value: b, selected: b === state.brand }, b)));

  const cards = items.map((p) => h("button", { class: "card", onclick: () => go({ p: p.id }) },
    h("div", { class: "im" }, img(p.image, p.name)),
    h("div", { class: "tx" },
      h("div", { class: "nm" }, p.name),
      platformBadges(p),
      h("div", { class: "meta" }, h("span", {}, p.brand), h("span", {}, p.in_stock ? money(p.price) : "Agotado")))));

  return h("section", {},
    crumbs(q ? h("span", { class: "pill" }, "Búsqueda: " + state.q) : state.role ? h("span", { class: "pill" }, DATA.roles[state.role]) : null),
    h("h1", {}, q ? "Resultados de búsqueda" : "¿Qué producto quiere consultar el cliente?"),
    h("p", { class: "lead" }, "Elija un producto para ver con qué es compatible, qué hay que verificar y qué no sirve."),
    !q && h("div", { class: "filters" }, chips),
    h("div", { class: "filters" }, brandSel, h("span", { class: "lead" }, items.length + " productos")),
    items.length ? h("div", { class: "grid" }, cards) : h("div", { class: "empty" }, "No hay productos con esos filtros."));
}

function compatSection(status, rows, hiddenCount) {
  const byRole = {};
  rows.forEach((r) => (byRole[r.p.role] = byRole[r.p.role] || []).push(r));
  return h("div", { class: "sec " + status },
    h("h2", { class: "sec-h" }, h("span", { class: "dot" }), `${STATUS_LABEL[status]} (${rows.length})`),
    ROLE_ORDER.filter((r) => byRole[r]).map((r) => [
      h("div", { class: "group" }, DATA.roles[r]),
      byRole[r].sort((a, b) => a.p.name.localeCompare(b.p.name)).map(({ p, c }) => {
        const src = DATA.sources[c.src];
        const why = c.why + (src ? ` — Fuente: ${src.label}` : "");
        const pfWarn = state.pf && state.pf !== "all" && p.pf[pfIdx()] === "C" ? " ⚠ En esta plataforma: verificar." : "";
        return h("button", { class: "row", onclick: () => go({ p: p.id }) },
          h("span", { class: "th" }, img(p.image, "")),
          h("span", {}, h("div", { class: "nm" }, p.name), h("div", { class: "why" }, why + pfWarn)),
          h("span", { class: "pr" }, p.in_stock ? money(p.price) : "Agotado"));
      }),
    ]));
}

function compareBox(p) {
  const list = h("datalist", { id: "all-names" }, DATA.products.filter((x) => x.id !== p.id).map((x) => h("option", { value: x.name })));
  const res = h("div", { class: "res" });
  const input = h("input", {
    type: "text", list: "all-names", placeholder: "Escriba o elija otro producto…",
    oninput: () => {
      const other = DATA.products.find((x) => x.name === input.value);
      res.replaceChildren();
      if (!other) return;
      const c = p.compat.find((x) => x.id === other.id);
      if (!c) { res.append(h("strong", {}, "Sin relación documentada. "), "No hay información de que estos dos productos se combinen. Consulte con el proveedor."); return; }
      res.append(h("strong", {}, STATUS_LABEL[c.status] + ". "), c.why);
    },
  });
  return h("div", { class: "cmp" }, h("label", {}, h("strong", {}, "¿Es compatible con otro producto?"), input), list, res);
}

function viewDetail() {
  const p = BY_ID[state.p];
  if (!p) return h("div", { class: "empty" }, "Producto no encontrado.");
  const rows = { yes: [], check: [], no: [] };
  let hidden = 0;
  for (const c of p.compat) {
    const other = BY_ID[c.id];
    if (!other) continue;
    if (!visible(other)) { hidden++; continue; }
    rows[c.status].push({ p: other, c });
  }
  const selfWarn = state.pf && state.pf !== "all" && p.pf[pfIdx()] === "N";
  return h("section", {},
    crumbs(h("span", { class: "pill" }, "Producto")),
    h("div", { class: "detail" },
      h("div", { class: "im" }, img(p.image, p.name)),
      h("div", {},
        h("h1", {}, p.name),
        h("p", { class: "lead" }, p.brand, p.sku ? ` · SKU ${p.sku}` : ""),
        h("div", { class: "price" }, p.in_stock ? money(p.price) : "Agotado", p.on_sale && p.regular_price > p.price ? h("s", {}, money(p.regular_price)) : null),
        h("p", {}, h("strong", {}, "Plataformas: "), platformBadges(p)),
        selfWarn && h("div", { class: "note" }, "Este producto no funciona en la plataforma elegida."),
        p.note && h("div", { class: "note" }, p.note),
        h("a", { class: "btn", href: p.url, target: "_blank", rel: "noopener" }, "Ver en intelec.co.cr ↗"),
        compareBox(p))),
    p.compat.length === 0 && h("div", { class: "empty", style: "margin-top:18px" }, "Aún no hay compatibilidades documentadas para este producto."),
    ["yes", "check", "no"].filter((s) => rows[s].length).map((s) => compatSection(s, rows[s])),
    hidden > 0 && h("p", { class: "hidden-note" }, `${hidden} producto(s) compatibles se ocultan porque no funcionan en la plataforma elegida. `,
      h("button", { class: "pf-all", onclick: () => go({ pf: "all" }) }, "Mostrar todos")));
}

/* ---------- boot ---------- */
function render() {
  const app = document.getElementById("app");
  const searching = state.q.trim().length > 0;
  let view;
  if (state.p && !searching) view = viewDetail();
  else if (searching) view = viewList();
  else if (!state.pf) view = viewPlatform();
  else view = viewList();
  app.replaceChildren(view);
}

async function main() {
  try {
    DATA = await (await fetch("data.json", { cache: "no-cache" })).json();
  } catch (e) {
    document.getElementById("app").textContent = "No se pudo cargar el catálogo.";
    return;
  }
  BY_ID = Object.fromEntries(DATA.products.map((p) => [p.id, p]));
  ROLE_ORDER = Object.keys(DATA.roles);
  document.getElementById("meta").textContent = `${DATA.products.length} productos · datos actualizados ${DATA.generated}`;
  const q = document.getElementById("q");
  q.addEventListener("input", () => { state.q = q.value; render(); });
  document.getElementById("home").addEventListener("click", () => { q.value = ""; state.q = ""; });
  window.addEventListener("hashchange", () => { readHash(); render(); });
  readHash();
  render();
}
main();
