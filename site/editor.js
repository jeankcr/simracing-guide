"use strict";

const ESTADOS = { yes: "Compatible", check: "Verificar", no: "No compatible", none: "Sin relación (quitar)" };
const PLATAFORMAS = ["PC", "Xbox", "PlayStation"];
const OPCIONES_PF = [["Y", "Sí"], ["C", "Verificar"], ["N", "No"]];
const GRAVEDAD = { yes: 0, check: 1, no: 2 };

let K, P, POR_ID, local = false, sucio = false, sel = null, pestana = "productos";
let filtro = "", soloNuevos = false, filtroReglas = "", aviso = null;
const reglasAbiertas = new WeakSet(); // reglas cuyos productos están desplegados

/* ---------- utilidades ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const entrada = (id) => K.products[String(id)];
const etiquetasDe = (id) => new Set(entrada(id) ? entrada(id).tags : []);
const todasLasEtiquetas = () => {
  const s = new Set();
  Object.values(K.products).forEach((e) => e.tags.forEach((t) => s.add(t)));
  K.rules.forEach((r) => { if (r.a) s.add(r.a); if (r.b) s.add(r.b); });
  return [...s].sort();
};

function asegurarEntrada(id) {
  if (!entrada(id)) {
    const p = POR_ID[id];
    K.products[String(id)] = { role: p.role === "other" ? "rig" : p.role, tags: [], pf: "CCC", note: "" };
  }
  return entrada(id);
}
function marcarSucio() {
  sucio = true;
  pintarEstado();
}
function pintarEstado() {
  const el = document.getElementById("estado");
  el.className = "estado" + (sucio ? " sucio" : "");
  el.textContent = sucio ? "● Cambios sin guardar" : "Sin cambios";
  document.getElementById("guardar").disabled = !sucio;
  document.getElementById("descartar").disabled = !sucio;
}

/* ---------- cálculo de compatibilidad (igual que crawler/build.py) ---------- */
function compatDe(pid) {
  const ta = etiquetasDe(pid), salida = new Map();
  for (const o of P) {
    if (o.id === pid) continue;
    const tb = etiquetasDe(o.id);
    let mejor = null;
    for (const r of K.rules) {
      if ((ta.has(r.a) && tb.has(r.b)) || (ta.has(r.b) && tb.has(r.a))) {
        if (!mejor || GRAVEDAD[r.status] > GRAVEDAD[mejor.status]) mejor = r;
      }
    }
    if (mejor) salida.set(o.id, { status: mejor.status, why: mejor.why, via: `Regla: ${mejor.a} ↔ ${mejor.b}` });
  }
  for (const x of K.overrides) {
    const a = Number(x.a), b = Number(x.b);
    const otro = a === pid ? b : b === pid ? a : null;
    if (otro == null) continue;
    if (x.status === "none") salida.delete(otro);
    else salida.set(otro, { status: x.status, why: x.why, via: "Excepción manual" });
  }
  return salida;
}
function ponerExcepcion(a, b, status, why) {
  K.overrides = K.overrides.filter((x) => !((Number(x.a) === a && Number(x.b) === b) || (Number(x.a) === b && Number(x.b) === a)));
  K.overrides.push({ a, b, status, why: why || "Definido manualmente", src: "manual" });
  marcarSucio();
}
function quitarExcepcion(a, b) {
  K.overrides = K.overrides.filter((x) => !((Number(x.a) === a && Number(x.b) === b) || (Number(x.a) === b && Number(x.b) === a)));
  marcarSucio();
}

