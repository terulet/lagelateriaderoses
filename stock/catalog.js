/*
 * catalog.js — Catálogo de artículos del Control de Stock.
 * Sabores del carrusel de la web + productos de la carta. Compartido navegador/Node.
 * Cada artículo: { id, name, cat, emoji }.
 * Las categorías sirven de filtros grandes en la interfaz.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StockCatalog = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATEGORIES = [
    { id: 'all',       name: 'Todos' },
    { id: 'clasicos',  name: 'Clásicos' },
    { id: 'cremas',    name: 'Cremas' },
    { id: 'frutas',    name: 'Frutas' },
    { id: 'golosos',   name: 'Golosos' },
    { id: 'productos', name: 'Carta' }
  ];

  // 35 sabores tomados de #flavors + 6 productos de #products (misma identidad que la web).
  var ITEMS = [
    { id: 'pistacho',        name: 'Pistacho',        cat: 'cremas',   emoji: '🌿' },
    { id: 'chocolate',       name: 'Chocolate',       cat: 'clasicos', emoji: '🍫' },
    { id: 'fresa',           name: 'Fresa',           cat: 'frutas',   emoji: '🍓' },
    { id: 'vainilla',        name: 'Vainilla',        cat: 'clasicos', emoji: '🌼' },
    { id: 'mango',           name: 'Mango',           cat: 'frutas',   emoji: '🥭' },
    { id: 'stracciatella',   name: 'Stracciatella',   cat: 'cremas',   emoji: '🍦' },
    { id: 'limon',           name: 'Limón',           cat: 'frutas',   emoji: '🍋' },
    { id: 'frambuesa',       name: 'Frambuesa',       cat: 'frutas',   emoji: '🫐' },
    { id: 'dulce-de-leche',  name: 'Dulce de Leche',  cat: 'cremas',   emoji: '🥛' },
    { id: 'avellana',        name: 'Avellana',        cat: 'cremas',   emoji: '🌰' },
    { id: 'crema-catalana',  name: 'Crema Catalana',  cat: 'cremas',   emoji: '🍮' },
    { id: 'caramelo-salado', name: 'Caramelo Salado', cat: 'cremas',   emoji: '🧂' },
    { id: 'cheesecake',      name: 'Cheesecake',      cat: 'golosos',  emoji: '🍰' },
    { id: 'turron',          name: 'Turrón',          cat: 'cremas',   emoji: '🍯' },
    { id: 'coco',            name: 'Coco',            cat: 'frutas',   emoji: '🥥' },
    { id: 'cafe',            name: 'Café',            cat: 'clasicos', emoji: '☕' },
    { id: 'sandia',          name: 'Sandía',          cat: 'frutas',   emoji: '🍉' },
    { id: 'maracuya',        name: 'Maracuyá',        cat: 'frutas',   emoji: '🍈' },
    { id: 'leche-merengada', name: 'Leche Merengada', cat: 'cremas',   emoji: '🥛' },
    { id: 'nata',            name: 'Nata',            cat: 'clasicos', emoji: '🍦' },
    { id: 'menta-chocolate', name: 'Menta Chocolate', cat: 'clasicos', emoji: '🌱' },
    { id: 'regaliz',         name: 'Regaliz',         cat: 'clasicos', emoji: '🖤' },
    { id: 'brownie',         name: 'Brownie',         cat: 'golosos',  emoji: '🍫' },
    { id: 'chocolate-blanco',name: 'Chocolate Blanco',cat: 'clasicos', emoji: '🤍' },
    { id: 'amarena',         name: 'Amarena',         cat: 'frutas',   emoji: '🍒' },
    { id: 'pitufo',          name: 'Pitufo',          cat: 'golosos',  emoji: '💙' },
    { id: 'lotus',           name: 'Lotus',           cat: 'golosos',  emoji: '🍪' },
    { id: 'snickers',        name: 'Snickers',        cat: 'golosos',  emoji: '🥜' },
    { id: 'oreo',            name: 'Oreo',            cat: 'golosos',  emoji: '🖤' },
    { id: 'kinder-huevo',    name: 'Kinder Huevo',    cat: 'golosos',  emoji: '🥚' },
    { id: 'violeta',         name: 'Violeta',         cat: 'clasicos', emoji: '💜' },
    { id: 'kinder-bueno',    name: 'Kinder Bueno',    cat: 'golosos',  emoji: '🍫' },
    { id: 'melon',           name: 'Melón',           cat: 'frutas',   emoji: '🍈' },
    { id: 'yogur',           name: 'Yogur',           cat: 'clasicos', emoji: '🥛' },
    { id: 'chocolate-dubai', name: 'Chocolate Dubai', cat: 'golosos',  emoji: '🌟' },
    // Carta / productos
    { id: 'gelato',          name: 'Gelato Artigianale', cat: 'productos', emoji: '🍨' },
    { id: 'crepes',          name: 'Crêpes',             cat: 'productos', emoji: '🥞' },
    { id: 'gofres',          name: 'Gofres',             cat: 'productos', emoji: '🧇' },
    { id: 'milkshakes',      name: 'Milkshakes',         cat: 'productos', emoji: '🥤' },
    { id: 'smoothies',       name: 'Smoothies',          cat: 'productos', emoji: '🍹' },
    { id: 'granizados',      name: 'Granizados',         cat: 'productos', emoji: '🧊' }
  ];

  return { CATEGORIES: CATEGORIES, ITEMS: ITEMS };
});
