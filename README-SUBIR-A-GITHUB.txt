LA GELATERIA DE ROSES — DESPLIEGUE Y VALIDACIÓN

Repositorio oficial:
https://github.com/terulet/lagelateriaderoses

Publicación:
- La rama estable es main.
- Los cambios se preparan en una rama codex/* y se integran mediante pull request.
- GitHub Pages publica automáticamente después de fusionar en main.
- No se suben ZIP ni archivos manualmente desde la interfaz de GitHub.

URLs canónicas incluidas en sitemap.xml:
- https://lagelateriaderoses.com/
- https://lagelateriaderoses.com/ca/
- https://lagelateriaderoses.com/en/
- https://lagelateriaderoses.com/fr/
- https://lagelateriaderoses.com/de/
- https://lagelateriaderoses.com/nl/
- https://lagelateriaderoses.com/fr/glacier-roses/
- https://lagelateriaderoses.com/fr/meilleur-glacier-roses/
- https://lagelateriaderoses.com/fr/meilleures-plages-roses/
- https://lagelateriaderoses.com/fr/que-faire-a-roses/
- https://lagelateriaderoses.com/nl/ijssalon-roses/
- https://lagelateriaderoses.com/nl/beste-ijssalon-roses/
- https://lagelateriaderoses.com/nl/stranden-roses/
- https://lagelateriaderoses.com/nl/wat-te-doen-in-roses/

Validación antes de publicar:
1. node .github/scripts/validate-internal-architecture.mjs .
2. node .github/scripts/test-multilingual-p14.mjs
3. node .github/scripts/test-factual-contracts.mjs
4. node .github/scripts/performance-budget.mjs .
5. node .github/scripts/test-performance-budget.mjs
6. node .github/scripts/test-monitor-production-seo.mjs
7. node .github/scripts/test-local-presence-audit.mjs
8. node .github/scripts/local-presence-audit.mjs . --static
9. git diff --check

Validación después del despliegue:
- Lanzar manualmente el workflow "SEO production monitor".
- Debe comprobar 16 páginas o archivos de texto, 105 recursos,
  3 cadenas de redirección y un 404 real.
- El workflow "Local presence audit" comprueba semanalmente la coherencia NAP
  y genera un informe de perfiles públicos y verificaciones humanas pendientes.
- Revisar Search Console después de permitir tiempo de rastreo e indexación.

No cambiar horarios estructurados, ratings, recuentos, ingredientes,
procedencias o claims dietéticos sin confirmación verificable.
