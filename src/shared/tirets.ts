/**
 * Règle de contenu AZMG-Solutions : aucun tiret long (cadratin U+2014, demi-cadratin U+2013,
 * barre horizontale U+2015, tiret de liste U+2012) dans les textes destinés aux humains.
 * Ce filtre est appliqué à toute sortie de Claude et à tout email avant envoi.
 */
export const TIRETS_LONGS = /[\u2012\u2013\u2014\u2015]/;
const TIRETS_LONGS_G = /[\u2012\u2013\u2014\u2015]/g;

/** Remplace les tirets longs par une ponctuation neutre selon le contexte. */
export function retirerTiretsLongs(texte: string): string {
  if (!TIRETS_LONGS.test(texte)) return texte;
  return (
    texte
      // Plage numérique (10 tiret 20) : devient « 10 à 20 ».
      .replace(/(\d)\s*[\u2012\u2013\u2014\u2015]\s*(\d)/g, '$1 à $2')
      // Tiret en début de ligne (puce) : devient un tiret court.
      .replace(/^(\s*)[\u2012\u2013\u2014\u2015]\s*/gm, '$1- ')
      // Incise entourée d'espaces : devient une virgule.
      .replace(/\s+[\u2012\u2013\u2014\u2015]\s+/g, ', ')
      // Cas restants (collés) : tiret court.
      .replace(TIRETS_LONGS_G, '-')
  );
}

/** Applique le filtre récursivement à toutes les chaînes d'une structure JSON. */
export function nettoyerProfondement<T>(valeur: T): T {
  if (typeof valeur === 'string') return retirerTiretsLongs(valeur) as T;
  if (Array.isArray(valeur)) return valeur.map((v) => nettoyerProfondement(v)) as T;
  if (valeur && typeof valeur === 'object') {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) sortie[cle] = nettoyerProfondement(v);
    return sortie as T;
  }
  return valeur;
}

export function contientTiretLong(texte: string): boolean {
  return TIRETS_LONGS.test(texte);
}