/* ---------- guardar ---------- */
function serializar(k) {
  const copia = { ...k, products: "__P__", rules: "__R__" };
  let s = JSON.stringify(copia, null, 2);
  s = s.replace('"__P__"', "{\n" + Object.entries(k.products).map(([id, v]) => `    "${id}": ${JSON.stringify(v)}`).join(",\n") + "\n  }");
  s = s.replace('"__R__"', "[\n" + k.rules.map((r) => "    " + JSON.stringify(r)).join(",\n") + "\n  ]");
  return s + "\n";
}
function validar() {
  const mal = K.rules.findIndex((r) => !r.a || !r.b || !r.why);
  if (mal >= 0) return `La regla #${mal + 1} está incompleta (faltan etiquetas o el motivo).`;
  return null;
}
async function guardar() {
  const problema = validar();
  if (problema) { mostrarAviso("error", problema); return; }
  if (!K.sources.manual) K.sources.manual = { label: "Verificado por Intelec", url: "" };
  const texto = serializar(K);
  if (local) {
    try {
      const r = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json", "X-Clave": CLAVE }, body: texto });
      const res = await r.json();
      if (!res.ok) throw new Error(res.mensaje);
      sucio = false;
      mostrarAviso("ok", "Guardado en data/knowledge.json y guía regenerada. Recargue la guía para ver los cambios. " + res.mensaje);
    } catch (e) {
      mostrarAviso("error", "No se pudo guardar: " + e.message);
    }
  } else {
    const a = h("a", { href: URL.createObjectURL(new Blob([texto], { type: "application/json" })), download: "knowledge.json" });
    document.body.append(a); a.click(); a.remove();
    sucio = false;
    mostrarAviso("ok", "Se descargó knowledge.json. Para publicarlo: reemplace el archivo data/knowledge.json del repositorio de GitHub (Add file → Upload files) y confirme el cambio; la guía se actualiza sola en unos minutos.");
  }
  pintarEstado();
}
function mostrarAviso(tipo, texto) {
  aviso = { tipo, texto };
  dibujar();
}

/* ---------- pestaña: productos ---------- */
function listaProductos() {
  const q = norm(filtro);
  const items = P.filter((p) => (!soloNuevos || !entrada(p.id)) && (!q || norm(p.name + " " + p.brand + " " + (p.sku || "")).includes(q)));
  const nuevos = P.filter((p) => !entrada(p.id)).length;
  return h("aside", { class: "lista-prod" },
    h("input", { type: "search", placeholder: "Buscar producto…", value: filtro, "aria-label": "Buscar producto", oninput: (e) => { filtro = e.target.value; repintarItems(); } }),
    h("label", { class: "chk" }, h("input", { type: "checkbox", checked: soloNuevos ? "" : null, onchange: (e) => { soloNuevos = e.target.checked; repintarItems(); } }), ` Solo sin clasificar (${nuevos})`),
    h("div", { class: "items", id: "items" }, itemsDe(items)));
}
function itemsDe(items) {
  return items.map((p) => h("button", { class: "item", type: "button", "aria-current": String(p.id === sel), onclick: () => { sel = p.id; dibujar(); } },
    (!entrada(p.id) ? "● " : "") + p.name, h("small", {}, `${K.roles[(entrada(p.id) || p).role] || "—"} · ${p.brand}`)));
}
function repintarItems() {
  const q = norm(filtro);
  const items = P.filter((p) => (!soloNuevos || !entrada(p.id)) && (!q || norm(p.name + " " + p.brand + " " + (p.sku || "")).includes(q)));
  document.getElementById("items").replaceChildren(...itemsDe(items));
}

