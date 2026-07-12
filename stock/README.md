# Control de Stock · La Gelateria de Roses

Herramienta interna (PWA) para que el personal controle el stock de sabores y
productos desde el iPad de la tienda. HTML/CSS/JS plano, sin frameworks ni build,
servida por GitHub Pages en **`/stock/`** (p. ej. `https://lagelateriaderoses.com/stock/`).

> No está enlazada desde la web pública y lleva `noindex`. Es una utilidad de trabajo.

## Qué resuelve

- **iPad apaisado → 3 columnas** amplias y legibles (antes se veía apretado).
- **Botones + / − instantáneos**: actualización optimista; el guardado va en segundo plano.
- **Sin pulsaciones perdidas ni duplicadas**; el orden se respeta; 10 toques = 10 unidades.
- **Sin zoom accidental por doble toque** sobre los controles.
- **Persistencia** en el dispositivo (localStorage); sobrevive a recarga, giro y segundo plano.

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | UI (CSS + JS inline). Render inicial una vez; luego cada tarjeta se actualiza aislada. |
| `stock-engine.js` | Motor de cola/optimista. Agnóstico al backend (`persist(id, value)` → Promise). Navegador + Node. |
| `catalog.js` | Catálogo: 35 sabores + 6 productos, con categorías (filtros). |
| `sw.js` | Service Worker (PWA), network-first para no servir versiones antiguas. |
| `manifest.webmanifest` | Instalable en pantalla de inicio del iPad. |
| `test/engine.test.js` | Pruebas del motor (node:test) — 9 escenarios obligatorios. |
| `test/visual.mjs` | Pruebas de layout/interacción con Playwright. |

### Motor de guardado (resumen)

1. Cada toque aplica un **delta** al valor visible **al instante** (optimista).
2. Se marca el artículo "sucio" y arranca un **bucle de flush por artículo**.
3. El flush guarda el **valor absoluto actual** (idempotente): N toques rápidos se
   **consolidan** en una sola escritura del valor final. Artículos distintos se guardan
   en paralelo y no se bloquean entre sí.
4. **Guardia de secuencia** (`opSeq`): una respuesta antigua **nunca** sobrescribe un
   valor más nuevo.
5. Ante fallo: **reintentos con backoff**; si se agotan, se conserva el valor optimista
   y se marca error discreto (botón *Reintentar* en la cabecera). Como el backend real
   es localStorage (fiable y síncrono), este camino solo se ejercita en las pruebas con
   backend simulado; queda listo para una API futura sin tocar la UI.

Regla de negocio: **no se permite stock negativo** (clamp a 0). Cambiable con
`allowNegative: true` en `createStore`.

### Interacción táctil (iPad)

- `touch-action: manipulation` en controles y tarjetas → elimina el zoom por doble
  toque **sin** desactivar el pinch-zoom de accesibilidad global.
- `-webkit-user-select`/`user-select: none`, `-webkit-touch-callout: none`,
  `-webkit-tap-highlight-color: transparent` → sin selección, sin menú copiar/pegar,
  sin resaltado azul.
- La **acción** ocurre en `click` (una vez por toque físico y accesible por teclado);
  el **feedback** de pulsado usa `pointerdown/up` con `.pressed` (~90 ms). No se mezclan
  `click`+`touchstart`+`pointerdown` para la misma acción → cada contacto cuenta una vez.
- Áreas táctiles de 64 px; foco visible; soporte `prefers-reduced-motion`.

## Ejecutar en local

```bash
python3 -m http.server 8099
# abrir http://localhost:8099/stock/
```

## Pruebas

```bash
# Motor (sin dependencias)
node --test stock/test/engine.test.js

# Layout + interacción (Playwright global de la imagen)
node stock/test/visual.mjs      # sirve en http://localhost:8099/stock/
```

## Actualizar la versión en el iPad (importante)

La PWA usa network-first, así que normalmente basta con **recargar**. Si un iPad
conservara una versión antigua tras desplegar:

1. Al publicar cambios, **incrementa `CACHE_VERSION`** en `sw.js` (y `BUILD` en
   `index.html`). Eso invalida el caché anterior.
2. En el iPad: cerrar la app/pestaña y volver a abrir; o *Ajustes → Safari → Borrar
   historial y datos* si estuviera muy cacheada.
3. Verifica la versión activa en el **pie de la app** ("stock vX.Y.Z").
