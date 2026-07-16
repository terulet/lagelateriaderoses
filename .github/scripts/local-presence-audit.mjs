import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROUTES } from './monitor-production-seo.mjs';

const MANIFEST = '.github/data/local-presence.json';
const PROFILE_PLATFORMS = ['google_maps', 'google_reviews', 'instagram', 'facebook', 'tripadvisor', 'apple_maps', 'bing_places', 'waze'];
const PROFILE_STATUSES = new Set(['owner_confirmed', 'repository_confirmed', 'public_reference_only', 'needs_human']);
const ALLOWED_HOSTS_BY_PLATFORM = new Map([
  ['google_maps', new Set(['www.google.com', 'consent.google.com'])],
  ['google_reviews', new Set(['g.page', 'www.google.com', 'consent.google.com'])],
  ['instagram', new Set(['www.instagram.com', 'instagram.com'])],
  ['facebook', new Set(['www.facebook.com', 'facebook.com', 'm.facebook.com'])],
  ['tripadvisor', new Set(['www.tripadvisor.com', 'www.tripadvisor.es', 'www.tripadvisor.fr'])],
  ['apple_maps', new Set(['maps.apple.com'])],
  ['bing_places', new Set(['www.bing.com'])],
  ['waze', new Set(['www.waze.com', 'waze.com'])],
]);

export function loadManifest(root = '.') {
  return JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
}

export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion debe ser 1');
  const business = manifest?.business || {};
  for (const field of ['id', 'name', 'url', 'telephone', 'email', 'address', 'geo', 'googlePlaceId', 'mapUrl']) {
    if (!business[field]) errors.push(`business.${field} ausente`);
  }
  if (!/^\+[1-9]\d{7,14}$/.test(business.telephone || '')) errors.push('business.telephone no usa E.164');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(business.email || '')) errors.push('business.email inválido');
  const profiles = Array.isArray(manifest?.profiles) ? manifest.profiles : [];
  const platforms = profiles.map(profile => profile.platform);
  if (new Set(platforms).size !== platforms.length) errors.push('plataforma duplicada');
  for (const platform of PROFILE_PLATFORMS) if (!platforms.includes(platform)) errors.push(`plataforma ausente ${platform}`);
  for (const profile of profiles) {
    if (!Array.isArray(profile.expectedHosts) || !profile.expectedHosts.length) errors.push(`${profile.platform}: expectedHosts ausente`);
    if (!['advisory', 'skip'].includes(profile.httpCheck)) errors.push(`${profile.platform}: httpCheck inválido`);
    if (!PROFILE_STATUSES.has(profile.status)) errors.push(`${profile.platform}: status inválido`);
    if (!Array.isArray(profile.humanVerification) || !profile.humanVerification.length) errors.push(`${profile.platform}: humanVerification ausente`);
    const allowedHosts = ALLOWED_HOSTS_BY_PLATFORM.get(profile.platform) || new Set();
    for (const host of profile.expectedHosts || []) if (!allowedHosts.has(host)) errors.push(`${profile.platform}: host fuera de la lista inmutable ${host}`);
    if (!profile.publicUrl) {
      if (profile.httpCheck !== 'skip' || profile.status !== 'needs_human') errors.push(`${profile.platform}: URL ausente debe usar needs_human y skip`);
      warnings.push(`${profile.platform}: NEEDS_HUMAN — ${profile.humanVerification.join(', ')}`);
      continue;
    }
    if (profile.httpCheck !== 'advisory' || profile.status === 'needs_human') errors.push(`${profile.platform}: URL pública debe usar advisory y un estado confirmado`);
    errors.push(...validatePublicUrl(profile.publicUrl, [...allowedHosts]).map(error => `${profile.platform}: ${error}`));
  }
  const whatsapp = manifest?.contactChannels?.whatsapp;
  if (whatsapp && !/^\+[1-9]\d{7,14}$/.test(whatsapp.value || '')) errors.push('contactChannels.whatsapp.value no usa E.164');
  if (whatsapp && !['owner_confirmed', 'needs_owner_verification'].includes(whatsapp.status)) errors.push('contactChannels.whatsapp.status inválido');
  return { errors, warnings };
}

