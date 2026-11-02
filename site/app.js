"use strict";

const PLATFORMS = [
  { key: "pc", label: "PC", icon: "pc", idx: 0 },
  { key: "ps", label: "PlayStation", icon: "ps", idx: 2 },
  { key: "xbox", label: "Xbox", icon: "xbox", idx: 1 },
];
const STATUS_LABEL = { yes: "Compatible", check: "Verificar antes de vender", no: "No compatible" };
const TALLY_LABEL = { yes: "Compatibles", check: "Verificar", no: "No compatibles" };

// Íconos de línea 24×24. Son textos fijos de este archivo, nunca datos del catálogo.
const PAD = '<path d="M6.6 6.5h10.8a4.6 4.6 0 0 1 4.5 3.7l1 5.3a2.7 2.7 0 0 1-4.7 2.3L16.4 16H7.6l-1.8 1.8a2.7 2.7 0 0 1-4.7-2.3l1-5.3a4.6 4.6 0 0 1 4.5-3.7Z"/>';
const BUTTONS = '<path d="M16.4 10.3h.01M18.4 10.3h.01M17.4 9.3h.01M17.4 11.3h.01"/>';
const ICONS = {
  pc: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>',
  ps: PAD + BUTTONS + '<path d="M7.2 9.1v2.6M5.9 10.4h2.6"/><circle cx="9.5" cy="13.4" r="1.2"/><circle cx="14.5" cy="13.4" r="1.2"/>',
  xbox: PAD + BUTTONS + '<circle cx="6.9" cy="10.3" r="1.2"/><path d="M9.6 12.3v2.4M8.4 13.5h2.4"/><circle cx="14.6" cy="13.5" r="1.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};

let DATA, BY_ID, ROLE_ORDER;
const state = { pf: "", role: "", brand: "", q: "", p: null };
const TITLE = document.title;

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
function icon(name) {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return t.content.firstChild;
}
const money = (n) => (n == null ? "" : "₡" + Math.round(n).toLocaleString("es-CR"));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pfIdx = () => (PLATFORMS.find((p) => p.key === state.pf) || {}).idx;
const visible = (p) => !state.pf || p.pf[pfIdx()] !== "N";
const motionOK = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const discount = (p) => (p.on_sale && p.regular_price > p.price ? Math.round((1 - p.price / p.regular_price) * 100) : 0);
const safeUrl = (u) => (/^https?:\/\//.test(u || "") ? u : null);
// Número animado: el lector de pantalla lee solo el valor final, no cada cuadro de la animación.
const counter = (tag, cls, n) => [h(tag, { class: cls || "", "data-count": n, "aria-hidden": "true" }, n), h("span", { class: "sr" }, String(n))];

function fmtDate(s) {
  const d = new Date(String(s).replace(" UTC", "Z").replace(" ", "T"));
  return isNaN(d) ? s : d.toLocaleString("es-CR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

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

function platformBadges(p, only, size) {
  return h("span", { class: "badges" + (size ? " " + size : "") }, PLATFORMS.filter((x) => !only || only === x.key).map((x) => {
    const s = p.pf[x.idx];
    return h("span", { class: "b " + s, title: { Y: "Compatible", C: "Verificar", N: "No compatible" }[s] }, s === "C" ? x.label + " (verificar)" : x.label);
  }));
}

/* ---------- efectos ---------- */
// Números que suben desde cero al entrar a la pantalla.
function countUp(root) {
  if (!motionOK()) return;
  root.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    if (!end) return;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  });
}
// Luz que sigue al mouse (.fx) e inclinación 3D (.tilt).
function trackPointer(e) {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest && e.target.closest(".fx");
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  el.style.setProperty("--mx", x + "px");
  el.style.setProperty("--my", y + "px");
  if (el.classList.contains("tilt")) {
    el.style.setProperty("--ry", ((x / r.width - 0.5) * 8).toFixed(2) + "deg");
    el.style.setProperty("--rx", ((0.5 - y / r.height) * 8).toFixed(2) + "deg");
  }
}

/* ---------- views ---------- */
function stepper(step, value2) {
  const pf = PLATFORMS.find((p) => p.key === state.pf);
  const steps = [
    { label: "Plataforma", value: step > 1 ? (pf ? pf.label : "Todas") : null, back: () => go({ pf: "", role: "", brand: "", p: null }) },
    { label: "Producto", value: value2, back: () => go({ p: null }) },
    { label: "Compatibilidad" },
  ];
  // Luces de cambio: 5 por paso (verde, amarillo, rojo).
  const leds = h("div", { class: "leds" + (step === 3 ? " full" : ""), "aria-hidden": "true" },
    Array.from({ length: 15 }, (_, k) => h("i", { class: k < step * 5 ? "on" : "", style: `--k:${k}` })));
  return h("nav", { class: "steps", "aria-label": "Pasos" }, leds, steps.map((s, i) => {
    const n = i + 1;
    const inner = [
      h("span", { class: "sn" }, n < step ? icon("check") : "S" + n),
      h("span", { class: "sl" }, h("small", {}, s.label), n <= step && s.value ? h("strong", {}, s.value) : null),
    ];
    if (n < step) return h("button", { class: "step done", type: "button", onclick: s.back, title: "Volver a este paso" }, inner);
    return h("div", { class: "step" + (n === step ? " on" : ""), "aria-current": n === step ? "step" : null }, inner);
  }));
}

// Pista inventada (no es un circuito real) con dos autos que dan vueltas.
const TRACK = "M95 240H380C430 240 450 225 470 195L520 120C535 95 525 60 495 60C470 60 455 75 440 95L400 150C390 165 370 170 355 160L300 120C285 110 265 110 250 120L190 165C175 176 155 176 145 160L110 100C100 82 80 75 62 85C44 96 40 118 48 135L60 185C52 212 64 240 95 240Z";
function circuit() {
  const t = document.createElement("template");
  const p = (cls) => `<path class="${cls}" d="${TRACK}" pathLength="100"/>`;
  t.innerHTML = `<svg class="circuit" viewBox="0 0 600 300" aria-hidden="true">${p("c-track")}${p("c-mid")}` +
    `<path class="c-start" d="M128 232v16"/><path class="c-start b" d="M134 232v16"/>` +
    `${p("c-trail")}${p("c-car")}${p("c-trail b")}${p("c-car b")}</svg>`;
  return t.content.firstChild;
}

function stat(n, label) {
  return h("div", { class: "stat" }, counter("b", null, n), h("span", {}, label));
}

function viewPlatform() {
  const cards = PLATFORMS.map((x, i) => {
    const n = DATA.products.filter((p) => p.pf[x.idx] !== "N").length;
    return h("button", { class: `pf-card fx tilt ${x.key}`, style: `--i:${i}`, onclick: () => go({ pf: x.key, role: "", brand: "", p: null }) },
      h("span", { class: "livery", "aria-hidden": "true" }),
      h("span", { class: "flag", "aria-hidden": "true" }),
      h("span", { class: "pos", "aria-hidden": "true" }, "P" + (i + 1)),
      h("span", { class: "ico" }, icon(x.icon)),
      h("strong", {}, x.label),
      h("span", { class: "n" }, counter("b", null, n), " productos disponibles"),
      h("span", { class: "go" }, icon("arrow")));
  });
  const brands = new Set(DATA.products.map((p) => p.brand).filter(Boolean)).size;
  const roles = new Set(DATA.products.map((p) => p.role)).size;
  return h("section", {},
    stepper(1),
    h("header", { class: "head hero" },
      h("div", { class: "streaks", "aria-hidden": "true" }, Array.from({ length: 6 }, () => h("i"))),
      h("div", {},
        h("p", { class: "eyebrow" }, "Guía de ventas SimRacing"),
        h("h1", {}, "¿En qué ", h("span", { class: "hl" }, "plataforma"), " va a jugar el cliente?"),
        h("p", { class: "lead" }, "Empecemos por ahí: solo verá los productos que funcionan en esa plataforma.")),
      circuit()),
    h("div", { class: "pf-grid" }, cards),
    h("button", { class: "ghost", onclick: () => go({ pf: "all" }) }, icon("grid"), "No sé / ver todo el catálogo"),
    h("div", { class: "stats" },
      stat(DATA.products.length, "productos"), stat(brands, "marcas"), stat(roles, "categorías"),
      h("div", { class: "stat live" }, h("b", {}, fmtDate(DATA.generated)), h("span", {}, "catálogo actualizado"))));
}

function card(p, i) {
  const off = discount(p);
  return h("button", { class: "card fx", style: `--i:${i}`, onclick: () => go({ p: p.id }) },
    h("span", { class: "im" + (p.in_stock ? "" : " out") }, img(p.image, p.name),
      off > 0 && h("span", { class: "off" }, `-${off}%`),
      !p.in_stock && h("span", { class: "ribbon" }, "Agotado")),
    h("span", { class: "tx" },
      h("span", { class: "brandl" }, p.brand),
      h("span", { class: "nm" }, p.name),
      platformBadges(p),
      h("span", { class: "meta" },
        h("span", { class: "pr" }, p.in_stock ? money(p.price) : "Agotado"),
        h("span", { class: "go" }, icon("arrow")))));
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
  const pf = PLATFORMS.find((p) => p.key === state.pf);

  const chips = [h("button", { class: "chip", "aria-pressed": String(!state.role), onclick: () => go({ role: "" }) }, "Todo")]
    .concat(ROLE_ORDER.filter((r) => roleCounts[r]).map((r) =>
      h("button", { class: "chip", "aria-pressed": String(state.role === r), onclick: () => go({ role: r }) }, DATA.roles[r], h("span", { class: "c" }, roleCounts[r]))));
  const brandSel = h("select", { "aria-label": "Marca", onchange: (e) => go({ brand: e.target.value }) },
    h("option", { value: "" }, "Todas las marcas"),
    brands.map((b) => h("option", { value: b, selected: b === state.brand }, b)));

  return h("section", {},
    stepper(2, q ? "Búsqueda" : state.role ? DATA.roles[state.role] : "Todo el catálogo"),
    h("header", { class: "head", "data-num": "02" },
      h("p", { class: "eyebrow" }, pf ? "Plataforma " + pf.label : "Todas las plataformas"),
      h("h1", {}, q
        ? ["Resultados para ", h("span", { class: "hl" }, "«" + state.q.trim() + "»")]
        : ["¿Qué ", h("span", { class: "hl" }, "producto"), " quiere consultar el cliente?"]),
      h("p", { class: "lead" }, "Elija un producto para ver con qué es compatible, qué hay que verificar y qué no sirve.")),
    !q && h("div", { class: "filters roles" }, chips),
    h("div", { class: "toolbar" }, brandSel, h("span", { class: "count" }, h("b", {}, items.length), " productos")),
    items.length ? h("div", { class: "grid" }, items.map(card)) : h("div", { class: "empty" }, "No hay productos con esos filtros."));
}

const whyText = (c) => c.why + (DATA.sources[c.src] ? ` — Fuente: ${DATA.sources[c.src].label}` : "");

function sourceLink(key) {
  const src = DATA.sources[key];
  if (!src) return null;
  const label = `Fuente: ${src.label}`;
  return safeUrl(src.url)
    ? h("a", { class: "src", href: src.url, target: "_blank", rel: "noopener" }, label + " ↗")
    : h("span", { class: "src" }, label);
}

function compatRow(p, c, showWhy) {
  const pfWarn = state.pf && state.pf !== "all" && p.pf[pfIdx()] === "C";
  return h("button", { class: "row", onclick: () => go({ p: p.id }) },
    h("span", { class: "th" }, img(p.image, "")),
    h("span", { class: "rt" },
      h("span", { class: "nm" }, p.name),
      showWhy && h("span", { class: "why" }, whyText(c)),
      pfWarn && h("span", { class: "warn" }, "⚠ En esta plataforma: verificar.")),
    h("span", { class: "pr" }, p.in_stock ? money(p.price) : "Agotado"));
}

// Dentro de cada categoría, la explicación que comparten varios productos se muestra una sola vez.
function compatGroup(role, list) {
  const buckets = new Map();
  list.forEach((r) => {
    const key = r.c.why + "|" + r.c.src;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  });
  const shared = [...buckets.values()].filter((b) => b.length > 1);
  const singles = [...buckets.values()].filter((b) => b.length === 1).flat();
  return h("div", { class: "group" },
    h("h3", { class: "group-h" }, DATA.roles[role], h("span", { class: "gc" }, list.length)),
    shared.map((b) => [
      h("p", { class: "group-why" }, b[0].c.why, " ", sourceLink(b[0].c.src)),
      h("div", { class: "rows" }, b.map(({ p, c }) => compatRow(p, c, false))),
    ]),
    singles.length > 0 && h("div", { class: "rows", style: shared.length ? "margin-top:8px" : null }, singles.map(({ p, c }) => compatRow(p, c, true))));
}

function compatSection(status, rows) {
  const byRole = {};
  rows.forEach((r) => (byRole[r.p.role] = byRole[r.p.role] || []).push(r));
  return h("section", { class: "sec " + status, id: "sec-" + status },
    h("h2", { class: "sec-h" }, h("span", { class: "dot" }), STATUS_LABEL[status], h("span", { class: "cnt" }, rows.length)),
    ROLE_ORDER.filter((r) => byRole[r]).map((r) =>
      compatGroup(r, byRole[r].sort((a, b) => a.p.name.localeCompare(b.p.name)))));
}

function tally(rows) {
  return h("div", { class: "tally" }, ["yes", "check", "no"].map((s) => {
    const n = rows[s].length;
    const jump = () => {
      const sec = document.getElementById("sec-" + s);
      if (sec) sec.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "start" });
    };
    return h("button", { class: "tile " + s, type: "button", disabled: n === 0 ? "" : false, onclick: jump },
      counter("span", "tn", n), h("span", { class: "tl" }, TALLY_LABEL[s]));
  }));
}