function panelProducto() {
  const p = POR_ID[sel];
  if (!p) return h("div", { class: "panel" }, h("p", { class: "ayuda" }, "Elija un producto de la lista para ver y corregir su información."));
  const e = entrada(sel) || { role: p.role, tags: [], pf: "CCC", note: "" };
  const nuevo = !entrada(sel);

  const campoPlataforma = (i) => h("div", { class: "campo" }, h("label", {}, PLATAFORMAS[i]),
    h("select", { onchange: (ev) => { const x = asegurarEntrada(sel); x.pf = x.pf.slice(0, i) + ev.target.value + x.pf.slice(i + 1); marcarSucio(); dibujar(); } },
      OPCIONES_PF.map(([v, t]) => h("option", { value: v, selected: e.pf[i] === v ? "" : null }, t))));

  const chips = h("div", { class: "chips" }, e.tags.map((t) => h("span", { class: "tagchip" }, t,
    h("button", { type: "button", "aria-label": "Quitar etiqueta " + t, onclick: () => { const x = asegurarEntrada(sel); x.tags = x.tags.filter((y) => y !== t); marcarSucio(); dibujar(); } }, "×"))));
  const nueva = h("input", {
    list: "dl-etiquetas", placeholder: "Agregar etiqueta (Enter)…",
    onkeydown: (ev) => {
      if (ev.key !== "Enter") return;
      const t = ev.target.value.trim().toLowerCase().replace(/\s+/g, "-");
      if (!t) return;
      const x = asegurarEntrada(sel);
      if (!x.tags.includes(t)) x.tags.push(t);
      marcarSucio(); dibujar();
    },
  });

  return h("div", { class: "panel" },
    h("h1", {}, p.name),
    h("p", { class: "ayuda" }, `ID ${p.id} · ${p.brand} · SKU ${p.sku || "—"} · `, h("a", { href: p.url, target: "_blank", rel: "noopener" }, "ver en intelec.co.cr ↗"),
      nuevo ? "  ·  ● Producto nuevo: aún sin clasificar" : ""),

    h("h2", {}, "1. Datos del producto"),
    h("div", { class: "campos" },
      h("div", { class: "campo" }, h("label", {}, "Categoría en la guía"),
        h("select", { onchange: (ev) => { asegurarEntrada(sel).role = ev.target.value; marcarSucio(); dibujar(); } },
          Object.entries(K.roles).map(([v, t]) => h("option", { value: v, selected: e.role === v ? "" : null }, t)))),
      [0, 1, 2].map(campoPlataforma),
      h("div", { class: "campo ancho" }, h("label", {}, "Nota visible para el vendedor (opcional)"),
        h("textarea", { onchange: (ev) => { asegurarEntrada(sel).note = ev.target.value; marcarSucio(); } }, e.note))),

    h("h2", {}, "2. Etiquetas"),
    h("p", { class: "ayuda" }, "Las etiquetas agrupan productos para aplicarles reglas en bloque (por ejemplo, todos los volantes MOZA comparten «moza-wheel»). Si solo quiere corregir una relación puntual, use la sección 3 y no toque las etiquetas."),
    chips, h("div", { class: "campo", style: "max-width:320px" }, nueva),

    h("h2", {}, "3. Compatibilidad con otros productos"),
    h("p", { class: "ayuda" }, "Cambiar el estado o el motivo de una fila crea una «excepción manual» solo para ese par de productos."),
    filasCompat(),
    formularioAgregar(),
    filasQuitadas());
}

function filasCompat() {
  const mapa = compatDe(sel);
  const filas = [...mapa.entries()].map(([id, c]) => ({ p: POR_ID[id], c }))
    .sort((x, y) => GRAVEDAD[y.c.status] - GRAVEDAD[x.c.status] || x.p.name.localeCompare(y.p.name));
  if (!filas.length) return h("p", { class: "ayuda" }, "Todavía no hay compatibilidades registradas para este producto.");
  return filas.map(({ p, c }) => h("div", { class: "fila" },
    h("button", { class: "nom est-" + c.status, type: "button", onclick: () => { sel = p.id; dibujar(); } }, p.name, h("small", {}, K.roles[(entrada(p.id) || p).role])),
    h("select", { "aria-label": "Estado", onchange: (ev) => { ponerExcepcion(sel, p.id, ev.target.value, c.why); dibujar(); } },
      Object.entries(ESTADOS).map(([v, t]) => h("option", { value: v, selected: c.status === v ? "" : null }, t))),
    h("input", { value: c.why, "aria-label": "Motivo", onchange: (ev) => { ponerExcepcion(sel, p.id, c.status, ev.target.value); dibujar(); } }),
    h("div", { class: "origen" }, c.via + " · ", h("a", { href: p.url, target: "_blank", rel: "noopener" }, "ver en intelec.co.cr ↗"))));
}

