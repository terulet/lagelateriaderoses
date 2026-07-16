import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditPublic,
  auditStatic,
  classifyPublicStatus,
  hasBlockingPublicFailure,
  loadManifest,
  renderReport,
  validateManifest,
  validatePublicUrl,
} from './local-presence-audit.mjs';

const root = path.resolve('.');
const manifest = loadManifest(root);
const clone = value => structuredClone(value);
let tests = 0;
const test = async (name, callback) => {
  await callback();
  tests += 1;
  console.log(`PASS: ${name}`);
};

await test('manifiesto maestro válido con avisos humanos explícitos', () => {
  const result = validateManifest(manifest);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(item => item.includes('apple_maps')));
  assert.ok(result.warnings.some(item => item.includes('ownership')));
});

await test('rechaza versión de manifiesto desconocida', () => {
  const mutation = clone(manifest); mutation.schemaVersion = 99;
  assert.ok(validateManifest(mutation).errors.some(item => item.includes('schemaVersion')));
});

await test('rechaza plataforma duplicada', () => {
  const mutation = clone(manifest); mutation.profiles.push(clone(mutation.profiles[0]));
  assert.ok(validateManifest(mutation).errors.includes('plataforma duplicada'));
});

await test('rechaza teléfono no E.164', () => {
  const mutation = clone(manifest); mutation.business.telephone = '972 253 795';
  assert.ok(validateManifest(mutation).errors.some(item => item.includes('E.164')));
});

await test('rechaza estados y hosts fuera del contrato inmutable', () => {
  const mutation = clone(manifest);
  mutation.profiles[0].status = 'invented';
  mutation.profiles[0].expectedHosts.push('example.com');
  const errors = validateManifest(mutation).errors;
  assert.ok(errors.some(item => item.includes('status inválido')));
  assert.ok(errors.some(item => item.includes('lista inmutable')));
});

await test('bloquea HTTP, credenciales, localhost y endpoints sensibles', () => {
  assert.ok(validatePublicUrl('http://www.google.com/x', ['www.google.com']).some(item => item.includes('HTTPS')));
  assert.ok(validatePublicUrl('https://user:pass@www.google.com/x', ['www.google.com']).some(item => item.includes('credenciales')));
  assert.ok(validatePublicUrl('https://localhost/x', ['localhost']).some(item => item.includes('privado')));
  assert.ok(validatePublicUrl('https://0.0.0.0/x', ['0.0.0.0']).some(item => item.includes('IP literal')));
  assert.ok(validatePublicUrl('https://[::1]/x', ['[::1]']).some(item => item.includes('IP literal')));
  assert.ok(validatePublicUrl('https://www.google.com/oauth/start', ['www.google.com']).some(item => item.includes('sensible')));
});

await test('bloquea host externo no permitido', () => {
  assert.ok(validatePublicUrl('https://example.com/profile', ['www.google.com']).some(item => item.includes('host no permitido')));
});

await test('clasifica estados HTTP sin convertir bloqueos en desapariciones', () => {
  assert.equal(classifyPublicStatus(200), 'REACHABLE');
  assert.equal(classifyPublicStatus(302), 'UNKNOWN');
  assert.equal(classifyPublicStatus(403), 'UNKNOWN');
  assert.equal(classifyPublicStatus(429), 'UNKNOWN');
  assert.equal(classifyPublicStatus(404), 'WARNING_HIGH');
  assert.equal(classifyPublicStatus(503), 'WARNING');
});

await test('auditoría estática real comprueba 14 rutas con WhatsApp confirmado', () => {
  const result = auditStatic({ root, manifest });
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedRoutes, 14);
  assert.equal(result.warnings.filter(item => item.includes('WhatsApp')).length, 0);
  assert.ok(result.warnings.some(item => item.includes('apple_maps')));
});

