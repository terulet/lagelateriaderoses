import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_ORIGIN = 'https://lagelateriaderoses.com';

export const ROUTES = new Map([
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
  ['/nl/ijssalon-roses/', 'nl/ijssalon-roses/index.html'],
  ['/nl/beste-ijssalon-roses/', 'nl/beste-ijssalon-roses/index.html'],
  ['/nl/stranden-roses/', 'nl/stranden-roses/index.html'],
  ['/nl/wat-te-doen-in-roses/', 'nl/wat-te-doen-in-roses/index.html'],
]);

const TEXT_FILES = new Map([
  ...ROUTES,
  ['/sitemap.xml', 'sitemap.xml'],
  ['/robots.txt', 'robots.txt'],
]);

const ASSET_PATTERN = /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?)$/i;
const FOLLOWABLE_REDIRECT_STATUSES = new Set([301, 302, 307, 308]);
const PERMANENT_REDIRECT_STATUSES = new Set([301, 308]);
const TEXT_ASSET_PATTERN = /\.(?:css|js|mjs|svg)$/i;

export function normalizeText(text) {
  return String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd();
}

export function extractAssetUrls(text, baseUrl, origin = DEFAULT_ORIGIN) {
  const assets = new Set();
  const add = candidate => {
    const value = candidate.trim().replace(/^['"]|['"]$/g, '');
    if (!value || value.startsWith('data:')) return;
    let url;
    try {
      url = new URL(value, baseUrl);
    } catch {
      return;
    }
    if (url.origin !== origin || !ASSET_PATTERN.test(url.pathname)) return;
    assets.add(url.pathname);
  };

  for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) add(match[1]);
  for (const match of text.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(',')) add(candidate.trim().split(/\s+/)[0]);
  }
  for (const match of text.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = tag.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key !== 'og:image' && key !== 'twitter:image') continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (content) add(content);
  }
  for (const match of text.matchAll(/url\(\s*([^)]*?)\s*\)/gi)) add(match[1]);
  return assets;
}

export function validateResponse(response, { label, expectedStatus = 200, requireBody = true, bodyLength = null }) {
  const errors = [];
  if (response.status !== expectedStatus) errors.push(`${label}: HTTP ${response.status}, esperado ${expectedStatus}`);
  if (requireBody && bodyLength === 0) errors.push(`${label}: respuesta vacía`);
  return errors;
}

export function validateRedirectTrace(trace, expectedFinalUrl) {
  const errors = [];
  if (!trace.hops.length) errors.push(`${trace.startUrl}: no redirige`);
  for (const hop of trace.hops) {
    if (!PERMANENT_REDIRECT_STATUSES.has(hop.status)) {
      errors.push(`${hop.url}: redirección temporal HTTP ${hop.status}, esperada 301 o 308`);
    }
  }
  if (trace.finalUrl !== expectedFinalUrl) {
    errors.push(`${trace.startUrl}: destino final ${trace.finalUrl}, esperado ${expectedFinalUrl}`);
  }
  return errors;
}

export function assetBodiesMatch(assetPath, remoteBytes, localBytes) {
  const remote = Buffer.from(remoteBytes);
  const local = Buffer.from(localBytes);
  if (TEXT_ASSET_PATTERN.test(assetPath)) {
    return normalizeText(remote.toString('utf8')) === normalizeText(local.toString('utf8'));
  }
  return remote.equals(local);
}

