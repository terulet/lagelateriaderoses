import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('.');
const validator = path.join(root, '.github/scripts/validate-internal-architecture.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gelateria-p14-'));

function run(fixture) {
  return spawnSync(process.execPath, [validator, fixture], { encoding: 'utf8' });
}

function copyFixture(name) {
  const fixture = path.join(tempRoot, name);
  fs.cpSync(root, fixture, { recursive: true, filter: source => !['.git', 'artifacts'].includes(path.basename(source)) });
  return fixture;
}

function mutateFile(fixture, relative, transform) {
  const filename = path.join(fixture, relative);
  const before = fs.readFileSync(filename, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `${relative}: la mutación no cambió el archivo`);
  fs.writeFileSync(filename, after, 'utf8');
}

function expectFailure(name, relative, transform, pattern) {
  const fixture = copyFixture(name);
  mutateFile(fixture, relative, transform);
  const result = run(fixture);
  assert.notEqual(result.status, 0, `${name}: el validador aceptó la mutación`);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern, `${name}: fallo inesperado`);
  console.log(`PASS: P14 rechaza ${name}`);
}

try {
  const baseline = run(root);
  assert.equal(baseline.status, 0, baseline.stderr);
  const copiedBaseline = copyFixture('baseline-copy');
  assert.equal(fs.existsSync(path.join(copiedBaseline, '.github/scripts/validate-internal-architecture.mjs')), true, 'la fixture debe conservar .github');
  const copiedBaselineResult = run(copiedBaseline);
  assert.equal(copiedBaselineResult.status, 0, `fixture baseline inválida:\n${copiedBaselineResult.stdout}\n${copiedBaselineResult.stderr}`);
  console.log('PASS: fixture P14 completa y baseline válida');

  expectFailure('URL neerlandesa ausente del sitemap', 'sitemap.xml', text => text.replace(/\s*<url>\s*<loc>https:\/\/lagelateriaderoses\.com\/nl\/wat-te-doen-in-roses\/<\/loc>\s*<\/url>/, ''), /sitemap/);
  expectFailure('hreflang neerlandés unilateral', 'fr/glacier-roses/index.html', text => text.replace(/\s*<link rel="alternate" hreflang="nl"[^>]+>/, ''), /hreflang/);
  expectFailure('x-default contradictorio', 'nl/ijssalon-roses/index.html', text => text.replace('hreflang="x-default" href="https://lagelateriaderoses.com/fr/glacier-roses/"', 'hreflang="x-default" href="https://lagelateriaderoses.com/nl/ijssalon-roses/"'), /x-default/);
  expectFailure('breadcrumb NL hacia la portada francesa', 'nl/stranden-roses/index.html', text => text.replace('"item":"https://lagelateriaderoses.com/nl/"', '"item":"https://lagelateriaderoses.com/fr/"'), /breadcrumb/);
  expectFailure('guía comercial sin about', 'nl/ijssalon-roses/index.html', text => text.replace(/,\s*"about":\{"@id":"https:\/\/lagelateriaderoses\.com\/#business"\}/, ''), /WebPage\.about/);
  expectFailure('guía informativa con about', 'nl/stranden-roses/index.html', text => text.replace('"inLanguage":"nl","isPartOf"', '"inLanguage":"nl","about":{"@id":"https://lagelateriaderoses.com/#business"},"isPartOf"'), /WebPage\.about/);
  expectFailure('FAQPage reintroducido', 'nl/wat-te-doen-in-roses/index.html', text => text.replace('</head>', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script></head>'), /FAQPage/);
  expectFailure('solo tres preguntas visibles', 'nl/beste-ijssalon-roses/index.html', text => text.replace(/<details><summary>Waar vind ik het adres[\s\S]*?<\/details>/, ''), /vier vragen|cuatro preguntas/);
  expectFailure('guía sin enlace desde la portada NL', 'nl/index.html', text => text.replace(/\s*<li><a href="\/nl\/stranden-roses\/">[^<]+<\/a><\/li>/, ''), /enlace directo follow/);
  expectFailure('idioma HTML incorrecto', 'nl/ijssalon-roses/index.html', text => text.replace('<html lang="nl">', '<html lang="fr">'), /html lang/);
  expectFailure('claim neerlandés no demostrado', 'nl/ijssalon-roses/index.html', text => text.replace('</main>', '<p>Gelato zonder conserveermiddelen</p></main>'), /sin conservantes/);

  console.log('PASS: 11 mutaciones multilingües P14 más baseline.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
