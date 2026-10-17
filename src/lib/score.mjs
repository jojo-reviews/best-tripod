// Best Tripod Score: our editorial 1-5 rating for a product, from five
// criteria scored 1-10 (see /how-we-score/). Criteria that don't apply
// (e.g. working height for a clamp or a quick-release plate) are left out and
// the remaining weights are rescaled so they still add up to 100%.
export const CRITERIA = [
  { key: 'stability', label: 'Stability', weight: 0.3 },
  { key: 'portability', label: 'Portability (weight and folded length)', weight: 0.2 },
  { key: 'height', label: 'Working height', weight: 0.15 },
  { key: 'build', label: 'Build (materials, leg locks, head)', weight: 0.2 },
  { key: 'value', label: 'Value', weight: 0.15 },
];

// Criterion labels in the other site languages (English labels live in CRITERIA).
export const CRITERIA_LABELS = {
  de: { stability: 'Stabilität', portability: 'Mobilität (Gewicht und Packmaß)', height: 'Arbeitshöhe', build: 'Verarbeitung (Material, Beinverschlüsse, Kopf)', value: 'Preis-Leistung' },
  es: { stability: 'Estabilidad', portability: 'Portabilidad (peso y longitud plegado)', height: 'Altura de trabajo', build: 'Construcción (materiales, cierres de patas, cabezal)', value: 'Relación calidad-precio' },
  nl: { stability: 'Stabiliteit', portability: 'Draagbaarheid (gewicht en lengte ingeklapt)', height: 'Werkhoogte', build: 'Bouwkwaliteit (materiaal, pootsluitingen, kop)', value: 'Prijs-kwaliteit' },
};

/** Label of a criterion in a language, falling back to English. */
export function criterionLabel(key, lang = 'en') {
  return CRITERIA_LABELS[lang]?.[key] ?? CRITERIA.find((c) => c.key === key)?.label ?? key;
}

/** Score = sum(criterion x weight) / sum(weights used) / 2, rounded to 0.1 (out of 5). */
export function productScore(scores) {
  if (!scores) return null;
  let total = 0;
  let weights = 0;
  for (const c of CRITERIA) {
    const v = scores[c.key];
    if (typeof v !== 'number') continue;
    total += v * c.weight;
    weights += c.weight;
  }
  if (!weights) return null;
  return Math.round((total / weights / 2) * 10) / 10;
}

/** @deprecated Backward-compatible alias from the template; use productScore. */
export const renterScore = productScore;
