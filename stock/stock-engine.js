/*
 * stock-engine.js — Motor de control de stock con actualización optimista.
 *
 * Objetivos (ver PR fix/ipad-stock-touch-performance):
 *  - Cada pulsación cambia el valor mostrado al instante (optimista).
 *  - La persistencia ocurre en segundo plano, sin bloquear nuevas pulsaciones.
 *  - Cola de escritura POR ARTÍCULO: operaciones del mismo artículo se serializan;
 *    artículos distintos se guardan en paralelo y no se bloquean entre sí.
 *  - Consolidación segura: N pulsaciones rápidas se guardan como UN valor final.
 *  - Guarda por valor ABSOLUTO (idempotente) => reintentar siempre guarda lo último.
 *  - Guardia de secuencia: una respuesta antigua NUNCA sobrescribe un valor más nuevo.
 *  - Reintentos con backoff; indicador de error si no se puede guardar.
 *  - Clamp de no-negativos si la regla de negocio lo exige.
 *
 * El motor es agnóstico al backend: recibe una función `persist(id, value, meta)`
 * que devuelve una Promise. En la app estática (GitHub Pages) `persist` escribe en
 * localStorage; en el futuro podría apuntar a una API incremental/transaccional sin
 * tocar esta lógica.
 *
 * Funciona en navegador (global `StockEngine`) y en Node (module.exports) para tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.StockEngine = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = {
    allowNegative: false,   // regla de negocio: sin stock negativo
    maxRetries: 4,          // reintentos antes de marcar error
    backoffBase: 300,       // ms, crece 300, 600, 1200, 2400...
    backoffMax: 8000,
    min: 0,
    max: Infinity
  };

  function now(ctx) {
    // Inyectable para tests deterministas; por defecto Date.now.
    return ctx._now ? ctx._now() : Date.now();
  }

  function clampValue(store, v) {
    var lo = store.opts.allowNegative ? -Infinity : store.opts.min;
    if (v < lo) v = lo;
    if (v > store.opts.max) v = store.opts.max;
    return v;
  }

  function makeItem(id, value) {
    return {
      id: id,
      value: value,          // valor optimista visible AHORA (fuente de verdad de la UI)
      saved: value,          // último valor confirmado por persist()
      opSeq: 0,              // se incrementa en CADA pulsación del usuario
      dirty: false,          // hay cambios sin persistir
      saving: false,         // hay un flush en curso
      error: false,          // el último intento de guardado falló definitivamente
      retries: 0,
      _loopRunning: false
    };
  }

  function createStore(userOpts) {
    var opts = {};
    for (var k in DEFAULTS) opts[k] = DEFAULTS[k];
    for (var j in (userOpts || {})) opts[j] = userOpts[j];

    if (typeof opts.persist !== 'function') {
      throw new Error('createStore: se requiere opts.persist(id, value, meta) => Promise');
    }

    var store = {
      opts: opts,
      items: Object.create(null),
      _now: opts.now || null,
      _timeout: opts.setTimeout || (typeof setTimeout !== 'undefined' ? setTimeout : null),
      onChange: typeof opts.onChange === 'function' ? opts.onChange : function () {},
      onStatus: typeof opts.onStatus === 'function' ? opts.onStatus : function () {}
    };

    function ensure(id, initial) {
      var it = store.items[id];
      if (!it) {
        it = makeItem(id, clampValue(store, initial || 0));
        store.items[id] = it;
      }
      return it;
    }

    function notify(it) {
      store.onChange(it.id, publicView(it));
    }

    function publicView(it) {
      return {
        id: it.id,
        value: it.value,
        saved: it.saved,
        dirty: it.dirty,
        saving: it.saving,
        error: it.error,
        pending: it.dirty || it.saving
      };
    }

    function status() {
      var pending = 0, errors = 0;
      for (var id in store.items) {
        var it = store.items[id];
        if (it.dirty || it.saving) pending++;
        if (it.error) errors++;
      }
      return { pending: pending, errors: errors };
    }

    function emitStatus() {
      store.onStatus(status());
    }

    // Bucle de flush por artículo: mientras haya cambios, guarda el valor ACTUAL
    // (coalescido). Nunca corren dos flush del mismo artículo a la vez.
    function runLoop(it) {
      if (it._loopRunning) return;
      it._loopRunning = true;

      function step() {
        if (!it.dirty) {
          it._loopRunning = false;
          it.saving = false;
          notify(it);
          emitStatus();
          return;
        }
        var targetValue = it.value;          // valor coalescido a persistir
        var opSeqAtSave = it.opSeq;          // versión del usuario en el momento de guardar
        it.dirty = false;
        it.saving = true;
        notify(it);
        emitStatus();

        var meta = { opSeq: opSeqAtSave, at: now(store) };
        Promise.resolve()
          .then(function () { return store.opts.persist(it.id, targetValue, meta); })
          .then(function (res) {
            // Éxito. Guardia de secuencia: sólo reconciliamos con el valor devuelto
            // por el servidor si NO ha habido pulsaciones más nuevas mientras tanto.
            it.retries = 0;
            it.error = false;
            if (opSeqAtSave === it.opSeq) {
              it.saved = targetValue;
              if (res && typeof res.value === 'number' && opSeqAtSave === it.opSeq) {
                // El backend es autoridad SÓLO si nada más nuevo llegó.
                it.saved = res.value;
                it.value = res.value;
              }
            } else {
              // Llegaron pulsaciones nuevas: 'saved' avanza a lo persistido, pero
              // NO tocamos it.value (más reciente). Habrá otra vuelta del bucle.
              it.saved = targetValue;
            }
            step(); // ¿hay más cambios (dirty) acumulados? persistir de nuevo.
          })
          .catch(function () {
            // Fallo. Reintentamos guardando SIEMPRE el valor más reciente.
            it.retries++;
            if (it.retries > store.opts.maxRetries) {
              it.error = true;
              it.saving = false;
              it._loopRunning = false;
              // Dejamos dirty=true para reintentar en la próxima pulsación / retrySync().
              it.dirty = true;
              notify(it);
              emitStatus();
              return;
            }
            var delay = Math.min(
              store.opts.backoffBase * Math.pow(2, it.retries - 1),
              store.opts.backoffMax
            );
            it.dirty = true; // reintentar el valor actual
            if (store._timeout) {
              store._timeout(step, delay);
            } else {
              step();
            }
          });
      }
      step();
    }

    function scheduleFlush(it) {
      it.dirty = true;
      runLoop(it);
    }

    return {
      // Sembrar catálogo con valores conocidos (desde catálogo por defecto + localStorage).
      seed: function (map) {
        for (var id in map) {
          var it = ensure(id, map[id]);
          it.value = clampValue(store, map[id]);
          it.saved = it.value;
          it.dirty = false;
          it.error = false;
        }
        emitStatus();
        return this;
      },

      // Pulsación del usuario: aplica un delta relativo. Instantáneo, nunca se pierde.
      apply: function (id, delta) {
        var it = ensure(id, 0);
        var next = clampValue(store, it.value + delta);
        it.opSeq++;
        it.value = next;
        notify(it);
        scheduleFlush(it);
        return next;
      },

      // Fijar un valor absoluto (edición manual).
      setValue: function (id, v) {
        var it = ensure(id, 0);
        it.opSeq++;
        it.value = clampValue(store, v);
        notify(it);
        scheduleFlush(it);
        return it.value;
      },

      get: function (id) {
        var it = store.items[id];
        return it ? it.value : 0;
      },

      view: function (id) {
        var it = store.items[id];
        return it ? publicView(it) : null;
      },

      status: status,

      // Reintentar manualmente todo lo que quedó en error.
      retrySync: function () {
        for (var id in store.items) {
          var it = store.items[id];
          if (it.error || it.dirty) {
            it.error = false;
            it.retries = 0;
            runLoop(it);
          }
        }
      },

      // Promesa que resuelve cuando no queda nada pendiente (para tests).
      settled: function () {
        var self = this;
        return new Promise(function (resolve) {
          (function check() {
            var s = self.status();
            if (s.pending === 0) return resolve(self.status());
            var t = store._timeout || setTimeout;
            t(check, 5);
          })();
        });
      },

      _store: store // acceso interno para tests
    };
  }

  return { createStore: createStore, DEFAULTS: DEFAULTS };
});