function formularioAgregar() {
  const lista = h("datalist", { id: "dl-productos" }, P.filter((x) => x.id !== sel).map((x) => h("option", { value: x.name })));
  const prod = h("input", { list: "dl-productos", placeholder: "Escriba el nombre…" });
  const est = h("select", {}, ["yes", "check", "no"].map((v) => h("option", { value: v }, ESTADOS[v])));
  const why = h("input", { placeholder: "Motivo que verá el vendedor" });
  const msg = h("span", { class: "ayuda" });
  return h("div", {},
    h("div", { class: "agregar" },
      h("div", {}, h("label", {}, "Agregar relación con"), prod),
      h("div", {}, h("label", {}, "Estado"), est),
      h("div", {}, h("label", {}, "Motivo"), why),
      h("button", { class: "btn-ed", type: "button", onclick: () => {
        const otro = P.find((x) => x.name === prod.value);
        if (!otro) { msg.textContent = "Elija un producto de la lista."; return; }
        if (!why.value.trim()) { msg.textContent = "Escriba el motivo."; return; }
        ponerExcepcion(sel, otro.id, est.value, why.value.trim()); dibujar();
      } }, "Agregar")),
    msg, lista);
}

function filasQuitadas() {
  const quitadas = K.overrides.filter((x) => x.status === "none" && (Number(x.a) === sel || Number(x.b) === sel));
  if (!quitadas.length) return null;
  return h("div", {}, h("h2", {}, "Relaciones quitadas a mano"),
    quitadas.map((x) => {
      const otro = POR_ID[Number(x.a) === sel ? Number(x.b) : Number(x.a)];
      return h("div", { class: "fila" }, h("span", { class: "nom" }, otro ? otro.name : "(producto desconocido)"),
        h("span", {}, "Sin relación"),
        h("button", { class: "btn-ed chico", type: "button", onclick: () => { quitarExcepcion(Number(x.a), Number(x.b)); dibujar(); } }, "Restaurar regla original"));
    }));
}

/* ---------- pestaña: reglas ---------- */
function pestanaReglas() {
  const q = norm(filtroReglas);
  const filas = K.rules.map((r, i) => [r, i]).filter(([r]) => !q || norm(`${r.a} ${r.b} ${r.why}`).includes(q));
  return h("div", { class: "panel" },
    h("h1", {}, "Reglas por etiqueta"),
    h("p", { class: "ayuda" }, "Una regla dice: «todo producto con la etiqueta A es compatible (o hay que verificar, o no es compatible) con todo producto con la etiqueta B». Si un par tiene varias reglas, gana la más cautelosa (No compatible, luego Verificar, luego Compatible). Despliegue «Ver productos» bajo cada regla para ver qué productos tienen cada etiqueta; haga clic en un nombre para abrirlo o en ↗ para ver su página en Intelec."),
    h("div", { class: "campos" },
      h("div", { class: "campo" }, h("label", {}, "Filtrar reglas"), h("input", { type: "search", value: filtroReglas, placeholder: "Etiqueta o texto…", oninput: (e) => { filtroReglas = e.target.value; clearTimeout(pestanaReglas.t); pestanaReglas.t = setTimeout(dibujar, 250); } })),
      h("div", { class: "campo" }, h("label", {}, " "), h("button", { class: "btn-ed", type: "button", onclick: () => { K.rules.unshift({ a: "", b: "", status: "check", why: "", src: "manual" }); filtroReglas = ""; marcarSucio(); dibujar(); } }, "+ Nueva regla"))),
    h("datalist", { id: "dl-etiquetas" }, todasLasEtiquetas().map((t) => h("option", { value: t }))),
    h("div", { class: "regla regla-cab" }, h("span", {}, "Etiqueta A"), h("span", {}, "Etiqueta B"), h("span", {}, "Estado"), h("span", {}, "Motivo"), h("span", {}, "Fuente"), h("span", {})),
    filas.map(([r, i]) => h("div", { class: "regla" },
      h("input", { list: "dl-etiquetas", value: r.a, "aria-label": "Etiqueta A", onchange: (e) => { r.a = e.target.value.trim(); marcarSucio(); dibujar(); } }),
      h("input", { list: "dl-etiquetas", value: r.b, "aria-label": "Etiqueta B", onchange: (e) => { r.b = e.target.value.trim(); marcarSucio(); dibujar(); } }),
      h("select", { "aria-label": "Estado", onchange: (e) => { r.status = e.target.value; marcarSucio(); } },
        ["yes", "check", "no"].map((v) => h("option", { value: v, selected: r.status === v ? "" : null }, ESTADOS[v]))),
      h("input", { value: r.why, "aria-label": "Motivo", onchange: (e) => { r.why = e.target.value; marcarSucio(); } }),
      h("select", { "aria-label": "Fuente", onchange: (e) => { r.src = e.target.value; marcarSucio(); } },
        Object.entries({ manual: { label: "Verificado por Intelec" }, ...K.sources }).map(([v, s]) => h("option", { value: v, selected: (r.src || "manual") === v ? "" : null }, s.label))),
      h("button", { class: "btn-ed chico peligro", type: "button", onclick: () => { K.rules.splice(i, 1); marcarSucio(); dibujar(); } }, "Eliminar"),
      h("details", { class: "prods-det", open: reglasAbiertas.has(r) ? "" : null, ontoggle: (e) => { e.target.open ? reglasAbiertas.add(r) : reglasAbiertas.delete(r); } },
        h("summary", {}, `Ver productos (A: ${productosConEtiqueta(r.a).length} · B: ${productosConEtiqueta(r.b).length})`),
        h("div", { class: "prods" }, gruposProductos("A", r.a), gruposProductos("B", r.b))))));
}

