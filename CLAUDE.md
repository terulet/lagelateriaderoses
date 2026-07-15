# CLAUDE.md — La Gelateria de Roses

## Reglas fijas (no negociables)

- **Sin frameworks ni build**: HTML/CSS/JS planos. Sin npm, webpack, bundlers, preprocesadores ni dependencias. Compatible con GitHub Pages de forma directa (push → live).
- **6 idiomas siempre en paralelo**: cualquier texto nuevo, cambio de copy o sección añadida se replica en los 6 archivos (ES, CA, FR, EN, DE, NL). No se acepta texto sólo en un idioma.
- **No romper nada existente**: URLs canónicas, anclas internas, hreflang, GTM (si se añade), botones de WhatsApp, enlace QR de Google Reviews y enlace "Dejar reseña".
- **Mobile-first**: validar cada cambio a 390 px de ancho antes que en escritorio.
- **Rutas de imágenes relativas y simples**: usar `/assets/img/nombre-archivo.ext` (ruta absoluta desde raíz del dominio). El patrón de nombre es `img-NN-[hash].[ext]`. No cambiar nombres de archivos existentes.

---

## Estructura de archivos

```
/                          ← Raíz del repo = raíz de GitHub Pages
│
├── index.html             ← Versión ES (página principal, hreflang x-default)
├── ca/index.html          ← Versión CA
├── en/index.html          ← Versión EN
├── fr/index.html          ← Versión FR (principal FR)
├── fr/glacier-roses/index.html           ← Subpágina SEO FR
├── fr/meilleures-plages-roses/index.html ← Subpágina SEO FR
├── fr/meilleur-glacier-roses/index.html  ← Subpágina SEO FR
├── fr/que-faire-a-roses/index.html       ← Subpágina SEO FR
├── nl/index.html          ← Versión NL
├── de/index.html          ← Versión DE
│
├── assets/img/            ← TODAS las imágenes (54 archivos)
│   ├── img-01-*.png       ← Logo (PNG, ~203 KB)
│   ├── img-02-*.jpg       ← Hero background
│   ├── img-03 a img-06    ← Sección Experience (4 tarjetas)
│   ├── img-07 a img-41    ← Carrusel de sabores (35 slides)
│   ├── img-42 a img-47    ← Productos (6 tarjetas + modales)
│   └── img-48 a img-54    ← Galería (7 fotos)
│
├── css/                   ← Carpeta vacía (placeholder)
├── js/                    ← Carpeta vacía (placeholder)
├── images/                ← Carpeta vacía (placeholder)
│
├── CNAME                  ← lagelateriaderoses.com
├── sitemap.xml            ← 6 URLs (ES + CA + EN + FR + NL + DE)
├── robots.txt
└── README-SUBIR-A-GITHUB.txt
```

**Importante:** `css/`, `js/` e `images/` están vacías (solo tienen `test.txt`). No son carpetas en uso. Todo el CSS y JS está **inline** dentro de cada `index.html`.

---

## Sistema de idiomas

### Arquitectura

Cada versión de idioma es un **archivo HTML completo e independiente**. No hay un sistema de plantillas: los 6 archivos tienen el mismo HTML estructural, el mismo CSS y el mismo JS inline.

El idioma activo se indica en el atributo `data-site-lang` del `<html>`:

```html
<html lang="es" data-site-lang="es">   ← index.html (ES)
<html lang="ca" data-site-lang="ca">   ← ca/index.html
<html lang="en" data-site-lang="en">   ← en/index.html
<!-- etc. -->
```

### Mecanismo JS (`i18n`)

Al cargar la página, el JS lee `data-site-lang`, selecciona el objeto de traducciones correspondiente y aplica los textos a todos los elementos con `data-i18n`:

```javascript
const i18n = {
  es: { nav_about: "Nosotros", hero_tag: "Helado artesanal...", ... },
  ca: { nav_about: "Nosaltres", hero_tag: "Gelat artesà...", ... },
  en: { ... },
  fr: { ... },
  nl: { ... },
  de: { ... }
};

function setLang(l) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = i18n[l][el.getAttribute('data-i18n')];
  });
}
```

El selector de idioma en la barra de navegación son enlaces `<a>` que apuntan a las URLs de cada idioma (`/`, `/ca/`, `/en/`, `/fr/`, `/nl/`, `/de/`), no botones JS.

### Cómo añadir un texto nuevo

1. Añadir la clave al elemento HTML con `data-i18n="clave_nueva"`:
   ```html
   <p data-i18n="mi_texto_nuevo">Texto fallback</p>
   ```
2. Añadir la traducción en el objeto `i18n` de los **6 idiomas** en **cada uno de los 6 archivos** `index.html`.

### Textos hardcoded (sin `data-i18n`)

