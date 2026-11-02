"""Une data/products.json con data/knowledge.json y genera site/data.json.

La compatibilidad entre dos productos sale de las `rules` (pares de etiquetas).
Un par puede cumplir varias reglas; gana el estado más cauteloso (no > check > yes).
Las `overrides` reemplazan el resultado para un par exacto de productos.
Uso: python crawler/build.py
"""
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PRODUCTOS = RAIZ / "data" / "products.json"
CONOCIMIENTO = RAIZ / "data" / "knowledge.json"
SALIDA = RAIZ / "site" / "data.json"
COPIA_EDITOR = RAIZ / "site" / "knowledge.json"  # el editor en línea lee esta copia

GRAVEDAD = {"yes": 0, "check": 1, "no": 2}
ROL_INTELEC = {
    "Bases de Volantes": "base", "Volantes": "wheel", "Pedales": "pedals",
    "Bundles": "bundle", "Aviación": "flight", "Estructuras de Simuladores": "rig",
}


def main():
    productos = json.loads(PRODUCTOS.read_text(encoding="utf-8"))
    kb = json.loads(CONOCIMIENTO.read_text(encoding="utf-8"))
    conocidos = kb["products"]

    por_id = {str(p["id"]): p for p in productos}
    for pid in conocidos:
        if pid not in por_id:
            print(f"aviso: knowledge.json menciona el id {pid}, que ya no está en el catálogo", file=sys.stderr)

    etiquetas, items, sin_clasificar = {}, [], []
    for p in productos:
        pid = str(p["id"])
        k = conocidos.get(pid)
        if k is None:
            sin_clasificar.append(p["name"])
            rol = next((ROL_INTELEC[c] for c in p["categories"] if c in ROL_INTELEC), "other")
            k = {"role": rol, "tags": [], "pf": "CCC", "note": "Producto nuevo: aún sin clasificar ni reglas de compatibilidad."}
        etiquetas[pid] = set(k["tags"])
        items.append({
            "id": p["id"], "name": p["name"], "brand": p["brand"], "sku": p["sku"], "url": p["url"],
            "price": p["price"], "regular_price": p["regular_price"], "on_sale": p["on_sale"],
            "in_stock": p["in_stock"], "image": p["image"],
            "role": k["role"], "pf": k["pf"], "note": k["note"], "new": pid not in conocidos,
            "compat": [],
        })
    indice = {str(i["id"]): i for i in items}

    ids = list(indice)
    for n, a in enumerate(ids):
        for b in ids[n + 1:]:
            mejor = None
            for r in kb["rules"]:
                if (r["a"] in etiquetas[a] and r["b"] in etiquetas[b]) or (r["a"] in etiquetas[b] and r["b"] in etiquetas[a]):
                    if mejor is None or GRAVEDAD[r["status"]] > GRAVEDAD[mejor["status"]]:
                        mejor = r
            if mejor:
                enlace = {"status": mejor["status"], "why": mejor["why"], "src": mejor.get("src", "")}
                indice[a]["compat"].append({"id": indice[b]["id"], **enlace})
                indice[b]["compat"].append({"id": indice[a]["id"], **enlace})

    for o in kb.get("overrides", []):
        a, b = str(o["a"]), str(o["b"])
        if a not in indice or b not in indice:
            print(f"aviso: una excepción menciona un producto que ya no existe ({a}, {b})", file=sys.stderr)
            continue
        for x, y in ((a, b), (b, a)):
            indice[x]["compat"] = [c for c in indice[x]["compat"] if str(c["id"]) != y]
            if o["status"] != "none":
                indice[x]["compat"].append({"id": indice[y]["id"], "status": o["status"], "why": o["why"], "src": o.get("src", "")})

    salida = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "roles": kb["roles"],
        "sources": kb["sources"],
        "products": sorted(items, key=lambda i: i["name"]),
    }
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    shutil.copyfile(CONOCIMIENTO, COPIA_EDITOR)
    enlaces = sum(len(i["compat"]) for i in items) // 2
    print(f"Listo: {len(items)} productos y {enlaces} relaciones de compatibilidad.")
    if sin_clasificar:
        print("Productos nuevos sin clasificar:", *sin_clasificar, sep="\n  - ")


if __name__ == "__main__":
    main()
