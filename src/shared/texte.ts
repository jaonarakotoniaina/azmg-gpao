/** Normalisation de texte partagee front et back : recherche, rapprochement de dossiers. */

/** Minuscules sans accents ni ponctuation, espaces reduits. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Cle de rapprochement d'un dossier : client, produit et operation normalises. */
export function cleDossier(client: string, produit: string, operation: string): string {
  return [client, produit, operation].map(normaliser).filter(Boolean).join('|');
}

/** Coupe un texte en gardant les mots entiers. */
export function abreger(texte: string, longueur = 120): string {
  const t = texte.trim();
  if (t.length <= longueur) return t;
  const coupe = t.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > longueur * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}...`;
}

/** Retire les espaces superflus et les retours a la ligne multiples. */
export function compacter(texte: string): string {
  return texte.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