await test('detecta un mapa embebido que no usa el Place ID maestro', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'gelateria-presence-'));
  try {
    fs.cpSync(root, fixture, { recursive: true, filter: source => !['.git', 'artifacts'].includes(path.basename(source)) });
    const filename = path.join(fixture, 'nl/index.html');
    const before = fs.readFileSync(filename, 'utf8');
    const after = before.replace('https://www.google.com/maps?q=place_id%3AChIJ2SAQYFJhuhIRpVJqYaT7svc&amp;output=embed', 'https://www.google.com/maps?q=42.2668%2C3.176&amp;output=embed');
    assert.notEqual(after, before, 'la mutación del mapa debe aplicarse');
    fs.writeFileSync(filename, after, 'utf8');
    const result = auditStatic({ root: fixture, manifest });
    assert.ok(result.errors.some(item => item.includes('mapa embebido')));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

await test('una mutación NAP rompe la consistencia interna', () => {
  const mutation = clone(manifest); mutation.business.telephone = '+34900000000';
  const result = auditStatic({ root, manifest: mutation });
  assert.ok(result.errors.some(item => item.includes('teléfono distinto')));
  assert.ok(result.errors.some(item => item.includes('tel no registrado')));
});

await test('una dirección visible distinta también rompe la consistencia', () => {
  const mutation = clone(manifest); mutation.business.address.streetAddress = 'Carrer Incorrecte, 99';
  const result = auditStatic({ root, manifest: mutation });
  assert.ok(result.errors.some(item => item.includes('dirección visible')));
});

await test('detecta una sola dirección visible alterada aunque Schema y otras copias sigan correctos', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'gelateria-presence-'));
  try {
    fs.cpSync(root, fixture, { recursive: true, filter: source => !['.git', 'artifacts'].includes(path.basename(source)) });
    const filename = path.join(fixture, 'nl/index.html');
    const before = fs.readFileSync(filename, 'utf8');
    const after = before.replace('<p class="loc-addr">Carrer Dr. Pi i Sunyer, 6</p>', '<p class="loc-addr">Avinguda Incorrecta, 99</p>');
    assert.notEqual(after, before, 'la mutación visible debe aplicarse');
    fs.writeFileSync(filename, after, 'utf8');
    const result = auditStatic({ root: fixture, manifest });
    assert.ok(result.errors.some(item => item.includes('dirección visible alternativa')));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

await test('auditoría pública acepta 200', async () => {
  const one = clone(manifest);
  one.profiles = [one.profiles.find(profile => profile.platform === 'instagram')];
  const results = await auditPublic({ manifest: one, fetchImpl: async () => ({ status: 200, headers: new Headers() }) });
  assert.equal(results[0].status, 'REACHABLE');
});

await test('muro de login queda desconocido y no se visita', async () => {
  const one = clone(manifest);
  one.profiles = [one.profiles.find(profile => profile.platform === 'instagram')];
  let calls = 0;
  const results = await auditPublic({ manifest: one, fetchImpl: async () => {
    calls += 1;
    return { status: 302, headers: new Headers({ location: 'https://www.instagram.com/accounts/login/' }) };
  } });
  assert.equal(results[0].status, 'UNKNOWN');
  assert.equal(calls, 1);
});

await test('auditoría pública trata 403 como desconocido', async () => {
  const one = clone(manifest);
  one.profiles = [one.profiles.find(profile => profile.platform === 'facebook')];
  const results = await auditPublic({ manifest: one, fetchImpl: async () => ({ status: 403, headers: new Headers() }) });
  assert.equal(results[0].status, 'UNKNOWN');
});

await test('redirección a host inesperado queda en aviso alto', async () => {
  const one = clone(manifest);
  one.profiles = [one.profiles.find(profile => profile.platform === 'instagram')];
  const results = await auditPublic({ manifest: one, fetchImpl: async () => ({ status: 302, headers: new Headers({ location: 'https://example.com/login' }) }) });
  assert.equal(results[0].status, 'WARNING_HIGH');
});

await test('intersticial de consentimiento de Google queda como desconocido', async () => {
  const one = clone(manifest);
  one.profiles = [one.profiles.find(profile => profile.platform === 'google_maps')];
  const results = await auditPublic({ manifest: one, fetchImpl: async url => url.includes('consent.google.com')
    ? ({ status: 200, headers: new Headers() })
    : ({ status: 302, headers: new Headers({ location: 'https://consent.google.com/ml?continue=x' }) }) });
  assert.equal(results[0].status, 'UNKNOWN');
});

await test('Location inválido no aborta el resto de plataformas', async () => {
  const two = clone(manifest);
  two.profiles = [
    two.profiles.find(profile => profile.platform === 'instagram'),
    two.profiles.find(profile => profile.platform === 'facebook'),
  ];
  const results = await auditPublic({ manifest: two, fetchImpl: async url => url.includes('instagram')
    ? ({ status: 302, headers: new Headers({ location: 'http://[' }) })
    : ({ status: 200, headers: new Headers() }) });
  assert.equal(results[0].status, 'WARNING_HIGH');
  assert.match(results[0].detail, /Location inválido/);
  assert.equal(results[1].status, 'REACHABLE');
});

await test('informe conserva detalles externos y escapa Markdown', () => {
  const report = renderReport({ staticResult: { errors: [], warnings: ['WhatsApp: NEEDS_HUMAN'], checkedRoutes: 14 }, publicResults: [{ platform: 'tripadvisor', status: 'NEEDS_HUMAN', url: null, detail: 'NAP | ownership' }] });
  assert.match(report, /PASS_WITH_WARNINGS/);
  assert.match(report, /Tripadvisor|tripadvisor/);
  assert.match(report, /NAP \\| ownership/);
});

await test('modo público estricto bloquea solo avisos de alta confianza', () => {
  assert.equal(hasBlockingPublicFailure([{ status: 'WARNING_HIGH' }]), true);
  assert.equal(hasBlockingPublicFailure([{ status: 'UNKNOWN' }, { status: 'WARNING' }, { status: 'NEEDS_HUMAN' }]), false);
});

console.log(`PASS: ${tests} pruebas de presencia local P14.`);