export async function fetchWithRetries(url, {
  fetchImpl = globalThis.fetch,
  attempts = 3,
  timeoutMs = 15_000,
  redirect = 'follow',
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        redirect,
        signal: controller.signal,
        headers: { 'user-agent': 'La-Gelateria-SEO-Monitor/1.0' },
      });
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        lastError = new Error(`${url}: HTTP transitorio ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`${url}: no se pudo completar la petición`);
}

export async function traceRedirects(startUrl, {
  fetchImpl = globalThis.fetch,
  maximumHops = 5,
} = {}) {
  const seen = new Set();
  const hops = [];
  let currentUrl = startUrl;

  for (let index = 0; index <= maximumHops; index += 1) {
    if (seen.has(currentUrl)) throw new Error(`${startUrl}: bucle de redirección en ${currentUrl}`);
    seen.add(currentUrl);
    const response = await fetchWithRetries(currentUrl, { fetchImpl, redirect: 'manual' });
    if (!FOLLOWABLE_REDIRECT_STATUSES.has(response.status)) {
      return { startUrl, finalUrl: currentUrl, finalStatus: response.status, hops };
    }
    const location = response.headers.get('location');
    if (!location) throw new Error(`${currentUrl}: redirección ${response.status} sin Location`);
    hops.push({ url: currentUrl, status: response.status, location });
    currentUrl = new URL(location, currentUrl).href;
  }
  throw new Error(`${startUrl}: supera ${maximumHops} redirecciones`);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function collectLocalAssets(root, origin) {
  const assets = new Set();
  for (const [route, file] of [...ROUTES, ['/404.html', '404.html']]) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const asset of extractAssetUrls(content, `${origin}${route}`, origin)) assets.add(asset);
  }
  for (const asset of [...assets]) {
    if (!asset.endsWith('.css')) continue;
    const localPath = path.join(root, decodeURIComponent(asset).replace(/^\/+/, ''));
    if (!fs.existsSync(localPath)) continue;
    const css = fs.readFileSync(localPath, 'utf8');
    for (const nested of extractAssetUrls(css, `${origin}${asset}`, origin)) assets.add(nested);
  }
  return [...assets].sort();
}

export async function runMonitor({
  root = '.',
  origin = DEFAULT_ORIGIN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const checkedPages = [];

  for (const [route, file] of TEXT_FILES) {
    const label = `${origin}${route}`;
    try {
      const response = await fetchWithRetries(label, { fetchImpl });
      const body = await response.text();
      errors.push(...validateResponse(response, { label, bodyLength: body.length }));
      const local = fs.readFileSync(path.join(resolvedRoot, file), 'utf8');
      if (response.status === 200 && normalizeText(body) !== normalizeText(local)) {
        errors.push(`${label}: producción no coincide con ${file}`);
      }
      checkedPages.push(label);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  const missingUrl = `${origin}/__seo-production-monitor-missing__/`;
  try {
    const response = await fetchWithRetries(missingUrl, { fetchImpl, redirect: 'manual' });
    const body = await response.text();
    errors.push(...validateResponse(response, {
      label: missingUrl,
      expectedStatus: 404,
      bodyLength: body.length,
    }));
    const local404 = fs.readFileSync(path.join(resolvedRoot, '404.html'), 'utf8');
    if (response.status === 404 && normalizeText(body) !== normalizeText(local404)) {
      errors.push(`${missingUrl}: la 404 pública no coincide con 404.html`);
    }
  } catch (error) {
    errors.push(`${missingUrl}: ${error.message}`);
  }

  for (const source of [
    'http://lagelateriaderoses.com/',
    'https://www.lagelateriaderoses.com/',
    'http://www.lagelateriaderoses.com/',
  ]) {
    try {
      const trace = await traceRedirects(source, { fetchImpl });
      errors.push(...validateRedirectTrace(trace, `${origin}/`));
      if (trace.finalStatus !== 200) errors.push(`${source}: destino final HTTP ${trace.finalStatus}, esperado 200`);
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }

  const assets = collectLocalAssets(resolvedRoot, origin);
  await mapLimit(assets, 8, async asset => {
    const url = `${origin}${asset}`;
    try {
      const response = await fetchWithRetries(url, { fetchImpl });
      const body = Buffer.from(await response.arrayBuffer());
      errors.push(...validateResponse(response, { label: url, bodyLength: body.byteLength }));
      if (response.url && response.url !== url) errors.push(`${url}: termina redirigido a ${response.url}`);
      const localPath = path.join(resolvedRoot, decodeURIComponent(asset).replace(/^\/+/, ''));
      if (!fs.existsSync(localPath)) {
        errors.push(`${asset}: falta el recurso local`);
      } else if (response.status === 200 && !assetBodiesMatch(asset, body, fs.readFileSync(localPath))) {
        errors.push(`${url}: producción no coincide con el recurso local`);
      }
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  });

  return {
    errors: [...new Set(errors)].sort(),
    checkedTextUrls: checkedPages.length,
    checkedAssets: assets.length,
    checkedRedirects: 3,
    checkedNotFound: 1,
  };
}

async function main() {
  const result = await runMonitor({ root: process.argv[2] || '.' });
  if (result.errors.length) {
    for (const error of result.errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS: producción SEO monitorizada: ${result.checkedTextUrls} páginas/archivos de texto, ` +
    `${result.checkedAssets} recursos, ${result.checkedRedirects} cadenas de redirección y 404 real.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
