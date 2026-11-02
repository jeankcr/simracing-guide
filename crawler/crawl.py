"""Descarga el catálogo de simuladores de Intelec desde la API pública de WooCommerce.

Escribe data/products.json (limpio, una entrada por producto).
Uso: python crawler/crawl.py
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://www.intelec.co.cr/wp-json/wc/store/v1/products"
CATEGORY = "simuladores"  # categoría padre; WooCommerce incluye las subcategorías
PER_PAGE = 100
OUT = Path(__file__).resolve().parent.parent / "data" / "products.json"
UA = "Mozilla/5.0 (compatible; IntelecSimGuide/1.0; internal seller tool)"


def fetch(page):
    url = f"{BASE}?per_page={PER_PAGE}&page={page}&category={CATEGORY}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def text_of(fragment):
    # Títulos, párrafos y listas pasan a saltos de línea para separar las especificaciones.
    fragment = re.sub(r"</(p|li|h\d|div|section|tr)>|<br\s*/?>", "\n", fragment or "")
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment)
    lines = [re.sub(r"[ \t ]+", " ", l).strip() for l in fragment.split("\n")]
    return "\n".join(l for l in lines if l)


def clean(p):
    prices = p.get("prices") or {}
    minor = int(prices.get("currency_minor_unit", 0))
    div = 10 ** minor

    def money(v):
        return int(v) / div if v not in (None, "") else None

    attrs = {a["name"]: [t["name"] for t in a.get("terms", [])] for a in p.get("attributes", [])}
    return {
        "id": p["id"],
        "name": html.unescape(p["name"]),
        "sku": p.get("sku") or "",
        "url": p["permalink"],
        "type": p.get("type"),
        "brand": (attrs.get("Marca") or [""])[0],
        "categories": [html.unescape(c["name"]) for c in p.get("categories", [])],
        "price": money(prices.get("price")),
        "regular_price": money(prices.get("regular_price")),
        "on_sale": p.get("on_sale", False),
        "in_stock": p.get("is_in_stock", True),
        "image": (p.get("images") or [{}])[0].get("src", ""),
        "summary": text_of(p.get("short_description")),
        "description": text_of(p.get("description")),
    }


def main():
    products, page = [], 1
    while True:
        batch = fetch(page)
        products += batch
        if len(batch) < PER_PAGE:
            break
        page += 1
        time.sleep(1)  # pausa cortés entre páginas
    if not products:
        sys.exit("La API no devolvió productos; se conserva el archivo de datos anterior.")
    cleaned = sorted((clean(p) for p in products), key=lambda x: x["name"])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(cleaned, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Se guardaron {len(cleaned)} productos en {OUT}")


if __name__ == "__main__":
    main()
