// Verificación visual y de interacción con Playwright (Chromium).
// Ejecutar: NODE_PATH=/opt/node22/lib/node_modules node stock/test/visual.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = process.env.BASE || 'http://localhost:8099/stock/';
const shotDir = '/tmp/claude-0/-home-user/09058587-16d2-502e-9116-07cd6e7a914d/scratchpad';

const viewports = [
  { name: 'ipad-landscape-1180', width: 1180, height: 820, expectCols: 3 },
  { name: 'ipad-landscape-1024', width: 1024, height: 768, expectCols: 3 },
  { name: 'ipad-portrait-820',   width: 820,  height: 1180, expectCols: 2 },
  { name: 'desktop-1600',        width: 1600, height: 900, expectCols: 4 },
  { name: 'mobile-390',          width: 390,  height: 844, expectCols: 1 }
];

function cardsPerRow(rects){
  // Cuenta cuántas tarjetas comparten la fila superior (mismo top que la primera visible).
  if(!rects.length) return 0;
  const top = rects[0].top;
  return rects.filter(r => Math.abs(r.top - top) < 4).length;
}

const browser = await chromium.launch();
let failures = 0;

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');

  const rects = await page.$$eval('.card:not(.hidden)', els =>
    els.map(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) }; })
  );
  const perRow = cardsPerRow(rects);

  // Sin scroll horizontal
  const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  const ok = perRow === vp.expectCols && !hOverflow;
  if (!ok) failures++;
  console.log(`${ok ? 'OK ' : 'XX '} ${vp.name}: filas=${perRow} (esperado ${vp.expectCols}) hOverflow=${hOverflow}`);

  await page.screenshot({ path: `${shotDir}/stock-${vp.name}.png`, fullPage: false });
  await ctx.close();
}

// Prueba de interacción: 10 taps rápidos en '+' de la primera tarjeta => +10; luego persistencia tras recarga.
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const card = page.locator('.card').first();
  const id = await card.getAttribute('data-id');
  const plus = card.locator('.plus');
  const qty = card.locator('.qty');
  const start = parseInt(await qty.textContent(), 10);
  for (let i = 0; i < 10; i++) await plus.click();
  const after = parseInt(await qty.textContent(), 10);
  const inc = after - start;
  console.log(`${inc === 10 ? 'OK ' : 'XX '} 10 taps rápidos => +${inc} (esperado +10)`);
  if (inc !== 10) failures++;

  // +,+,-,+ desde el nuevo valor => neto +2
  const minus = card.locator('.minus');
  const base2 = parseInt(await qty.textContent(), 10);
  await plus.click(); await plus.click(); await minus.click(); await plus.click();
  const res2 = parseInt(await qty.textContent(), 10);
  console.log(`${res2 - base2 === 2 ? 'OK ' : 'XX '} +,+,-,+ => neto +${res2 - base2} (esperado +2)`);
  if (res2 - base2 !== 2) failures++;

  // Persistencia tras recarga
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  const persisted = parseInt(await page.locator(`.card[data-id="${id}"] .qty`).textContent(), 10);
  console.log(`${persisted === res2 ? 'OK ' : 'XX '} persistencia tras recarga: ${persisted} (esperado ${res2})`);
  if (persisted !== res2) failures++;

  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nTODAS LAS COMPROBACIONES VISUALES OK' : `\n${failures} FALLOS`);
process.exit(failures ? 1 : 0);
