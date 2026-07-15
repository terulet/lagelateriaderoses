import fs from 'node:fs';
import path from 'node:path';
import { findRetiredClaims } from './factual-contracts.mjs';

const root = path.resolve(process.argv[2] || '.');
const origin = 'https://lagelateriaderoses.com';
const sitemapUrl = `${origin}/sitemap.xml`;
const businessId = `${origin}/#business`;
const websiteId = `${origin}/#website`;
const businessStreetAddress = 'Carrer Dr. Pi i Sunyer, 6';
const businessPhone = '+34972253795';
const businessEmail = 'info@lagelateriaderoses.com';
const businessMap = 'https://www.google.com/maps/place/?q=place_id:ChIJ2SAQYFJhuhIRpVJqYaT7svc';
const businessProfiles = [
  'https://www.instagram.com/lagelateriaderoses/',
  'https://www.facebook.com/lagelateriaderoses',
];
const businessKeys = [
  '@context', '@id', '@type', 'address', 'email', 'geo', 'hasMap', 'name',
  'sameAs', 'telephone', 'url',
].sort();
const dailyWorkshopCopy = new Map([
  ['es', 'Elaboramos nuestro gelato cada día en el obrador visible desde la tienda.'],
  ['ca', 'Elaborem el nostre gelat cada dia al nostre obrador, visible des de la botiga.'],
  ['en', 'We make our gelato every day in our workshop, which is visible from the shop.'],
  ['fr', 'Nous préparons notre gelato chaque jour dans notre atelier de fabrication, visible depuis la boutique.'],
  ['de', 'Wir stellen unser Gelato täglich in unserem vom Verkaufsraum aus einsehbaren Produktionsbereich her.'],
  ['nl', 'We maken onze gelato elke dag in de bereidingsruimte, die vanuit de winkel zichtbaar is.'],
]);
const expectedReviewAuthors = ['Sarah T.', 'James M.', 'C. S.', 'Júlia Bech Solà', 'Marie L.', 'Robert K.'];
const expectedReviewTexts = [
  "Oh my gosh if you visit Roses, you HAVE to stop here! The flavours are so delicious and the ice cream so smooth. The biggest decision you'll make is how many scoops!",
  'Absolutely INCREDIBLE! I could not recommend this place enough. The service is one of the best I have ever experienced — they let you try before you choose.',
  'Das beste Eis das ich jemals in Spanien gegessen habe. 10 Sterne wert. Das Veilcheneis ist einzigartig!',
  'Sitio ideal para tomar un helado, crep, milkshake, gofre y mil variedades. Gran vitrina con muchos sabores. El mejor de Roses sin duda.',
  "Glaces à l'italienne absolument délicieuses. Personne nous servant parlant français et très aimable. On reviendra chaque année!",
  'The best ice cream and crepes in Roses. Excellent customer service, always welcome you with a big smile. Every year we come back for sure!',
];
const expectedReviewOrigins = new Map([
  ['es', ['United Kingdom · Google · Verano 2024', 'United Kingdom · Google · Julio 2025', 'Deutschland · Google · Agosto 2024', 'Catalunya · Google · Agosto 2025', 'France · Google · Julio 2024', 'United Kingdom · Google · Verano 2025']],
  ['ca', ['Regne Unit · Google · Estiu 2024', 'Regne Unit · Google · Juliol 2025', 'Alemanya · Google · Agost 2024', 'Catalunya · Google · Agost 2025', 'França · Google · Juliol 2024', 'Regne Unit · Google · Estiu 2025']],
  ['en', ['United Kingdom · Google · Summer 2024', 'United Kingdom · Google · July 2025', 'Germany · Google · August 2024', 'Catalonia · Google · August 2025', 'France · Google · July 2024', 'United Kingdom · Google · Summer 2025']],
  ['fr', ['Royaume-Uni · Google · Été 2024', 'Royaume-Uni · Google · Juillet 2025', 'Allemagne · Google · Août 2024', 'Catalogne · Google · Août 2025', 'France · Google · Juillet 2024', 'Royaume-Uni · Google · Été 2025']],
  ['de', ['Vereinigtes Königreich · Google · Sommer 2024', 'Vereinigtes Königreich · Google · Juli 2025', 'Deutschland · Google · August 2024', 'Katalonien · Google · August 2025', 'Frankreich · Google · Juli 2024', 'Vereinigtes Königreich · Google · Sommer 2025']],
  ['nl', ['Verenigd Koninkrijk · Google · Zomer 2024', 'Verenigd Koninkrijk · Google · Juli 2025', 'Duitsland · Google · Augustus 2024', 'Catalonië · Google · Augustus 2025', 'Frankrijk · Google · Juli 2024', 'Verenigd Koninkrijk · Google · Zomer 2025']],
]);

