import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const origin = 'https://lagelateriaderoses.com';
const sitemapUrl = `${origin}/sitemap.xml`;
const businessId = `${origin}/#business`;
const businessStreetAddress = 'Carrer Dr. Pi i Sunyer, 6';
const businessPhone = '+34972253795';
const businessProfiles = [
  'https://www.instagram.com/lagelateriaderoses/',
  'https://www.facebook.com/gelateriafeelingdor',
];
const businessDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  const typeCount = type => entities.filter(entity => entity?.['@type'] === type).length;
  const webPage = entities.find(entity => entity?.['@type'] === 'WebPage');
  if (typeCount('WebPage') !== 1) fail(`${route}: WebPage count ${typeCount('WebPage')}`);
  if (webPage?.url !== expectedCanonical) fail(`${route}: WebPage.url incorrecta`);
  if (webPage?.name !== title) fail(`${route}: WebPage.name no coincide con title`);
  if (webPage?.description !== description) fail(`${route}: WebPage.description no coincide con meta description`);
  if (webPage?.about?.['@id'] !== businessId) fail(`${route}: WebPage.about incorrecto`);
  const expectedLanguage = route === '/' ? 'es' : route.split('/')[1];
  if (webPage?.inLanguage !== expectedLanguage) fail(`${route}: WebPage.inLanguage ${webPage?.inLanguage} != ${expectedLanguage}`);

  if (homes.includes(route)) {
    if (typeCount('IceCreamShop') !== 1) fail(`${route}: IceCreamShop count ${typeCount('IceCreamShop')}`);
    const business = entities.find(entity => entity?.['@type'] === 'IceCreamShop');
    if (business?.telephone !== businessPhone) fail(`${route}: teléfono del negocio incorrecto`);
    if (business?.address?.streetAddress !== businessStreetAddress) fail(`${route}: dirección del negocio incorrecta`);
    if (business && Object.hasOwn(business, 'aggregateRating')) fail(`${route}: aggregateRating autocontrolado no debe publicarse`);
    if (JSON.stringify(business?.sameAs) !== JSON.stringify(businessProfiles)) fail(`${route}: perfiles sociales del negocio incorrectos`);

    const openingHours = business?.openingHoursSpecification;
    if (
      !openingHours ||
      Array.isArray(openingHours) ||
      openingHours?.['@type'] !== 'OpeningHoursSpecification' ||
      JSON.stringify(openingHours?.dayOfWeek) !== JSON.stringify(businessDays) ||
      openingHours?.opens !== '10:00' ||
      openingHours?.closes !== '01:30'
    ) {
      fail(`${route}: el horario estructurado de verano debe ser 10:00-01:30 todos los días`);
    }

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
    if (typeCount('FAQPage') !== 1) fail(`${route}: FAQPage count ${typeCount('FAQPage')}`);
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
  ]) {
    if (!workflow.includes(marker)) fail(`workflow SEO: falta ${marker}`);
  }
}

if (errors.length) {
  for (const error of [...new Set(errors)].sort()) console.error(`FAIL: ${error}`);
  process.exit(1);
}

console.log('PASS: SEO architecture validates 10/10 indexable pages plus 404 and CI from every language home; P9 French intent contracts, H1, metadata, social cards, canonical, hreflang, sitemap, JSON-LD, links and fragments are consistent.');
