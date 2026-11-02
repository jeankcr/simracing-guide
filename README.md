# Guía de Compatibilidad SimRacing (Intelec)

Herramienta interna para los vendedores de Intelec: se elige la plataforma (PC / PlayStation / Xbox),
luego un producto, y se ve con qué es compatible, qué hay que verificar y qué no es compatible.

## Cómo funciona

```
API de WooCommerce de Intelec ──crawler/crawl.py──▶ data/products.json ─┐
                                                                         ├─ crawler/build.py ─▶ site/data.json ─▶ site/ (página estática)
            data/knowledge.json (compatibilidades revisadas) ───────────┘
```

- `crawler/crawl.py` descarga todo el catálogo desde la API pública (`/wp-json/wc/store/v1/products`). No se raspa HTML.
- `data/knowledge.json` es la base de conocimiento de compatibilidades, armada con la documentación de los
  fabricantes (matriz oficial de MOZA, especificaciones de Simagic y Logitech) y las fichas de los productos.
- `crawler/build.py` une ambos archivos y genera `site/data.json`. Los productos que aún no estén en
  `knowledge.json` aparecen marcados como nuevos y el comando los lista.
- `site/` es HTML/CSS/JS puro, sin dependencias.

## Usarla en su computadora

```
python servidor.py
```

- Guía de ventas: http://localhost:8000
- Editor de compatibilidades: http://localhost:8000/editor.html

Para actualizar el catálogo manualmente: `python crawler/crawl.py` y luego `python crawler/build.py`.

## Editor de compatibilidades (con contraseña)

1. Defina la contraseña una sola vez: `python establecer_clave.py`. Se guarda solo una huella cifrada en `site/editor-config.json`.
2. Abra el editor, entre con la contraseña y corrija productos, plataformas, etiquetas, relaciones y reglas.
3. **Guardar**:
   - Con `python servidor.py` activo, guarda directo en `data/knowledge.json` y regenera la guía (deja una copia de seguridad en `data/knowledge.respaldo.json`).
   - En la versión publicada, descarga `knowledge.json`; hay que subirlo al repositorio reemplazando `data/knowledge.json`.

**Sobre la seguridad de la contraseña:** en su computadora, el servidor exige la contraseña en cada lectura y
escritura (protección real). En la versión publicada en GitHub Pages, la contraseña solo bloquea el acceso
casual, porque un sitio estático no puede esconder sus propios archivos. Lo que realmente protege los datos
publicados es que subir cambios requiere acceso de escritura al repositorio de GitHub. Use una contraseña
exclusiva (no la reutilice).

## Publicación gratuita (GitHub Pages)

1. Cree un repositorio en GitHub y suba esta carpeta a la rama `main`.
2. En **Settings → Pages**, elija **Source: GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` descarga el catálogo, genera los datos y publica en cada cambio y todas las noches.

Nota: un sitio gratuito de GitHub Pages es accesible para cualquiera que tenga el enlace (la página lleva
`noindex`, así que no aparece en buscadores). El catálogo y los precios ya son públicos en intelec.co.cr.

## Mantenimiento de las compatibilidades

Cuando Intelec agregue un producto, la generación nocturna lo marca como «sin clasificar». Ábralo en el editor
(filtro «Solo sin clasificar»), asígnele categoría, plataformas y etiquetas, y revise sus relaciones. Si tiene dudas,
use «Verificar» en lugar de «Compatible».

Estructura de `data/knowledge.json`: `products` (categoría, plataformas `PC,Xbox,PlayStation` con `Y`/`C`/`N`, etiquetas y nota por
producto), `rules` (reglas entre etiquetas: `yes`, `check`, `no`), `overrides` (excepciones para un par de productos) y `sources`.