function skuChip(sku) {
  const label = h("span", {}, "Copiar");
  const btn = h("button", {
    class: "sku", type: "button", title: "Copiar SKU",
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(sku);
        label.textContent = "Copiado ✓";
        btn.classList.add("ok");
      } catch {
        label.textContent = "No se pudo copiar";
      }
      setTimeout(() => { label.textContent = "Copiar"; btn.classList.remove("ok"); }, 1600);
    },
  }, "SKU ", h("b", {}, sku), icon("copy"), label);
  return btn;
}

function compareBox(p) {
  const list = h("datalist", { id: "all-names" }, DATA.products.filter((x) => x.id !== p.id).map((x) => h("option", { value: x.name })));
  const res = h("div", { class: "res" });
  const input = h("input", {
    type: "text", list: "all-names", placeholder: "Escriba o elija otro producto…",
    oninput: () => {
      const other = DATA.products.find((x) => x.name === input.value);
      res.replaceChildren();
      res.className = "res";
      if (!other) return;
      const c = p.compat.find((x) => x.id === other.id);
      if (!c) {
        res.classList.add("none");
        res.append(h("strong", {}, "Sin relación documentada. "), "No hay información de que estos dos productos se combinen. Consulte con el proveedor.");
        return;
      }
      res.classList.add(c.status);
      res.append(h("strong", {}, STATUS_LABEL[c.status] + ". "), c.why);
    },
  });
  return h("div", { class: "cmp" }, h("label", {}, h("strong", {}, icon("link"), "¿Es compatible con otro producto?"), input), list, res);
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
  const off = discount(p);
  return h("section", {},
    stepper(3, DATA.roles[p.role]),
    h("article", { class: "detail fx" },
      h("span", { class: "flag", "aria-hidden": "true" }),
      h("div", { class: "im" }, img(p.image, p.name), off > 0 && h("span", { class: "off" }, `-${off}%`)),
      h("div", { class: "info" },
        h("p", { class: "eyebrow" }, [p.brand, DATA.roles[p.role]].filter(Boolean).join(" · ")),
        h("h1", { class: "pname" }, p.name),
        p.sku && skuChip(p.sku),
        h("div", { class: "price" }, h("span", { class: "now" }, p.in_stock ? money(p.price) : "Agotado"), p.on_sale && p.regular_price > p.price ? h("s", {}, money(p.regular_price)) : null),
        h("div", { class: "pfs" }, h("span", { class: "lbl" }, "Plataformas"), platformBadges(p, null, "lg")),
        selfWarn && h("div", { class: "note" }, icon("info"), "Este producto no funciona en la plataforma elegida."),
        p.note && h("div", { class: "note" }, icon("info"), p.note),
        h("a", { class: "btn", href: safeUrl(p.url), target: "_blank", rel: "noopener" }, "Ver en intelec.co.cr", icon("ext")),
        compareBox(p))),
    p.compat.length > 0 && tally(rows),
    p.compat.length === 0 && h("div", { class: "empty", style: "margin-top:18px" }, "Aún no hay compatibilidades documentadas para este producto."),
    ["yes", "check", "no"].filter((s) => rows[s].length).map((s) => compatSection(s, rows[s])),
    hidden > 0 && h("p", { class: "hidden-note" }, `${hidden} producto(s) compatibles se ocultan porque no funcionan en la plataforma elegida. `,
      h("button", { class: "pf-all", onclick: () => go({ pf: "all" }) }, "Mostrar todos")));
}

/* ---------- boot ---------- */
// instant: al escribir en el buscador se redibuja sin animaciones de entrada.
function render(opts) {
  const instant = Boolean(opts && opts.instant);
  const app = document.getElementById("app");
  const searching = state.q.trim().length > 0;
  let view;
  if (state.p && !searching) view = viewDetail();
  else if (searching || state.pf) view = viewList();
  else view = viewPlatform();
  const product = state.p && !searching && BY_ID[state.p];
  document.title = product ? `${product.name} · ${TITLE}` : TITLE;
  app.classList.toggle("still", instant);
  app.replaceChildren(view);
  if (!instant) countUp(app);
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
  q.addEventListener("input", () => { state.q = q.value; render({ instant: true }); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && q.value) { q.value = ""; state.q = ""; render({ instant: true }); }
  });
  // «/» lleva al buscador desde cualquier parte, como en GitHub o YouTube.
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  });
  document.addEventListener("pointermove", trackPointer, { passive: true });
  document.getElementById("home").addEventListener("click", () => { q.value = ""; state.q = ""; });
  window.addEventListener("hashchange", () => { readHash(); render(); });
  readHash();
  render();
}
main();
