# CLAUDE.md — La Gelateria de Roses

## Reglas fijas

- HTML, CSS y JavaScript planos, sin framework, build ni dependencias de producción.
- Las seis portadas se mantienen en paralelo: ES, CA, EN, FR, DE y NL.
- No romper canonicals, hreflang, navegación, WhatsApp, Maps ni enlaces de reseñas.
- Validar primero a 390 px y después en escritorio.
- No publicar datos comerciales, ratings o claims no confirmados.
- No crear páginas automáticas por keyword, idioma, barrio o playa.

## Arquitectura actual

Hay catorce URLs indexables y una página 404:

```text
/                                      ES y x-default
/ca/                                   CA
/en/                                   EN
/fr/                                   FR
/de/                                   DE
/nl/                                   NL
/fr/glacier-roses/                     guía comercial FR
/fr/meilleur-glacier-roses/            guía de elección FR
/fr/meilleures-plages-roses/           guía informativa FR
/fr/que-faire-a-roses/                 guía informativa FR
/nl/ijssalon-roses/                    guía comercial NL
/nl/beste-ijssalon-roses/              guía de elección NL
/nl/stranden-roses/                    guía informativa NL
/nl/wat-te-doen-in-roses/              guía informativa NL
/404.html                              utilidad no indexable
```

Las seis portadas son documentos independientes con CSS y JavaScript inline.
El contenido visible esencial ya está localizado en el HTML; el diccionario
`i18n` solo mejora la experiencia y también contiene los seis idiomas.

Las cuatro guías francesas y las cuatro neerlandesas conservan sus preguntas
visibles, pero no publican `FAQPage`. Cada pareja FR/NL declara `hreflang`
recíproco; `x-default` conserva la versión francesa de cada guía.

## Datos oficiales y límites factuales

- Nombre: La Gelateria de Roses.
- Dirección: Carrer Dr. Pi i Sunyer, 6, 17480 Roses, Girona, ES.
- Teléfono: +34 972 253 795.
- Email: info@lagelateriaderoses.com.
- Facebook: https://www.facebook.com/lagelateriaderoses
- Instagram: https://www.instagram.com/lagelateriaderoses/
- Google Reviews: https://g.page/r/CaVSamGk-7L3EBM
- Escribir reseña: https://g.page/r/CaVSamGk-7L3EBM/review
- Maps: https://www.google.com/maps/dir/?api=1&destination=La+Gelateria+de+Roses&destination_place_id=ChIJ2SAQYFJhuhIRpVJqYaT7svc

Confirmado por el propietario: el gelato se elabora cada día en el obrador
visible desde la tienda; las seis citas visibles son reseñas reales de Google;
el horario de verano visible es todos los días de 10:00 a 01:30.

El horario no se publica en JSON-LD hasta conocer las fechas exactas de verano
y el horario de invierno. Sin `validFrom` y `validThrough`, Google lo trataría
como horario válido todo el año.

No reintroducir sin prueba: cantidades de sabores, conservantes, colorantes,
bases industriales, origen de ingredientes, recetas de ciudades italianas,
azúcar añadido, distancia exacta a la playa o satisfacción garantizada.

## Imágenes

- Todas viven en `/assets/img/` y usan nombres `img-NN-[hash].[ext]`.
- No renombrar recursos existentes.
- El hero usa variantes WebP portrait y landscape precargadas.
- El hero debe conservar dimensiones, `fetchpriority="high"` y no ser lazy.
- Las imágenes posteriores al hero deben conservar dimensiones y lazy loading.
- Los presupuestos de tamaño se validan en CI.
- Las nuevas guías NL comparten `/assets/guide-p14.css`; no duplicar ese CSS.

## Schema

- Las seis portadas publican un único `IceCreamShop` con `@id` `/#business`.
- Todas las rutas publican un `WebPage` con `#webpage` y enlazan `/#website`.
- `WebPage.about` apunta al negocio en portadas y guías comerciales.
- Las guías de playas y actividades no usan `about`, porque su tema principal
  no es el negocio.
- No publicar `Review`, `AggregateRating`, `ratingValue` ni `reviewCount`.

## Validación local

```powershell
node .github/scripts/validate-internal-architecture.mjs .
node .github/scripts/test-multilingual-p14.mjs
node .github/scripts/test-factual-contracts.mjs
node .github/scripts/performance-budget.mjs .
node .github/scripts/test-performance-budget.mjs
node .github/scripts/test-monitor-production-seo.mjs
node .github/scripts/test-local-presence-audit.mjs
node .github/scripts/local-presence-audit.mjs . --static
git diff --check
```

El workflow `SEO validation` ejecuta los mismos contratos en cada PR y en main.
Después de desplegar debe ejecutarse `SEO production monitor`, que compara la
producción con el repositorio y comprueba páginas, recursos, redirecciones y 404.
El workflow `Local presence audit` comprueba semanalmente el manifiesto NAP,
los perfiles públicos conocidos y la cola de verificaciones humanas. Una
respuesta HTTP externa nunca demuestra por sí sola que la ficha sea correcta.

La fuente maestra de presencia local es `.github/data/local-presence.json`.
TripAdvisor y Bing tienen una ficha pública identificada, pero su control sigue
pendiente de comprobar desde las cuentas del propietario. Apple Maps y Waze
permanecen en `needs_human` hasta descartar duplicados dentro de sus plataformas.
El propietario confirmó el 16 de julio de 2026 que el número oficial de WhatsApp
es `+34647319686`.

## Flujo de publicación

1. Crear rama `codex/*` desde main limpio.
2. Aplicar el cambio en las seis portadas cuando afecte estructura o contenido.
3. Ejecutar contratos, pruebas y QA responsive.
4. Commit, push y pull request.
5. Fusionar solo con CI en verde.
6. Esperar GitHub Pages y ejecutar el monitor de producción.
7. Solicitar rastreo solo cuando haya un cambio material nuevo; no repetir
   solicitudes idénticas porque no aumenta la prioridad.

Los contratos franceses de P9 deben esperar una ventana homogénea en Search
Console. P14 separa la portada NL de cuatro intenciones neerlandesas nuevas;
no volver a solaparlas sin datos suficientes de Search Console.