function parseJsonLd(html, label, errors) {
  const output = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]);
      output.push(...(Array.isArray(value) ? value : [value]));
    } catch (error) {
      errors.push(`${label}: JSON-LD inválido (${error.message})`);
    }
  }
  return output;
}

function visibleTextFromHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(value) {
  if (Array.isArray(value)) return value.map(normalizeComparable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizeComparable(value[key])]));
}

function sameJson(left, right) {
  return JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));
}

export function auditStatic({ root = '.', manifest = loadManifest(root) } = {}) {
  const manifestResult = validateManifest(manifest);
  const errors = [...manifestResult.errors];
  const warnings = [...manifestResult.warnings];
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const sitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/lagelateriaderoses\.com([^<]*)<\/loc>/g)].map(match => match[1] || '/');
  const routeNames = [...ROUTES.keys()];
  if (!sameJson([...sitemapRoutes].sort(), [...routeNames].sort())) errors.push('sitemap y ROUTES no coinciden');

  const business = manifest.business;
  const expectedSameAs = manifest.profiles
    .filter(profile => ['instagram', 'facebook'].includes(profile.platform))
    .map(profile => profile.publicUrl)
    .sort();
  const profilesByPlatform = new Map(manifest.profiles.map(profile => [profile.platform, profile]));
  const schemaRoutes = new Set(manifest.website?.businessSchemaRoutes || []);
  const expectedMapEmbed = `https://www.google.com/maps?q=place_id%3A${business.googlePlaceId}&amp;output=embed`;
  for (const route of schemaRoutes) {
    const relative = ROUTES.get(route);
    if (!relative) {
      errors.push(`${route}: ruta Schema no registrada`);
      continue;
    }
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    if (!html.includes(`src="${expectedMapEmbed}"`)) errors.push(`${route}: mapa embebido no usa el Google Place ID del manifiesto`);
    const entities = parseJsonLd(html, route, errors);
    const entity = entities.find(item => item?.['@type'] === 'IceCreamShop');
    if (!entity) {
      errors.push(`${route}: IceCreamShop ausente`);
      continue;
    }
    const expected = {
      id: business.id,
      name: business.name,
      url: business.url,
      telephone: business.telephone,
      email: business.email,
      address: business.address,
      geo: business.geo,
      mapUrl: business.mapUrl,
      sameAs: expectedSameAs,
    };
    if (entity['@id'] !== expected.id) errors.push(`${route}: @id distinto del manifiesto`);
    if (entity.name !== expected.name) errors.push(`${route}: nombre distinto del manifiesto`);
    if (entity.url !== expected.url) errors.push(`${route}: URL distinta del manifiesto`);
    if (entity.telephone !== expected.telephone) errors.push(`${route}: teléfono distinto del manifiesto`);
    if (entity.email !== expected.email) errors.push(`${route}: email distinto del manifiesto`);
    const address = { ...entity.address };
    delete address['@type'];
    if (!sameJson(address, expected.address)) errors.push(`${route}: dirección distinta del manifiesto`);
    const geo = { ...entity.geo };
    delete geo['@type'];
    if (!sameJson(geo, expected.geo)) errors.push(`${route}: coordenadas distintas del manifiesto`);
    if (entity.hasMap !== expected.mapUrl) errors.push(`${route}: mapa distinto del manifiesto`);
    if (!sameJson([...(entity.sameAs || [])].sort(), expected.sameAs)) errors.push(`${route}: sameAs distinto del manifiesto`);
  }

  const whatsapp = manifest.contactChannels?.whatsapp;
  const whatsappRoutes = new Set();
  for (const [route, relative] of ROUTES) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    const visibleText = visibleTextFromHtml(html);
    if (!visibleText.includes(business.address.streetAddress) || !visibleText.includes(`${business.address.postalCode} ${business.address.addressLocality}`)) {
      errors.push(`${route}: dirección visible incompleta o distinta del manifiesto`);
    }
    const visibleWithoutCanonicalStreet = visibleText.replaceAll(business.address.streetAddress, '');
    if (/\b(?:carrer|calle|avinguda|avenida|passeig|plaça|plaza|rue|straat|street|straße)\b[^.!?·]{0,80}\d/i.test(visibleWithoutCanonicalStreet)) {
      errors.push(`${route}: dirección visible alternativa detectada`);
    }
    for (const match of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
      const value = match[1].replace(/[\s()-]/g, '');
      if (value !== business.telephone) errors.push(`${route}: tel no registrado ${match[1]}`);
    }
    for (const match of html.matchAll(/href=["']mailto:([^"'?]+)[^"']*["']/gi)) {
      if (match[1].toLowerCase() !== business.email.toLowerCase()) errors.push(`${route}: mailto no registrado ${match[1]}`);
    }
    for (const match of html.matchAll(/https:\/\/wa\.me\/(\d+)/gi)) {
      const value = `+${match[1]}`;
      if (!whatsapp || value !== whatsapp.value) errors.push(`${route}: WhatsApp no registrado ${value}`);
      else if (whatsapp.status === 'needs_owner_verification') whatsappRoutes.add(route);
    }
    for (const match of html.matchAll(/destination_place_id=([^&"']+)/gi)) {
      if (decodeURIComponent(match[1]) !== business.googlePlaceId) errors.push(`${route}: Google Place ID distinto`);
    }
    for (const match of html.matchAll(/href=["'](https:\/\/[^"']+)["']/gi)) {
      const href = match[1].replaceAll('&amp;', '&');
      let url;
      try { url = new URL(href); } catch { continue; }
      if (['www.instagram.com', 'instagram.com'].includes(url.hostname) && href !== profilesByPlatform.get('instagram')?.publicUrl) {
        errors.push(`${route}: Instagram distinto del manifiesto ${href}`);
      }
      if (['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(url.hostname) && href !== profilesByPlatform.get('facebook')?.publicUrl) {
        errors.push(`${route}: Facebook distinto del manifiesto ${href}`);
      }
      if (url.hostname === 'g.page') {
        const reviews = profilesByPlatform.get('google_reviews')?.publicUrl;
        if (![reviews, `${reviews}/review`].includes(href)) errors.push(`${route}: Google Reviews distinto del manifiesto ${href}`);
      }
      if (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps') && url.searchParams.has('q')) {
        const query = url.searchParams.get('q').toLowerCase();
        for (const part of [business.address.streetAddress, business.address.postalCode, business.address.addressLocality]) {
          if (!query.includes(String(part).toLowerCase())) errors.push(`${route}: dirección de Google Maps no coincide con ${part}`);
        }
      }
    }
  }
  if (whatsappRoutes.size) warnings.push(`WhatsApp ${whatsapp.value}: NEEDS_HUMAN en ${[...whatsappRoutes].join(', ')}`);
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], checkedRoutes: ROUTES.size };
}

export function validatePublicUrl(value, expectedHosts) {
  const errors = [];
  let url;
  try { url = new URL(value); } catch { return ['URL inválida']; }
  if (url.protocol !== 'https:') errors.push('solo se permite HTTPS');
  if (url.username || url.password) errors.push('credenciales incrustadas');
  const bareHostname = url.hostname.replace(/^\[|\]$/g, '');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || net.isIP(bareHostname)) errors.push('host local, privado o IP literal');
  if (/\/(?:login|oauth|admin)(?:\/|$)/i.test(url.pathname)) errors.push('endpoint sensible no permitido');
  if (!expectedHosts.includes(url.hostname)) errors.push(`host no permitido ${url.hostname}`);
  return errors;
}

export function classifyPublicStatus(status) {
  if (status >= 200 && status < 300) return 'REACHABLE';
  if (status >= 300 && status < 400) return 'UNKNOWN';
  if ([401, 403, 429].includes(status)) return 'UNKNOWN';
  if ([404, 410].includes(status)) return 'WARNING_HIGH';
  if (status >= 500) return 'WARNING';
  return 'UNKNOWN';
}

export function hasBlockingPublicFailure(results) {
  return results.some(result => result.status === 'WARNING_HIGH');
}

async function requestPublic(url, expectedHosts, fetchImpl) {
  let current = url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const safety = validatePublicUrl(current, expectedHosts);
    if (safety.includes('endpoint sensible no permitido')) {
      const otherSafety = safety.filter(item => item !== 'endpoint sensible no permitido');
      if (otherSafety.length) return { status: 'WARNING_HIGH', url: current, detail: otherSafety.join('; ') };
      return { status: 'UNKNOWN', url: current, detail: 'muro de login o endpoint sensible no visitado' };
    }
    if (safety.length) return { status: 'WARNING_HIGH', url: current, detail: safety.join('; ') };
    if (new URL(current).hostname === 'consent.google.com') {
      return { status: 'UNKNOWN', url: current, detail: 'intersticial de consentimiento' };
    }
    let response;
    try {
      response = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'LaGelateriaSEO-Monitor/1.0' } });
    } catch (error) {
      return { status: 'WARNING', url: current, detail: error.message };
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { status: 'WARNING_HIGH', url: current, http: response.status, detail: 'redirección sin Location' };
      try {
        current = new URL(location, current).href;
      } catch {
        return { status: 'WARNING_HIGH', url: current, http: response.status, detail: 'Location inválido' };
      }
      continue;
    }
    return { status: classifyPublicStatus(response.status), url: current, http: response.status };
  }
  return { status: 'WARNING_HIGH', url: current, detail: 'demasiadas redirecciones' };
}

