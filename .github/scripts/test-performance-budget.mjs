import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  guideFiles,
  heroAssets,
  homeFiles,
  inspectRepository,
  limits,
  referencedAssetPaths,
  validateBudgetSnapshot,
} from './performance-budget.mjs';

const validHome = `<!doctype html><html><head>
<link rel="preload" as="image" href="${heroAssets.portrait}">
<link rel="preload" as="image" href="${heroAssets.landscape}">
</head><body><section id="hero"><picture>
<source srcset="${heroAssets.portrait}" width="960" height="901">
<img src="${heroAssets.landscape}" width="1600" height="901" fetchpriority="high" alt="Hero">
</picture></section><section><img src="/assets/img/below.webp" width="800" height="600" loading="lazy" alt=""></section><footer></footer></body></html>`;

const validAssets = new Map([
  [heroAssets.portrait, limits.heroPortraitBytes],
  [heroAssets.landscape, limits.heroLandscapeBytes],
  ['/assets/img/below.webp', 1024],
]);

const errorsFor = ({ home = validHome, guide = '<main>Guía</main>', assets = validAssets } = {}) => validateBudgetSnapshot({
  homes: new Map([['index.html', home]]),
  guides: new Map([['fr/guide/index.html', guide]]),
  assetSizes: assets,
});

assert.deepEqual(errorsFor(), []);

const reorderedPreloads = validHome
  .replace(`<link rel="preload" as="image" href="${heroAssets.portrait}">`, `<link href='${heroAssets.portrait}' media='(orientation:portrait)' as='image' rel='preload'>`)
  .replace(`<link rel="preload" as="image" href="${heroAssets.landscape}">`, `<link as='image' href='${heroAssets.landscape}' rel='preload'>`);
assert.deepEqual(errorsFor({ home: reorderedPreloads }), []);

const discoveryHtml = `<img src="/assets/img/primary.webp" srcset="/assets/img/secondary.webp 600w, /assets/img/tertiary.webp 800w"><meta property="og:image" content="https://lagelateriaderoses.com/assets/img/social.jpg">`;
assert.deepEqual(
  [...referencedAssetPaths(discoveryHtml)].sort(),
  ['/assets/img/primary.webp', '/assets/img/secondary.webp', '/assets/img/social.jpg', '/assets/img/tertiary.webp'],
);

const mutations = [
  ['home sobredimensionada', { home: validHome + 'x'.repeat(limits.homeBytes) }, 'presupuesto home'],
  ['guía sobredimensionada', { guide: 'x'.repeat(limits.guideBytes + 1) }, 'presupuesto guía'],
  ['recurso sobredimensionado', { assets: new Map([...validAssets, ['/assets/img/huge.webp', limits.assetBytes + 1]]) }, 'presupuesto de recurso'],
  ['hero portrait pesado', { assets: new Map([...validAssets, [heroAssets.portrait, limits.heroPortraitBytes + 1]]) }, heroAssets.portrait],
  ['hero landscape pesado', { assets: new Map([...validAssets, [heroAssets.landscape, limits.heroLandscapeBytes + 1]]) }, heroAssets.landscape],
  ['imagen sin dimensiones', { home: validHome.replace(' width="800" height="600"', '') }, 'sin dimensiones'],
  ['hero lazy', { home: validHome.replace('fetchpriority="high"', 'fetchpriority="high" loading="lazy"') }, 'no puede ser lazy'],
  ['hero sin prioridad', { home: validHome.replace(' fetchpriority="high"', '') }, 'fetchpriority'],
  ['imagen inferior eager', { home: validHome.replace(' loading="lazy" alt=""', ' alt=""') }, 'posterior al hero'],
  ['imagen de footer eager', { home: validHome.replace('<footer></footer>', '<footer><img src="/assets/img/footer.webp" width="100" height="100" alt=""></footer>') }, 'posterior al hero'],
];

for (const [name, input, expected] of mutations) {
  const errors = errorsFor(input);
  assert.ok(errors.some(error => error.includes(expected)), `${name}: no se detectó ${expected}: ${errors.join(' | ')}`);
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gelateria-budget-'));
try {
  const inventoryHome = validHome
    .replace('</head>', '<meta property="og:image" content="https://lagelateriaderoses.com/assets/img/social.jpg"></head>')
    .replace('</section><footer>', '<img src="/assets/img/primary.webp" srcset="/assets/img/secondary.webp 600w, /assets/img/tertiary.webp 800w" width="800" height="600" loading="lazy" alt=""></section><footer>');
  for (const relative of homeFiles) {
    const filename = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, relative === 'index.html' ? inventoryHome : validHome);
  }
  for (const relative of guideFiles) {
    const filename = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, '<main>Guía</main>');
  }
  fs.writeFileSync(path.join(fixtureRoot, '404.html'), '<main>404</main>');
  const fixtureAssets = new Map([
    [heroAssets.portrait, 1024],
    [heroAssets.landscape, 1024],
    ['/assets/img/below.webp', 1024],
    ['/assets/img/primary.webp', 1024],
    ['/assets/img/secondary.webp', 1024],
    ['/assets/img/tertiary.webp', limits.assetBytes + 1],
    ['/assets/img/social.jpg', 1024],
  ]);
  for (const [asset, size] of fixtureAssets) {
    const filename = path.join(fixtureRoot, asset.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, Buffer.alloc(size));
  }

  const oversizedSnapshot = inspectRepository(fixtureRoot);
  assert.equal(oversizedSnapshot.assetSizes.size, fixtureAssets.size);
  assert.ok(validateBudgetSnapshot(oversizedSnapshot).some(error => error.includes('/assets/img/tertiary.webp')));

  fs.unlinkSync(path.join(fixtureRoot, 'assets/img/social.jpg'));
  const missingSnapshot = inspectRepository(fixtureRoot);
  assert.equal(missingSnapshot.assetSizes.get('/assets/img/social.jpg'), Number.POSITIVE_INFINITY);
  assert.ok(validateBudgetSnapshot(missingSnapshot).some(error => error.includes('/assets/img/social.jpg')));
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`PASS: ${mutations.length} mutaciones P13, extracción de srcset/social e integración de recursos ausentes o pesados.`);
