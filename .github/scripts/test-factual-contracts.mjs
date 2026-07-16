import { findRetiredClaims } from './factual-contracts.mjs';

const blocked = [
  ['<p>+ 50 sabores</p>', 'cantidad de 50 sabores'],
  ['<p>preservative-free</p>', 'sin conservantes'],
  ['<p>zonder conserveermiddelen</p>', 'sin conservantes'],
  ['<p>artificial colors</p>', 'sin colorantes artificiales'],
  ['<img alt="Pistache du Piémont">', 'procedencia no acreditada'],
  ['<p>sans sucre ajouté</p>', 'sin azúcar añadido'],
  ['<p>ohne Zuckerzusatz</p>', 'sin azúcar añadido'],
  ['<p>Satisfacció garantida</p>', 'satisfacción garantizada'],
  ['<p>1 minute from the beach</p>', 'distancia exacta de un minuto'],
  ['<a href="https://m.facebook.com/gelateriafeelingdor">Facebook</a>', 'identidad antigua de Facebook'],
  ['<script type="application/ld+json">{"description":"50+ flavours"}</script>', 'cantidad de 50 sabores'],
  ['<script>const i18n = {en:{copy:"no preservatives"}};\n};</script>', 'sin conservantes'],
];

for (const [html, label] of blocked) {
  const matches = findRetiredClaims(html);
  if (!matches.includes(label)) throw new Error(`No se bloqueó ${label}: ${html}`);
}

const allowed = '<style>.hero{width:100%}</style><!-- 50+ en nota interna --><iframe width="100%" style="width:100%"></iframe><p>Helado artesanal elaborado cada día.</p>';
if (findRetiredClaims(allowed).length) throw new Error(`Falso positivo factual: ${findRetiredClaims(allowed).join(', ')}`);

console.log(`PASS: ${blocked.length} mutaciones factuales bloqueadas y control positivo sin falsos resultados.`);
