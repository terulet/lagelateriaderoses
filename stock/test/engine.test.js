/*
 * engine.test.js — Pruebas del motor de stock (node:test, sin dependencias).
 * Ejecutar:  node --test stock/test/
 * Cubre los 9 escenarios obligatorios del encargo.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../stock-engine.js');

// Backend simulado configurable: latencia y fallos controlados.
function mockBackend(opts) {
  opts = opts || {};
  const db = Object.create(null);
  const log = [];
  let calls = 0;
  return {
    db, log,
    calls: () => calls,
    persist(id, value) {
      calls++;
      log.push({ id, value });
      const delay = typeof opts.delay === 'function' ? opts.delay(calls, id) : (opts.delay || 0);
      const fail = typeof opts.fail === 'function' ? opts.fail(calls, id) : false;
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (fail) return reject(new Error('backend down'));
          db[id] = value;
          resolve({ value });
        }, delay);
      });
    }
  };
}

// Simula ráfaga de pulsaciones síncronas (como taps rápidos en la UI).
function taps(store, id, deltas) {
  deltas.forEach(d => store.apply(id, d));
}

test('Escenario 1: +1 sobre 5 => inmediato 6, persistido 6', async () => {
  const be = mockBackend();
  const s = createStore({ persist: be.persist });
  s.seed({ fresa: 5 });
  const immediate = s.apply('fresa', +1);
  assert.strictEqual(immediate, 6, 'valor inmediato');
  await s.settled();
  assert.strictEqual(be.db.fresa, 6, 'valor persistido');
});

test('Escenario 2: diez +1 rápidos sobre 5 => inmediato 15, persistido 15', async () => {
  const be = mockBackend({ delay: 20 });
  const s = createStore({ persist: be.persist });
  s.seed({ fresa: 5 });
  for (let i = 0; i < 10; i++) s.apply('fresa', +1);
  assert.strictEqual(s.get('fresa'), 15, 'diez taps => +10 inmediato');
  await s.settled();
  assert.strictEqual(be.db.fresa, 15, 'persistido 15');
  // Consolidación: no puede haber 10 escrituras (se coalescen), pero sí al menos 1.
  assert.ok(be.calls() >= 1 && be.calls() < 10, 'escrituras consolidadas: ' + be.calls());
});

test('Escenario 3: +,+,-,+ rápido sobre 5 => 7', async () => {
  const be = mockBackend({ delay: 10 });
  const s = createStore({ persist: be.persist });
  s.seed({ fresa: 5 });
  taps(s, 'fresa', [+1, +1, -1, +1]);
  assert.strictEqual(s.get('fresa'), 7, 'orden respetado => 7');
  await s.settled();
  assert.strictEqual(be.db.fresa, 7, 'persistido 7');
});

test('Escenario 4: varios - sobre 1 => nunca negativo (clamp a 0)', async () => {
  const be = mockBackend();
  const s = createStore({ persist: be.persist, allowNegative: false });
  s.seed({ limon: 1 });
  taps(s, 'limon', [-1, -1, -1, -1, -1]);
  assert.strictEqual(s.get('limon'), 0, 'nunca negativo');
  await s.settled();
  assert.strictEqual(be.db.limon, 0, 'persistido 0');
});

test('Escenario 5: dos sabores alternos no se bloquean entre sí', async () => {
  // 'fresa' con backend lento; 'mango' rápido: mango debe quedar correcto sin esperar a fresa.
  const be = mockBackend({ delay: (calls, id) => id === 'fresa' ? 120 : 5 });
  const s = createStore({ persist: be.persist });
  s.seed({ fresa: 5, mango: 5 });
  taps(s, 'fresa', [+1, +1]);
  taps(s, 'mango', [+1, +1, +1]);
  assert.strictEqual(s.get('fresa'), 7);
  assert.strictEqual(s.get('mango'), 8);
  await s.settled();
  assert.strictEqual(be.db.fresa, 7);
  assert.strictEqual(be.db.mango, 8);
});

test('Escenario 6: respuesta lenta antigua no sobrescribe un valor más nuevo', async () => {
  // Primera escritura tarda mucho; el usuario sigue pulsando mientras vuela.
  const be = mockBackend({ delay: (calls) => calls === 1 ? 100 : 5 });
  const s = createStore({ persist: be.persist });
  s.seed({ cafe: 5 });
  s.apply('cafe', +1);        // dispara guardado lento (target 6, opSeq=1)
  await new Promise(r => setTimeout(r, 10));
  s.apply('cafe', +1);        // opSeq=2, target 7 mientras la primera aún vuela
  s.apply('cafe', +1);        // opSeq=3, target 8
  assert.strictEqual(s.get('cafe'), 8, 'UI muestra el valor más nuevo');
  await s.settled();
  assert.strictEqual(s.get('cafe'), 8, 'una respuesta antigua no revierte a 6');
  assert.strictEqual(be.db.cafe, 8, 'persistido el último valor');
});

test('Escenario 7: fallo de backend => estado coherente + reintento posterior OK', async () => {
  let mode = { down: true };
  const db = Object.create(null);
  const s = createStore({
    persist(id, value) {
      return new Promise((resolve, reject) => setTimeout(() => {
        if (mode.down) return reject(new Error('down'));
        db[id] = value; resolve({ value });
      }, 2));
    },
    maxRetries: 2, backoffBase: 5
  });
  s.seed({ nata: 5 });
  s.apply('nata', +1);
  // Esperar a que agote reintentos y marque error.
  await new Promise(r => setTimeout(r, 120));
  let st = s.status();
  assert.ok(st.errors >= 1, 'hay error marcado');
  assert.strictEqual(s.get('nata'), 6, 'la UI conserva el valor optimista');
  // Backend vuelve; retrySync recupera.
  mode.down = false;
  s.retrySync();
  await s.settled();
  assert.strictEqual(db.nata, 6, 'recuperado tras reintento');
  assert.strictEqual(s.status().errors, 0, 'sin errores tras recuperar');
});

test('Escenario 8 (motor): dos activaciones reales => exactamente dos operaciones', async () => {
  // El anti-doble-toque del navegador es a nivel DOM (touch-action); a nivel motor,
  // dos activaciones reales deben contar dos.
  const be = mockBackend();
  const s = createStore({ persist: be.persist });
  s.seed({ oreo: 0 });
  s.apply('oreo', +1);
  s.apply('oreo', +1);
  assert.strictEqual(s.get('oreo'), 2);
  await s.settled();
  assert.strictEqual(be.db.oreo, 2);
});

test('Escenario 9: valor final correcto pese a ráfagas solapadas (persistencia estable)', async () => {
  const be = mockBackend({ delay: (calls) => (calls % 2 ? 40 : 10) });
  const s = createStore({ persist: be.persist });
  s.seed({ mango: 10 });
  // Ráfaga larga alterna + y -, resultado neto conocido.
  const seq = [+1, +1, +1, -1, +1, -1, -1, +1, +1, +1]; // neto +4 => 14
  taps(s, 'mango', seq);
  assert.strictEqual(s.get('mango'), 14);
  await s.settled();
  assert.strictEqual(be.db.mango, 14, 'valor final persistido correcto');
});

test('Persistencia consolidada: guarda siempre el ÚLTIMO valor (idempotente)', async () => {
  const be = mockBackend({ delay: 15 });
  const s = createStore({ persist: be.persist });
  s.seed({ turron: 0 });
  for (let i = 0; i < 25; i++) s.apply('turron', +1);
  await s.settled();
  assert.strictEqual(be.db.turron, 25);
  assert.strictEqual(be.log[be.log.length - 1].value, 25, 'la última escritura es el valor final');
});
