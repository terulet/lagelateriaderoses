import assert from 'node:assert/strict';
import {
  assetBodiesMatch,
  extractAssetUrls,
  fetchWithRetries,
  normalizeText,
  traceRedirects,
  validateRedirectTrace,
  validateResponse,
} from './monitor-production-seo.mjs';

assert.equal(normalizeText('\uFEFFuno\r\ndos\r\n'), 'uno\ndos');

assert.deepEqual(
  [...extractAssetUrls(
    '<link href="/assets/site.css"><img src="/assets/hero.webp" srcset="/assets/hero-400.webp 400w, /assets/hero.webp 800w"><meta property="og:image" content="/assets/social.jpg"><meta content="/assets/twitter.jpg" name="twitter:image"><a href="/fr/">FR</a>',
    'https://lagelateriaderoses.com/',
  )].sort(),
  [
    '/assets/hero-400.webp',
    '/assets/hero.webp',
    '/assets/site.css',
    '/assets/social.jpg',
    '/assets/twitter.jpg',
  ],
);

assert.deepEqual(
  validateResponse({ status: 500 }, { label: 'inicio', bodyLength: 0 }),
  ['inicio: HTTP 500, esperado 200', 'inicio: respuesta vacía'],
);

assert.equal(assetBodiesMatch('/assets/site.css', Buffer.from('a\r\nb\r\n'), Buffer.from('a\nb\n')), true);
assert.equal(assetBodiesMatch('/assets/image.webp', Buffer.from([1, 2]), Buffer.from([1, 3])), false);

let attempts = 0;
const retried = await fetchWithRetries('https://example.test/', {
  attempts: 2,
  fetchImpl: async () => {
    attempts += 1;
    return new Response(attempts === 1 ? 'temporal' : 'ok', { status: attempts === 1 ? 503 : 200 });
  },
});
assert.equal(attempts, 2);
assert.equal(retried.status, 200);

await assert.rejects(
  fetchWithRetries('https://example.test/', {
    attempts: 2,
    fetchImpl: async () => {
      throw new Error('red caída');
    },
  }),
  /red caída/,
);

const redirectResponses = new Map([
  ['http://example.test/', new Response(null, { status: 301, headers: { location: 'https://example.test/' } })],
  ['https://example.test/', new Response('ok', { status: 200 })],
]);
const trace = await traceRedirects('http://example.test/', {
  fetchImpl: async url => redirectResponses.get(url),
});
assert.deepEqual(validateRedirectTrace(trace, 'https://example.test/'), []);
assert.deepEqual(
  validateRedirectTrace({
    startUrl: 'http://temporary.test/',
    finalUrl: 'https://example.test/',
    finalStatus: 200,
    hops: [{ url: 'http://temporary.test/', status: 302, location: 'https://example.test/' }],
  }, 'https://example.test/'),
  ['http://temporary.test/: redirección temporal HTTP 302, esperada 301 o 308'],
);
assert.deepEqual(
  validateRedirectTrace(trace, 'https://wrong.test/'),
  ['http://example.test/: destino final https://example.test/, esperado https://wrong.test/'],
);

console.log('PASS: pruebas del monitor SEO de producción, incluidas respuestas negativas simuladas.');