const routes = new Map([
  ['/', 'index.html'],
  ['/ca/', 'ca/index.html'],
  ['/en/', 'en/index.html'],
  ['/fr/', 'fr/index.html'],
  ['/de/', 'de/index.html'],
  ['/nl/', 'nl/index.html'],
  ['/fr/glacier-roses/', 'fr/glacier-roses/index.html'],
  ['/fr/meilleur-glacier-roses/', 'fr/meilleur-glacier-roses/index.html'],
  ['/fr/meilleures-plages-roses/', 'fr/meilleures-plages-roses/index.html'],
  ['/fr/que-faire-a-roses/', 'fr/que-faire-a-roses/index.html'],
]);
const utilityFiles = ['404.html'];

const homes = ['/', '/ca/', '/en/', '/fr/', '/de/', '/nl/'];
const guides = [...routes.keys()].filter(route => route.startsWith('/fr/') && route !== '/fr/');
const informationalGuides = new Set(['/fr/meilleures-plages-roses/', '/fr/que-faire-a-roses/']);
const expectedHreflang = new Map([
  ['es', `${origin}/`],
  ['ca', `${origin}/ca/`],
  ['en', `${origin}/en/`],
  ['fr', `${origin}/fr/`],
  ['de', `${origin}/de/`],
  ['nl', `${origin}/nl/`],
  ['x-default', `${origin}/`],
]);
const frenchIntentContracts = new Map([
  ['/fr/', {
    title: 'La Gelateria de Roses | Gelato italien au centre-ville',
    description: 'Découvrez La Gelateria de Roses : gelato italien, sorbets, crêpes et gaufres au centre-ville. Retrouvez notre adresse, nos horaires et les avis Google.',
    h1: 'La Gelateria de Roses : gelato italien au cœur de la ville',
  }],
  ['/fr/glacier-roses/', {
    title: 'Glacier à Roses : parfums, horaires et adresse',
    description: 'Trouvez un glacier à Roses au centre-ville : gelato, sorbets, crêpes et gaufres. Consultez l’adresse, les horaires et l’itinéraire Google Maps.',
    h1: 'Glacier à Roses : que déguster et comment nous trouver ?',
  }],
  ['/fr/meilleur-glacier-roses/', {
    title: 'Meilleur glacier à Roses : comment choisir ? | La Gelateria',
    description: 'Quels critères regarder pour choisir un glacier à Roses ? Qualité, choix, emplacement et avis Google : découvrez l’approche de La Gelateria de Roses.',
    h1: 'Comment choisir le meilleur glacier à Roses ?',
  }],
]);
const allowedFrenchIntentAnchors = new Map([
  ['/fr/glacier-roses/', new Set([
    'Glacier à Roses : parfums et informations pratiques',
    'Parfums et informations',
    'Glacier à Roses : guide pratique',
  ])],
  ['/fr/meilleur-glacier-roses/', new Set([
    'Comment choisir le meilleur glacier à Roses ?',
    'Guide de choix',
    'Comment choisir un bon glacier',
    'Quels critères pour choisir un bon glacier ?',
  ])],
]);

const errors = [];
const fail = message => errors.push(message);
const count = (text, needle) => text.split(needle).length - 1;
const decodeEntities = text => text
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');
const visibleText = text => decodeEntities(text.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();
function validateStructuredData(value, route, trail = 'jsonld') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateStructuredData(item, route, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const types = (Array.isArray(value['@type']) ? value['@type'] : [value['@type']])
    .filter(Boolean)
    .map(type => String(type).split('/').pop());
  for (const type of types) {
    if (['Review', 'AggregateRating'].includes(type)) fail(`${route}: tipo estructurado autocontrolado ${type} en ${trail}`);
    if (type === 'FAQPage') fail(`${route}: tipo estructurado retirado FAQPage en ${trail}`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (['review', 'aggregateRating', 'ratingValue', 'reviewCount', 'bestRating', 'worstRating'].includes(key)) {
      fail(`${route}: propiedad estructurada autocontrolada ${key} en ${trail}`);
    }
    validateStructuredData(child, route, `${trail}.${key}`);
  }
}

function walkHtml(directory, prefix = '') {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkHtml(absolute, relative));
    else if (entry.name.endsWith('.html')) output.push(relative);
  }
  return output;
}