function productosConEtiqueta(tag) {
  return P.filter((p) => entrada(p.id) && entrada(p.id).tags.includes(tag));
}
function gruposProductos(letra, tag) {
  const lista = tag ? productosConEtiqueta(tag) : [];
  return h("div", { class: "grupo-prods" },
    h("span", { class: "g-tit" }, `${letra} (${tag || "sin etiqueta"}): ${lista.length} producto(s)`),
    h("div", { class: "g-lista" }, lista.length
      ? lista.map((p) => h("span", { class: "item-prod" },
        h("button", { class: "enlace-prod", type: "button", title: "Abrir este producto en el editor", onclick: () => { pestana = "productos"; sel = p.id; dibujar(); } }, p.name),
        h("a", { class: "enlace-ext", href: p.url, target: "_blank", rel: "noopener", title: "Ver en intelec.co.cr (pestaña nueva)", "aria-label": "Ver " + p.name + " en intelec.co.cr" }, "↗")))
      : h("span", { class: "ayuda" }, "Ningún producto tiene esta etiqueta.")));
}

/* ---------- armado de la página ---------- */
function dibujar() {
  const app = document.getElementById("app");
  const y = window.scrollY;
  const cuerpo = pestana === "productos"
    ? h("div", { class: "ed-grid" }, listaProductos(), h("div", {}, panelProducto(), h("datalist", { id: "dl-etiquetas" }, todasLasEtiquetas().map((t) => h("option", { value: t })))))
    : pestanaReglas();
  app.replaceChildren(...[
    aviso && h("div", { class: "note", style: aviso.tipo === "ok" ? "background:var(--yes-bg);color:var(--yes)" : "background:var(--no-bg);color:var(--no)", role: "status" }, aviso.texto),
    !local && h("div", { class: "note", style: "margin-bottom:12px" }, "Modo en línea: «Guardar» descarga un archivo knowledge.json que luego debe subir al repositorio. Para guardar directamente, ejecute «python servidor.py» en su computadora y abra http://localhost:8000/editor.html."),
    h("div", { class: "tabs", role: "tablist" },
      h("button", { class: "tab", role: "tab", "aria-selected": String(pestana === "productos"), onclick: () => { pestana = "productos"; dibujar(); } }, "Productos"),
      h("button", { class: "tab", role: "tab", "aria-selected": String(pestana === "reglas"), onclick: () => { pestana = "reglas"; dibujar(); } }, `Reglas (${K.rules.length})`)),
    cuerpo].filter(Boolean));
  window.scrollTo(0, y);
  pintarEstado();
}

