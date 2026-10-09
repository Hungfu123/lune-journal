/**
 * Längen, die der Server durchlässt (siehe backend/app/routes). Die Felder
 * bremsen damit schon beim Tippen — sonst kassiert man die Absage erst beim
 * Abschicken, mit einer Meldung, die niemandem weiterhilft.
 */
export const MAX = {
  titel: 120,
  text: 20000,
  frage: 300,
  antwort: 2000,
  kommentar: 1000,
  ort: 120,
  buchTitel: 60,
} as const