function normalizeRoute(pathname) {
  let normalized = pathname.replace(/\/+/g, '/');
  if (normalized.endsWith('/index.html')) normalized = normalized.slice(0, -'index.html'.length);
  if (!path.posix.extname(normalized) && !normalized.endsWith('/')) normalized += '/';
  return normalized;
}

function jsonLd(html, route) {
  const values = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[1]);
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      fail(`${route}: JSON-LD inválido (${error.message})`);
    }
  }
  return values;
}

const expectedFiles = [...routes.values()].sort();
const actualFiles = walkHtml(root).sort();
const expectedAllFiles = [...expectedFiles, ...utilityFiles].sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedAllFiles)) {
  fail(`inventario HTML: esperado ${expectedAllFiles.join(', ')}, encontrado ${actualFiles.join(', ')}`);
}
for (const relative of [...actualFiles, 'CLAUDE.md']) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) continue;
  const content = fs.readFileSync(filename, 'utf8');
  if (/gelateriafeelingdor/i.test(content)) fail(`${relative}: identidad antigua de Facebook detectada`);
  if (content.includes('https://facebook.com/lagelateriaderoses')) fail(`${relative}: Facebook oficial sin forma canónica www`);
  if (content.includes('https://instagram.com/lagelateriaderoses')) fail(`${relative}: Instagram oficial sin forma canónica www y barra final`);
}

const documents = new Map();
const canonicals = new Set();
const titles = new Set();
const descriptions = new Set();
const headings = new Set();
const graph = new Map();
const directLinks = new Map();
const contextualLinks = [];

