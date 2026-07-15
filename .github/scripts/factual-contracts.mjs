const decodeEntities = text => text
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

export const retiredClaims = new Map([
  ['porcentaje absoluto', /100\s*%/],
  ['cantidad de 50 sabores', /(?:\+\s*50|50\s*\+|mas de 50|mes de 50|more than 50|over 50|plus de 50|uber 50|meer dan 50)/],
  ['sin conservantes', /(?:sin conserv|sense conserv|no preserv|sans conserv|ohne konserv|geen conserv|zonder conserv|preservative[- ]free)/],
  ['sin bases industriales', /(?:bases? industrial|industrial bases?|industriebas|industriele bas)/],
  ['sin colorantes artificiales', /(?:colorantes? artificial|artificial colou?r|colorants? artific|kunstliche farb|kunstmatige kleur)/],
  ['ingredientes seleccionados no acreditados', /(?:ingredientes seleccionados|ingredients seleccionats|ingredients selected|selected ingredients|ingredients selectionnes|ausgewahlte zutaten|geselecteerde ingredienten)/],
  ['procedencia no acreditada', /(?:sicili|piamont|piemont|piedmont)/],
  ['recetas de ciudades no acreditadas', /(?:milan|mailand|milaan|floren)/],
  ['recetas tradicionales no acreditadas', /(?:recetas tradicionales|receptes tradicionals|traditional italian recipes|recettes traditionnelles|traditionellen italienischen rezepten|traditionele italiaanse recepten)/],
  ['fruta local o real no acreditada', /(?:(?:fruta|fruit|obst|vruchten).{0,18}(?:local|lokaal|lokal|real|echt)|(?:local|lokaal|lokal|real|echt).{0,18}(?:fruta|fruit|obst|vruchten))/],
  ['sin azúcar añadido', /(?:sin azucar|sense sucres?|no added sugar|sans sucres?|ohne zugesetzten zucker|ohne zuckerzusatz|zonder toegevoegde suikers?)/],
  ['satisfacción garantizada', /(?:satisfaccion.{0,15}garant|satisfaccio.{0,15}garant|guaranteed.{0,15}satisfaction|satisfaction.{0,15}garantie|zufriedenheit.{0,15}garant|gegarandeerde.{0,15}tevredenheid)/],
  ['distancia exacta de un minuto', /(?:un minuto|un minut|one minute|une minute|eine minute|een minuut|1 minute|minuto de distancia|minut de distancia)/],
  ['atribución a TripAdvisor', /tripadvisor/],
  ['identidad antigua de Facebook', /gelateriafeelingdor/],
]);

export function normalizeFactualText(text) {
  return decodeEntities(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function factualCorpusFromHtml(html) {
  const jsonLd = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .join('\n');
  const i18n = html.match(/const i18n\s*=\s*\{[\s\S]*?\n\};/)?.[0] || '';
  const semanticHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return normalizeFactualText(`${semanticHtml}\n${jsonLd}\n${i18n}`);
}

export function findRetiredClaims(html) {
  const corpus = factualCorpusFromHtml(html);
  return [...retiredClaims].filter(([, pattern]) => pattern.test(corpus)).map(([label]) => label);
}