Algunos bloques NO usan el sistema i18n y tienen texto fijo en español:
- Sección `glr-reviews-strip` (franja verde de reseñas Google)
- Sección `glr-why` (por qué elegirnos)
- Nombres de sabores en el carrusel (internacionales: "Pistacho", "Oreo", "Lotus"...)
- Textos dentro de los modales de productos

Estos bloques necesitan traducciones pendientes (ver auditoría).

---

## Secciones de la página (orden)

| Sección | ID / clase | Fondo | Notas |
|---|---|---|---|
| Loader | `#loader` | negro | Desaparece a los 1900ms |
| Nav fija | `#navbar` | transparente→negro scroll | Logo + links + selector idioma + CTA |
| Menú móvil | `#mobMenu` | negro full | Overlay con cierre |
| Hero | `#hero` | imagen parallax | `100svh`, stats bar oculta en ≤600px |
| Franja reseñas | `.glr-reviews-strip` | teal | Botones Google Reviews — solo ES |
| SEO local | `#seo-local` | blanco | Bloque H2 SEO para Google |
| Filosofía | `#experience` | negro | 4 tarjetas con imágenes |
| Carrusel sabores | `#flavors` | negro | 35 slides, touch swipe |
| Carta / Productos | `#products` | grl (crema) | 6 tarjetas → modales |
| Galería | `#gallery` | negro | Grid 12 columnas |
| Reseñas | `#reviews` | crema gradiente | 6 tarjetas |
| Instagram | `#instagram` | negro | Strip de 5 fotos |
| Por qué elegirnos | `.glr-why` | crema | 6 ítems — solo ES |
| Ubicación | `#location` | blanco | Mapa + horarios |
| Footer | `footer` | negro | Grid 3 col |
| WhatsApp float | `.wa-float` | verde | Fijo abajo-derecha |
| Modales (×6) | `#m-gelato`, `#m-crepes`, etc. | negro | Abiertos por clic en prod-card |

---

## URLs y enlaces críticos a no romper

```
Anclas internas:     #experience · #flavors · #products · #gallery · #reviews · #location
Google Maps:         https://www.google.com/maps/dir/?api=1&destination=La+Gelateria+de+Roses&destination_place_id=ChIJ2SAQYFJhuhIRpVJqYaT7svc
Google Reviews (ver):    https://g.page/r/CaVSamGk-7L3EBM
Google Reviews (escribir): https://g.page/r/CaVSamGk-7L3EBM/review
WhatsApp:            https://wa.me/34647319686
Teléfono:            tel:+34972253795
Instagram:           https://instagram.com/lagelateriaderoses
Facebook:            https://www.facebook.com/lagelateriaderoses
```

---

## CSS y JS

### CSS
- Todo **inline** dentro de `<style>` en cada HTML.
- Variables CSS en `:root`: `--teal`, `--gold`, `--white`, `--black`, `--gray`, `--grl`, `--serif`, `--sans`.
- Breakpoints: `@media(max-width:900px)` (tablet) y `@media(max-width:600px)` (móvil).
- Clases de utilidad: `.reveal` (animación scroll), `.shimmer` (texto dorado animado), `.sl` (etiqueta sección), `.st` (título sección).

### JS
- Todo **inline** al final de `<body>`.
- Sin dependencias externas.
- Funciones globales: `setLang()`, `openMenu()`, `closeMenu()`, `openModal(id)`, `closeModal(id)`, `filterFlavors()`, `flNext()`, `flPrev()`, `goToPage()`.
- IntersectionObserver para animaciones `.reveal`.
- Parallax del hero con `scroll` event.

### Fuentes (Google Fonts, 2 familias)
- `Cormorant Garamond`: pesos 300, 400, 600 (normal + italic)
- `Montserrat`: pesos 200, 300, 400, 500, 600, 700

---

## Imágenes — convención de nombres

```
/assets/img/img-[NN]-[hash8chars].[ext]
```

- Siempre rutas absolutas desde la raíz: `/assets/img/img-01-0e3af21121ef.png`
- El hash evita caché stale al reemplazar imágenes.
- Al subir una imagen nueva desde iPhone, el nombre puede ser cualquiera; renombrar siguiendo el patrón `img-NN-[hash].jpg` antes de usar en HTML.
- Las imágenes `img-01` a `img-06` se usan en múltiples secciones y en los 6 idiomas: cambiarlas afecta a toda la web.

---

## Flujo de edición habitual

1. Editar `index.html` (ES) con el cambio.
2. Replicar el mismo cambio en `ca/`, `en/`, `fr/`, `nl/`, `de/` (siempre los 6).
3. Para texto nuevo: añadir clave en el objeto `i18n` de los 6 idiomas en cada archivo.
4. Validar a 390 px antes de revisar en escritorio.
5. Hacer commit y push. GitHub Pages despliega automáticamente.

No hay paso de build. El archivo editado es el que se sirve.