for (const [route, relative] of routes) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) {
    fail(`${route}: falta ${relative}`);
    continue;
  }
  const html = fs.readFileSync(filename, 'utf8');
  documents.set(route, html);

  if (!html.includes(businessStreetAddress)) fail(`${route}: falta la dirección comercial verificada`);
  for (const staleAddress of ['Carrer Pi i Sunyer 6', 'Carrer Pi i Sunyer, 6', 'Carrer%20Pi%20i%20Sunyer', 'Carrer+Pi+i+Sunyer']) {
    if (html.includes(staleAddress)) fail(`${route}: dirección comercial obsoleta ${staleAddress}`);
  }

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(`${route}: IDs duplicados ${duplicateIds.join(', ')}`);

  const titleMatches = [...html.matchAll(/<title>([^<]+)<\/title>/gi)];
  const descriptionMatches = [...html.matchAll(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/gi)];
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (titleMatches.length !== 1) fail(`${route}: title count ${titleMatches.length}`);
  if (descriptionMatches.length !== 1) fail(`${route}: description count ${descriptionMatches.length}`);
  if (h1Matches.length !== 1) fail(`${route}: H1 count ${h1Matches.length}`);
  const title = decodeEntities(titleMatches[0]?.[1] || '');
  const description = decodeEntities(descriptionMatches[0]?.[1] || '');
  const h1 = visibleText(h1Matches[0]?.[1] || '');
  if (title.length > 60) fail(`${route}: title de ${title.length} caracteres`);
  if (description.length > 160) fail(`${route}: description de ${description.length} caracteres`);
  if (!h1) fail(`${route}: H1 vacío`);
  const faviconCount = [...html.matchAll(/<link\s+rel=["']icon["'][^>]*>/gi)].length;
  if (faviconCount !== 1) fail(`${route}: favicon count ${faviconCount}`);
  if (titles.has(title)) fail(`${route}: title duplicado ${title}`);
  if (descriptions.has(description)) fail(`${route}: description duplicada`);
  if (headings.has(h1)) fail(`${route}: H1 duplicado ${h1}`);
  titles.add(title);
  descriptions.add(description);
  headings.add(h1);

  const intentContract = frenchIntentContracts.get(route);
  if (intentContract) {
    if (title !== intentContract.title) fail(`${route}: title fuera del contrato de intención P9`);
    if (description !== intentContract.description) fail(`${route}: description fuera del contrato de intención P9`);
    if (h1 !== intentContract.h1) fail(`${route}: H1 fuera del contrato de intención P9`);
    for (const marker of [
      `<meta property="og:title" content="${intentContract.title}"`,
      `<meta property="og:description" content="${intentContract.description}"`,
      `<meta name="twitter:title" content="${intentContract.title}"`,
      `<meta name="twitter:description" content="${intentContract.description}"`,
    ]) {
      if (!html.includes(marker)) fail(`${route}: metadato social fuera del contrato P9 ${marker}`);
    }
  }

  const canonicalMatches = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const expectedCanonical = `${origin}${route}`;
  if (canonicalMatches.length !== 1 || canonicalMatches[0] !== expectedCanonical) {
    fail(`${route}: canonical ${canonicalMatches.join(', ') || 'ausente'} != ${expectedCanonical}`);
  }
  if (canonicals.has(expectedCanonical)) fail(`${route}: canonical duplicada ${expectedCanonical}`);
  canonicals.add(expectedCanonical);

  const alternateEntries = [...html.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["'][^>]*>/gi)].map(match => [match[1], match[2]]);
  const alternates = new Map(alternateEntries);
  if (alternateEntries.length !== alternates.size) fail(`${route}: código hreflang duplicado`);
  if (homes.includes(route)) {
    if (alternates.size !== expectedHreflang.size) fail(`${route}: hreflang count ${alternates.size}`);
    for (const [language, url] of expectedHreflang) {
      if (alternates.get(language) !== url) fail(`${route}: hreflang ${language} != ${url}`);
    }
  } else {
    if (alternates.get('fr') !== expectedCanonical) fail(`${route}: falta hreflang fr propio`);
    if (alternates.has('x-default') && alternates.get('x-default') !== expectedCanonical) fail(`${route}: x-default no autorreferencial`);
    for (const language of alternates.keys()) {
      if (!['fr', 'x-default'].includes(language)) fail(`${route}: alternate ficticio ${language}`);
    }
  }

  const entities = jsonLd(html, route);
  validateStructuredData(entities, route);
  const typeCount = type => entities.filter(entity => entity?.['@type'] === type).length;
  const webPage = entities.find(entity => entity?.['@type'] === 'WebPage');
  if (typeCount('WebPage') !== 1) fail(`${route}: WebPage count ${typeCount('WebPage')}`);
  if (webPage?.['@id'] !== `${expectedCanonical}#webpage`) fail(`${route}: WebPage.@id incorrecto`);
  if (webPage?.url !== expectedCanonical) fail(`${route}: WebPage.url incorrecta`);
  if (webPage?.name !== title) fail(`${route}: WebPage.name no coincide con title`);
  if (webPage?.description !== description) fail(`${route}: WebPage.description no coincide con meta description`);
  if (informationalGuides.has(route)) {
    if ('about' in (webPage || {})) fail(`${route}: WebPage.about no debe convertir la guía informativa en página del negocio`);
  } else if (webPage?.about?.['@id'] !== businessId) {
    fail(`${route}: WebPage.about incorrecto`);
  }
  if (
    webPage?.isPartOf?.['@type'] !== 'WebSite' ||
    webPage?.isPartOf?.['@id'] !== websiteId ||
    webPage?.isPartOf?.name !== 'La Gelateria de Roses' ||
    webPage?.isPartOf?.url !== `${origin}/`
  ) {
    fail(`${route}: WebPage.isPartOf no identifica el WebSite canónico`);
  }
  const expectedLanguage = route === '/' ? 'es' : route.split('/')[1];
  if (webPage?.inLanguage !== expectedLanguage) fail(`${route}: WebPage.inLanguage ${webPage?.inLanguage} != ${expectedLanguage}`);

  if (homes.includes(route)) {
    if (typeCount('IceCreamShop') !== 1) fail(`${route}: IceCreamShop count ${typeCount('IceCreamShop')}`);
    const business = entities.find(entity => entity?.['@type'] === 'IceCreamShop');
    if (business?.['@context'] !== 'https://schema.org') fail(`${route}: contexto Schema del negocio incorrecto`);
    if (business?.['@id'] !== businessId) fail(`${route}: @id del negocio incorrecto`);
    if (business?.name !== 'La Gelateria de Roses') fail(`${route}: nombre del negocio incorrecto`);
    if (business?.url !== `${origin}/`) fail(`${route}: URL del negocio incorrecta`);
    if (business?.telephone !== businessPhone) fail(`${route}: teléfono del negocio incorrecto`);
    if (business?.email !== businessEmail) fail(`${route}: email del negocio incorrecto`);
    if (business?.address?.streetAddress !== businessStreetAddress) fail(`${route}: dirección del negocio incorrecta`);
    if (business?.address?.['@type'] !== 'PostalAddress' || business?.address?.postalCode !== '17480' || business?.address?.addressLocality !== 'Roses' || business?.address?.addressRegion !== 'Girona' || business?.address?.addressCountry !== 'ES') fail(`${route}: dirección estructurada del negocio incompleta o incorrecta`);
    if (business?.geo?.['@type'] !== 'GeoCoordinates' || business?.geo?.latitude !== 42.2668 || business?.geo?.longitude !== 3.176) fail(`${route}: coordenadas del negocio incorrectas`);
    if (business?.hasMap !== businessMap) fail(`${route}: mapa del negocio incorrecto`);
    if (JSON.stringify(business?.sameAs) !== JSON.stringify(businessProfiles)) fail(`${route}: perfiles sociales del negocio incorrectos`);
    if (JSON.stringify(Object.keys(business || {}).sort()) !== JSON.stringify(businessKeys)) fail(`${route}: IceCreamShop contiene propiedades no verificadas`);

    const officialFacebook = businessProfiles[1];
    if (count(html, officialFacebook) !== 2) fail(`${route}: Facebook oficial debe aparecer una vez en Schema y una vez como enlace visible`);
    if (count(html, `href="${officialFacebook}"`) !== 1) fail(`${route}: enlace visible de Facebook oficial ausente o duplicado`);
    for (const staleFacebook of ['https://www.facebook.com/gelateriafeelingdor', 'https://facebook.com/lagelateriaderoses']) {
      if (html.includes(staleFacebook)) fail(`${route}: perfil de Facebook obsoleto o no canónico ${staleFacebook}`);
    }

    const officialInstagram = businessProfiles[0];
    if (count(html, officialInstagram) !== 3) fail(`${route}: Instagram oficial debe aparecer una vez en Schema y dos veces como enlace visible`);
    if (count(html, `href="${officialInstagram}"`) !== 2) fail(`${route}: enlaces visibles de Instagram oficial ausentes o duplicados`);

    const expectedLanguage = route === '/' ? 'es' : route.split('/')[1];
    const approvedWorkshopCopy = dailyWorkshopCopy.get(expectedLanguage);
    const bodyWithoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    if (count(bodyWithoutScripts, `<p data-i18n="e1d">${approvedWorkshopCopy}</p>`) !== 1) fail(`${route}: falta la afirmación visible aprobada de elaboración diaria y obrador visible`);
    for (const [language, approvedCopy] of dailyWorkshopCopy) {
      if (!html.includes(`e1d:"${approvedCopy}"`)) fail(`${route}: falta copia factual i18n ${language} sobre elaboración diaria y obrador visible`);
    }

    for (const label of findRetiredClaims(html)) fail(`${route}: reclamo retirado detectado (${label})`);

    const reviewCards = [...html.matchAll(/<div class="rev-card\b[\s\S]*?<div class="stars-sm">[\s\S]*?<\/div><\/div>/g)].map(match => match[0]);
    if (reviewCards.length !== 6) fail(`${route}: deben existir exactamente seis reseñas de clientes`);
    const reviewAuthors = reviewCards.map(card => decodeEntities(card.match(/<p class="rev-a">([^<]+)<\/p>/)?.[1] || ''));
    const reviewTexts = reviewCards.map(card => decodeEntities(card.match(/<p class="rev-t">([^<]+)<\/p>/)?.[1] || ''));
    const reviewOrigins = reviewCards.map(card => decodeEntities(card.match(/<p class="rev-o">([^<]+)<\/p>/)?.[1] || ''));
    if (JSON.stringify(reviewAuthors) !== JSON.stringify(expectedReviewAuthors)) fail(`${route}: autores de reseñas fuera del conjunto confirmado`);
    if (JSON.stringify(reviewTexts) !== JSON.stringify(expectedReviewTexts)) fail(`${route}: textos de reseñas fuera del conjunto confirmado`);
    if (JSON.stringify(reviewOrigins) !== JSON.stringify(expectedReviewOrigins.get(expectedLanguage))) fail(`${route}: origen o fecha de reseñas fuera del conjunto confirmado`);
    for (const [index, card] of reviewCards.entries()) {
      const origin = decodeEntities(card.match(/<p class="rev-o">([^<]+)<\/p>/)?.[1] || '');
      if (!origin.includes('Google')) fail(`${route}: reseña ${index + 1} sin atribución a Google`);
      if (/<a\b/i.test(card)) fail(`${route}: reseña ${index + 1} no debe inventar un enlace individual`);
    }
    if (count(html, 'href="https://g.page/r/CaVSamGk-7L3EBM"') !== 1) fail(`${route}: enlace general a reseñas Google ausente o duplicado`);
    if (count(html, 'href="https://g.page/r/CaVSamGk-7L3EBM/review"') !== 1) fail(`${route}: enlace para publicar reseña Google ausente o duplicado`);
    const reviewLinks = [...html.matchAll(/href=["'](https:\/\/g\.page\/r\/[^"']+)["']/gi)].map(match => match[1]);
    if (JSON.stringify(reviewLinks.sort()) !== JSON.stringify(['https://g.page/r/CaVSamGk-7L3EBM', 'https://g.page/r/CaVSamGk-7L3EBM/review'].sort())) fail(`${route}: enlaces Google de reseñas fuera de la lista permitida`);

    if ('openingHoursSpecification' in (business || {})) fail(`${route}: horario estacional sin fechas publicado como horario anual`);

    for (const marker of [
      '<span class="stat-num">4.8★</span>',
      '<span class="stat-num">+800</span>',
      '<p class="loc-addr">Carrer Dr. Pi i Sunyer, 6</p>',
      '<span>10:00 – 01:30</span>',
    ]) {
      if (count(html, marker) !== 1) fail(`${route}: dato público ausente o duplicado ${marker}`);
    }
    for (const staleFact of ['4.9★', '+650', '+600 ', 'reviewCount', '10:30 –', '11:00 – 23:00', '11:00 – 00:00', 'Google y TripAdvisor', 'Google i TripAdvisor', 'Google and TripAdvisor', 'Google et TripAdvisor', 'Google en TripAdvisor', 'Google und TripAdvisor']) {
      if (html.includes(staleFact)) fail(`${route}: dato público obsoleto ${staleFact}`);
    }
  } else {
    if (typeCount('BreadcrumbList') !== 1) fail(`${route}: BreadcrumbList count ${typeCount('BreadcrumbList')}`);
    if (typeCount('FAQPage') !== 0) fail(`${route}: FAQPage retirado por Google debe permanecer ausente`);
    if (count(html, '<details>') !== 4) fail(`${route}: las cuatro preguntas visibles deben conservarse sin FAQPage`);
    const breadcrumb = entities.find(entity => entity?.['@type'] === 'BreadcrumbList');
    const items = breadcrumb?.itemListElement || [];
    if (items.length !== 2 || items[0]?.position !== 1 || items[0]?.item !== `${origin}/fr/` || items[1]?.position !== 2 || items[1]?.item !== expectedCanonical) {
      fail(`${route}: breadcrumb no conecta /fr/ con la canonical`);
    }
    const requiredSocial = [
      '<meta property="og:type" content="article">',
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      `<meta property="og:url" content="${expectedCanonical}">`,
      '<meta property="og:image" content="https://lagelateriaderoses.com/assets/img/img-02-d78c59c65e5e.jpg">',
      '<meta property="og:image:type" content="image/jpeg">',
      '<meta property="og:image:width" content="1400">',
      '<meta property="og:image:height" content="788">',
      '<meta property="og:image:alt" content="Vitrine de gelato de La Gelateria de Roses">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${description}">`,
      '<meta name="twitter:image" content="https://lagelateriaderoses.com/assets/img/img-02-d78c59c65e5e.jpg">',
      '<meta name="twitter:image:alt" content="Vitrine de gelato de La Gelateria de Roses">',
    ];
    for (const marker of requiredSocial) {
      if (count(html, marker) !== 1) fail(`${route}: social marker ausente o duplicado ${marker}`);
    }
  }

  const targets = new Set();
  const links = [];
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi)) {
    const href = match[2].trim();
    if (!href || /^(mailto:|tel:|sms:|javascript:)/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, `${origin}${route}`);
    } catch {
      fail(`${route}: href inválido ${href}`);
      continue;
    }
    if (url.origin !== origin) continue;
    const targetRoute = normalizeRoute(url.pathname);
    if (!routes.has(targetRoute)) {
      fail(`${route}: enlace interno roto ${href} -> ${targetRoute}`);
      continue;
    }
    if (url.hash) {
      const targetHtml = targetRoute === route ? html : fs.readFileSync(path.join(root, routes.get(targetRoute)), 'utf8');
      const fragment = decodeURIComponent(url.hash.slice(1));
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`\\bid=["']${escaped}["']`, 'i').test(targetHtml)) fail(`${route}: fragmento roto ${href}`);
    }
    const attributes = `${match[1]} ${match[3]}`;
    const nofollow = /\brel=["'][^"']*\bnofollow\b[^"']*["']/i.test(attributes);
    targets.add(targetRoute);
    links.push({ targetRoute, nofollow });
  }
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    let url;
    try {
      url = new URL(match[2].trim(), `${origin}${route}`);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const targetRoute = normalizeRoute(url.pathname);
    if (!routes.has(targetRoute)) continue;
    contextualLinks.push({
      sourceRoute: route,
      targetRoute,
      anchorText: visibleText(match[4]),
    });
  }
  graph.set(route, targets);
  directLinks.set(route, links);
}

for (const link of contextualLinks) {
  if (!link.sourceRoute.startsWith('/fr/')) continue;
  if (link.sourceRoute === link.targetRoute) continue;
  const allowed = allowedFrenchIntentAnchors.get(link.targetRoute);
  if (allowed && !allowed.has(link.anchorText)) {
    fail(`${link.sourceRoute}: anchor P9 ambiguo hacia ${link.targetRoute}: ${link.anchorText}`);
  }
}
for (const [targetRoute, expectedAnchor] of [
  ['/fr/glacier-roses/', 'Glacier à Roses : parfums et informations pratiques'],
  ['/fr/meilleur-glacier-roses/', 'Comment choisir le meilleur glacier à Roses ?'],
]) {
  if (!contextualLinks.some(link => link.sourceRoute === '/fr/' && link.targetRoute === targetRoute && link.anchorText === expectedAnchor)) {
    fail(`/fr/: falta anchor contextual P9 hacia ${targetRoute}`);
  }
}

for (const guide of guides) {
  const linksFromFr = directLinks.get('/fr/') || [];
  if (!linksFromFr.some(link => link.targetRoute === guide && !link.nofollow)) fail(`/fr/: falta enlace directo follow a ${guide}`);
  if (!graph.get(guide)?.has('/fr/')) fail(`${guide}: falta enlace de retorno a /fr/`);
}
for (const home of homes.filter(route => route !== '/fr/')) {
  for (const guide of guides) {
    if (graph.get(home)?.has(guide)) fail(`${home}: no debe copiar enlaces editoriales franceses a ${guide}`);
  }
}

function distances(seed) {
  const result = new Map([[seed, 0]]);
  const queue = [seed];
  while (queue.length) {
    const current = queue.shift();
    for (const target of graph.get(current) || []) {
      if (!result.has(target)) {
        result.set(target, result.get(current) + 1);
        queue.push(target);
      }
    }
  }
  return result;
}

for (const home of homes) {
  const depth = distances(home);
  const missing = [...routes.keys()].filter(route => !depth.has(route));
  if (missing.length) fail(`${home}: no alcanza ${missing.join(', ')}`);
  for (const guide of guides) {
    const maximum = home === '/fr/' ? 1 : 2;
    if ((depth.get(guide) ?? Infinity) > maximum) fail(`${home}: profundidad a ${guide} > ${maximum}`);
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => match[1]);
const expectedUrls = [...routes.keys()].map(route => `${origin}${route}`).sort();
if (JSON.stringify([...new Set(sitemapUrls)].sort()) !== JSON.stringify(expectedUrls) || sitemapUrls.length !== expectedUrls.length) {
  fail('sitemap: las URLs no coinciden exactamente con las 10 canonicals');
}
for (const url of sitemapUrls) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) fail(`sitemap: URL no canónica ${url}`);
}

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!robots.split(/\r?\n/).some(line => line.trim() === `Sitemap: ${sitemapUrl}`)) fail(`robots.txt: falta Sitemap: ${sitemapUrl}`);