export async function auditPublic({ manifest, fetchImpl = fetch } = {}) {
  const results = [];
  for (const profile of manifest.profiles) {
    if (!profile.publicUrl || profile.httpCheck === 'skip') {
      results.push({ platform: profile.platform, status: 'NEEDS_HUMAN', url: profile.publicUrl, detail: profile.humanVerification.join(', ') });
      continue;
    }
    const allowedHosts = [...(ALLOWED_HOSTS_BY_PLATFORM.get(profile.platform) || [])];
    results.push({ platform: profile.platform, ...(await requestPublic(profile.publicUrl, allowedHosts, fetchImpl)) });
  }
  return results;
}

export function renderReport({ staticResult, publicResults = [], commit = 'local' }) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
  const lines = [
    '# Auditoría de presencia local', '',
    `- Commit: \`${commit}\``,
    `- Rutas web comprobadas: ${staticResult.checkedRoutes}`,
    `- Errores internos: ${staticResult.errors.length}`,
    `- Avisos: ${staticResult.warnings.length}`, '',
    '## Consistencia interna', '',
    ...(staticResult.errors.length ? staticResult.errors.map(item => `- ERROR: ${item}`) : ['- PASS: NAP, Schema, perfiles y contactos coherentes.']), '',
    '## Avisos y verificación humana', '',
    ...(staticResult.warnings.length ? staticResult.warnings.map(item => `- ${item}`) : ['- Ninguno.']), '',
    '## Plataformas públicas', '',
    '| Plataforma | Estado | HTTP | URL | Detalle |', '|---|---:|---:|---|---|',
    ...publicResults.map(item => `| ${cell(item.platform)} | ${cell(item.status)} | ${cell(item.http)} | ${cell(item.url ?? 'pendiente')} | ${cell(item.detail)} |`), '',
    staticResult.errors.length ? '**Resultado: FAIL_INTERNAL_CONSISTENCY**' : staticResult.warnings.length || publicResults.some(item => item.status !== 'REACHABLE') ? '**Resultado: PASS_WITH_WARNINGS**' : '**Resultado: PASS**',
  ];
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const rootArg = args.find(arg => !arg.startsWith('--')) || '.';
  const root = path.resolve(rootArg);
  const manifest = loadManifest(root);
  const staticResult = auditStatic({ root, manifest });
  const publicResults = args.includes('--public') ? await auditPublic({ manifest }) : [];
  const report = renderReport({ staticResult, publicResults, commit: process.env.GITHUB_SHA || 'local' });
  const reportIndex = args.indexOf('--report');
  if (reportIndex >= 0) {
    const reportPath = path.resolve(root, args[reportIndex + 1]);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${report}\n`, 'utf8');
  }
  console.log(report);
  if (staticResult.errors.length || (args.includes('--strict-public') && hasBlockingPublicFailure(publicResults))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