/* ---------- contraseña ---------- */
let CLAVE = "";

async function huella(clave, cfg) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
  const sal = Uint8Array.from(cfg.sal.match(/../g).map((b) => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: cfg.iteraciones }, base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pantallaClave(cfg, mensaje) {
  const entrada = h("input", { type: "password", autocomplete: "current-password", "aria-label": "Contraseña", placeholder: "Contraseña del editor", autofocus: "" });
  const error = h("p", { class: "ayuda", style: "color:var(--no)" }, mensaje || "");
  const enviar = async (ev) => {
    ev.preventDefault();
    if ((await huella(entrada.value, cfg)) !== cfg.hash) { error.textContent = "Contraseña incorrecta."; entrada.select(); return; }
    CLAVE = entrada.value;
    try { sessionStorage.setItem("clave-editor", CLAVE); } catch (e) { /* sin almacenamiento: se pedirá de nuevo */ }
    iniciar();
  };
  document.getElementById("app").replaceChildren(
    h("form", { class: "panel", style: "max-width:380px;margin:40px auto", onsubmit: enviar },
      h("h1", {}, "Acceso al editor"),
      h("p", { class: "ayuda" }, "Escriba la contraseña para editar las compatibilidades."),
      h("div", { class: "campo" }, entrada), error,
      h("button", { class: "btn-ed primario", type: "submit", style: "margin-top:10px" }, "Entrar")));
  entrada.focus();
}

async function principal() {
  document.getElementById("guardar").style.visibility = "hidden";
  document.getElementById("descartar").style.visibility = "hidden";
  let cfg;
  try {
    cfg = await fetch("editor-config.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject()));
  } catch (e) {
    document.getElementById("app").replaceChildren(h("div", { class: "panel" }, h("h1", {}, "Editor no configurado"),
      h("p", { class: "ayuda" }, "Todavía no se ha definido una contraseña. Ejecute «python establecer_clave.py» en la carpeta del proyecto y publique el archivo site/editor-config.json.")));
    return;
  }
  let guardada = "";
  try { guardada = sessionStorage.getItem("clave-editor") || ""; } catch (e) { /* sin almacenamiento */ }
  if (guardada && (await huella(guardada, cfg)) === cfg.hash) { CLAVE = guardada; iniciar(); }
  else pantallaClave(cfg);
}

async function iniciar() {
  try {
    local = await fetch("/api/ping").then((r) => r.ok).catch(() => false);
    const pedirK = local
      ? fetch("/api/knowledge", { headers: { "X-Clave": CLAVE }, cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Contraseña rechazada por el servidor."))))
      : fetch("knowledge.json", { cache: "no-store" }).then((r) => r.json());
    const [k, d] = await Promise.all([pedirK, fetch("data.json", { cache: "no-store" }).then((r) => r.json())]);
    K = k; K.overrides = K.overrides || [];
    P = d.products; POR_ID = Object.fromEntries(P.map((p) => [p.id, p]));
  } catch (e) {
    document.getElementById("app").textContent = "No se pudieron cargar los datos. " + e.message;
    return;
  }
  const enlace = location.hash.match(/p=(\d+)/);
  if (enlace && POR_ID[enlace[1]]) sel = Number(enlace[1]);
  document.getElementById("guardar").style.visibility = "";
  document.getElementById("descartar").style.visibility = "";
  document.getElementById("guardar").addEventListener("click", guardar);
  document.getElementById("descartar").addEventListener("click", () => location.reload());
  window.addEventListener("beforeunload", (ev) => { if (sucio) { ev.preventDefault(); ev.returnValue = ""; } });
  dibujar();
}
principal();