const socialImage = path.join(root, 'assets/img/img-02-d78c59c65e5e.jpg');
if (!fs.existsSync(socialImage)) fail('falta la imagen social de las guías');

const notFoundFile = path.join(root, '404.html');
if (!fs.existsSync(notFoundFile)) {
  fail('falta 404.html');
} else {
  const notFound = fs.readFileSync(notFoundFile, 'utf8');
  if (count(notFound, '<meta name="robots" content="noindex, follow">') !== 1) fail('404.html: robots debe ser noindex, follow');
  if ([...notFound.matchAll(/<link\s+rel=["']canonical["']/gi)].length) fail('404.html: no debe publicar canonical');
  if ([...notFound.matchAll(/<link\s+rel=["']icon["'][^>]*>/gi)].length !== 1) fail('404.html: favicon count incorrecto');
  for (const home of homes) {
    if (!new RegExp(`<a\\b[^>]*href=["']${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(notFound)) fail(`404.html: falta enlace a ${home}`);
  }
}

const workflowFile = path.join(root, '.github/workflows/seo-validation.yml');
if (!fs.existsSync(workflowFile)) {
  fail('falta el workflow SEO');
} else {
  const workflow = fs.readFileSync(workflowFile, 'utf8');
  for (const marker of [
    'pull_request:',
    'branches:',
    '- main',
    'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0',
    'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
    'node-version: 24',
    'persist-credentials: false',
    'timeout-minutes: 5',
    'node .github/scripts/validate-internal-architecture.mjs .',
    'node .github/scripts/test-factual-contracts.mjs',
    'node .github/scripts/performance-budget.mjs .',
    'node .github/scripts/test-performance-budget.mjs',
    'node .github/scripts/test-monitor-production-seo.mjs',
  ]) {
    if (!workflow.includes(marker)) fail(`workflow SEO: falta ${marker}`);
  }
}

for (const script of [
  '.github/scripts/factual-contracts.mjs',
  '.github/scripts/test-factual-contracts.mjs',
  '.github/scripts/performance-budget.mjs',
  '.github/scripts/test-performance-budget.mjs',
  '.github/scripts/monitor-production-seo.mjs',
  '.github/scripts/test-monitor-production-seo.mjs',
]) {
  if (!fs.existsSync(path.join(root, script))) fail(`falta ${script}`);
}

const productionWorkflowFile = path.join(root, '.github/workflows/seo-production-monitor.yml');
if (!fs.existsSync(productionWorkflowFile)) {
  fail('falta el workflow de monitorización de producción');
} else {
  const workflow = fs.readFileSync(productionWorkflowFile, 'utf8');
  for (const marker of [
    'workflow_dispatch:',
    'schedule:',
    "cron: '17 5 * * 1'",
    'contents: read',
    'cancel-in-progress: false',
    'timeout-minutes: 10',
    'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0',
    'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
    'node-version: 24',
    'persist-credentials: false',
    'node .github/scripts/test-monitor-production-seo.mjs',
    'node .github/scripts/monitor-production-seo.mjs .',
  ]) {
    if (!workflow.includes(marker)) fail(`workflow de producción: falta ${marker}`);
  }
}

if (errors.length) {
  for (const error of [...new Set(errors)].sort()) console.error(`FAIL: ${error}`);
  process.exit(1);
}

console.log('PASS: SEO architecture validates 10/10 indexable pages plus 404; P13 enforces seasonal Schema accuracy, canonical identity and static performance budgets while P12 factual, P11 production and P9 French intent contracts remain consistent.');
