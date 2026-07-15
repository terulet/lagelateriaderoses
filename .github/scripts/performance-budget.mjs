import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAssetUrls } from './monitor-production-seo.mjs';

export const limits = Object.freeze({
  homeBytes: 130 * 1024,
  guideBytes: 20 * 1024,
  assetBytes: 220 * 1024,
  heroPortraitBytes: 85 * 1024,
  heroLandscapeBytes: 125 * 1024,
});

export const homeFiles = [
  'index.html',
  'ca/index.html',
  'en/index.html',
  'fr/index.html',
  'de/index.html',
  'nl/index.html',
];

export const guideFiles = [
  'fr/glacier-roses/index.html',
  'fr/meilleur-glacier-roses/index.html',
  'fr/meilleures-plages-roses/index.html',
  'fr/que-faire-a-roses/index.html',
];

export const heroAssets = Object.freeze({
  portrait: '/assets/img/img-55-027c36da645b.webp',
  landscape: '/assets/img/img-55-7082859e91ee.webp',
});

const count = (text, needle) => text.split(needle).length - 1;
const imageTags = html => [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);

export function referencedAssetPaths(html, baseUrl = 'https://lagelateriaderoses.com/') {
  return extractAssetUrls(html, baseUrl);
}

export function imagePreloads(html, asset) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => /\brel=["']preload["']/i.test(tag))
    .filter(tag => /\bas=["']image["']/i.test(tag))
    .filter(tag => tag.match(/\bhref=["']([^"']+)["']/i)?.[1] === asset);
}

export function validateHomeDocument(label, html, assetSizes = new Map()) {
  const errors = [];
  const allImages = imageTags(html);
  for (const tag of allImages) {
    if (!/\bwidth=["']\d+["']/i.test(tag) || !/\bheight=["']\d+["']/i.test(tag)) {
      errors.push(`${label}: imagen sin dimensiones ${tag.slice(0, 100)}`);
    }
  }

  const heroStart = html.indexOf('<section id="hero">');
  const heroEnd = heroStart < 0 ? -1 : html.indexOf('</section>', heroStart);
  if (heroStart < 0 || heroEnd < 0) {
    errors.push(`${label}: sección hero ausente`);
    return errors;
  }

  const hero = html.slice(heroStart, heroEnd + '</section>'.length);
  const heroImages = imageTags(hero);
  if (heroImages.length < 1) errors.push(`${label}: el hero debe contener al menos una imagen`);
  const priorityImages = heroImages.filter(tag => /\bfetchpriority=["']high["']/i.test(tag));
  if (priorityImages.length !== 1) errors.push(`${label}: imagen LCP sin fetchpriority="high" único`);
  if (priorityImages.some(tag => /\bloading=["']lazy["']/i.test(tag))) errors.push(`${label}: imagen LCP no puede ser lazy`);
  for (const asset of Object.values(heroAssets)) {
    if (imagePreloads(html, asset).length !== 1) errors.push(`${label}: preload hero ausente o duplicado ${asset}`);
    if (!hero.includes(asset)) errors.push(`${label}: hero no usa ${asset}`);
  }

  const belowFold = html.slice(heroEnd + '</section>'.length);
  for (const tag of imageTags(belowFold)) {
    if (!/\bloading=["']lazy["']/i.test(tag)) errors.push(`${label}: imagen posterior al hero sin lazy loading ${tag.slice(0, 100)}`);
  }

  const portraitSize = assetSizes.get(heroAssets.portrait);
  const landscapeSize = assetSizes.get(heroAssets.landscape);
  if (portraitSize !== undefined && portraitSize > limits.heroPortraitBytes) errors.push(`${heroAssets.portrait}: ${portraitSize} bytes supera ${limits.heroPortraitBytes}`);
  if (landscapeSize !== undefined && landscapeSize > limits.heroLandscapeBytes) errors.push(`${heroAssets.landscape}: ${landscapeSize} bytes supera ${limits.heroLandscapeBytes}`);
  return errors;
}

export function validateBudgetSnapshot({ homes, guides, assetSizes }) {
  const errors = [];
  for (const [label, html] of homes) {
    const size = Buffer.byteLength(html);
    if (size > limits.homeBytes) errors.push(`${label}: ${size} bytes supera presupuesto home ${limits.homeBytes}`);
    errors.push(...validateHomeDocument(label, html, assetSizes));
  }
  for (const [label, html] of guides) {
    const size = Buffer.byteLength(html);
    if (size > limits.guideBytes) errors.push(`${label}: ${size} bytes supera presupuesto guía ${limits.guideBytes}`);
  }
  for (const [asset, size] of assetSizes) {
    if (size > limits.assetBytes) errors.push(`${asset}: ${size} bytes supera presupuesto de recurso ${limits.assetBytes}`);
  }
  return [...new Set(errors)];
}

export function inspectRepository(root) {
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const homes = new Map(homeFiles.map(relative => [relative, read(relative)]));
  const guides = new Map(guideFiles.map(relative => [relative, read(relative)]));
  const documents = [
    ...[...homes.entries()].map(([relative, html]) => [relative, html]),
    ...[...guides.entries()].map(([relative, html]) => [relative, html]),
    ['404.html', read('404.html')],
  ];
  const references = new Set(documents.flatMap(([relative, html]) => [
    ...referencedAssetPaths(html, new URL(relative.replace(/index\.html$/, ''), 'https://lagelateriaderoses.com/').href),
  ]));
  const assetSizes = new Map();
  for (const asset of references) {
    const filename = path.join(root, asset.replace(/^\//, ''));
    if (!fs.existsSync(filename)) {
      assetSizes.set(asset, Number.POSITIVE_INFINITY);
      continue;
    }
    assetSizes.set(asset, fs.statSync(filename).size);
  }
  return { homes, guides, assetSizes };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(process.argv[2] || '.');
  const snapshot = inspectRepository(root);
  const errors = validateBudgetSnapshot(snapshot);
  if (errors.length) {
    console.error(errors.map(error => `FAIL: ${error}`).join('\n'));
    process.exit(1);
  }
  console.log(`PASS: presupuestos P13: ${snapshot.homes.size} portadas, ${snapshot.guides.size} guías y ${snapshot.assetSizes.size} recursos referenciados.`);
}
