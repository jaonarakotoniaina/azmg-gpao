/**
 * Lecture d'un classeur xlsx : onglets, cellules, valeurs.
 *
 * Volontairement minimal et sans dependance : on ne lit que ce dont l'import a besoin
 * (texte des cellules, nombres, dates serie) et on conserve la position exacte des cellules
 * pour que l'export de la phase 2 ecrive aux bons endroits.
 */
import { lireZip, type EntreeZip } from './zip';

export interface Cellule {
  /** Reference A1, ex. « C12 ». */
  ref: string;
  colonne: number; // 1 = A
  ligne: number; // 1 = premiere ligne
  /** Valeur texte telle qu'elle serait lue par un humain. */
  texte: string;
  /** Valeur numerique si la cellule est un nombre. */
  nombre: number | null;
  /** Formule, sans le signe egal (jamais evaluee ici). */
  formule: string | null;
}

export interface Onglet {
  nom: string;
  /** Chemin de la partie xml dans l'archive, utile a l'ecriture. */
  chemin: string;
  /** Cellules par ligne, indexees par numero de ligne. */
  lignes: Map<number, Cellule[]>;
  derniereLigne: number;
}

export interface Classeur {
  onglets: Onglet[];
  /** Entrees brutes de l'archive, conservees pour une reecriture fidele. */
  entrees: Map<string, EntreeZip>;
  chainesPartagees: string[];
}

/** « C12 » vers { colonne: 3, ligne: 12 }. */
export function decoderRef(ref: string): { colonne: number; ligne: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return { colonne: 0, ligne: 0 };
  let colonne = 0;
  for (const c of m[1]) colonne = colonne * 26 + (c.charCodeAt(0) - 64);
  return { colonne, ligne: Number(m[2]) };
}

/** 3 vers « C ». */
export function lettreColonne(colonne: number): string {
  let n = colonne;
  let sortie = '';
  while (n > 0) {
    const reste = (n - 1) % 26;
    sortie = String.fromCharCode(65 + reste) + sortie;
    n = Math.floor((n - 1) / 26);
  }
  return sortie;
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decoderXml(texte: string): string {
  return texte.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (tout, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES[code] ?? tout;
  });
}

export function encoderXml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** Concatene le texte de tous les elements <t> d'un fragment (cas des chaines enrichies). */
function texteDesT(fragment: string): string {
  let sortie = '';
  const motif = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(fragment))) sortie += decoderXml(m[1] ?? '');
  return sortie;
}

function lireChainesPartagees(entrees: Map<string, EntreeZip>): string[] {
  const partie = entrees.get('xl/sharedStrings.xml');
  if (!partie) return [];
  const xml = partie.contenu.toString('utf8');
  const chaines: string[] = [];
  const motif = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(xml))) chaines.push(m[1] === undefined ? '' : texteDesT(m[1]));
  return chaines;
}

/** Noms et cibles des onglets, dans l'ordre du classeur. */
function lireOnglets(entrees: Map<string, EntreeZip>): { nom: string; chemin: string }[] {
  const classeur = entrees.get('xl/workbook.xml');
  if (!classeur) throw new Error('Classeur invalide : xl/workbook.xml absent');
  const relations = entrees.get('xl/_rels/workbook.xml.rels');
  const cibles = new Map<string, string>();
  if (relations) {
    const xml = relations.contenu.toString('utf8');
    const motif = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(xml))) {
      const cible = m[2].startsWith('/') ? m[2].slice(1) : `xl/${m[2].replace(/^\.\//, '')}`;
      cibles.set(m[1], cible);
    }
  }
  const xml = classeur.contenu.toString('utf8');
  const onglets: { nom: string; chemin: string }[] = [];
  const motif = /<sheet\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  let indice = 0;
  while ((m = motif.exec(xml))) {
    const attributs = m[1];
    const nom = /\bname="([^"]*)"/.exec(attributs)?.[1];
    if (nom === undefined) continue;
    indice++;
    const idRelation = /\br:id="([^"]*)"/.exec(attributs)?.[1];
    const chemin = (idRelation && cibles.get(idRelation)) || `xl/worksheets/sheet${indice}.xml`;
    onglets.push({ nom: decoderXml(nom), chemin });
  }
  return onglets;
}

/** Numeros de format consideres comme des dates par la convention xlsx (formats integres). */
const FORMATS_DATE_INTEGRES = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Date serie Excel vers Date UTC (systeme 1900, avec le decalage du 29 fevrier 1900 fictif). */
export function dateSerieVersDate(serie: number): Date {
  const jours = serie > 59 ? serie - 1 : serie;
  return new Date(Math.round((jours - 25568) * 86_400_000));
}

export function estFormatDate(numeroFormat: number | null, formatsPersonnalises: Map<number, string>): boolean {
  if (numeroFormat === null) return false;
  if (FORMATS_DATE_INTEGRES.has(numeroFormat)) return true;
  const code = formatsPersonnalises.get(numeroFormat);
  if (!code) return false;
  // Un code de date contient un marqueur de jour, mois ou annee hors echappement.
  return /(^|[^\\])[dmyhs]/i.test(code.replace(/"[^"]*"/g, ''));
}

/** Correspondance style de cellule vers numero de format, pour reconnaitre les dates. */
function lireStyles(entrees: Map<string, EntreeZip>): { parStyle: number[]; personnalises: Map<number, string> } {
  const partie = entrees.get('xl/styles.xml');
  if (!partie) return { parStyle: [], personnalises: new Map() };
  const xml = partie.contenu.toString('utf8');
  const personnalises = new Map<number, string>();
  const motifFormats = /<numFmt\b[^>]*\bnumFmtId="(\d+)"[^>]*\bformatCode="([^"]*)"[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = motifFormats.exec(xml))) personnalises.set(Number(m[1]), decoderXml(m[2]));

  const blocXf = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  const parStyle: number[] = [];
  if (blocXf) {
    const motifXf = /<xf\b([^>]*)\/?>/g;
    let x: RegExpExecArray | null;
    while ((x = motifXf.exec(blocXf[1]))) parStyle.push(Number(/\bnumFmtId="(\d+)"/.exec(x[1])?.[1] ?? 0));
  }
  return { parStyle, personnalises };
}

function lireFeuille(
  xml: string,
  chaines: string[],
  styles: { parStyle: number[]; personnalises: Map<number, string> },
): { lignes: Map<number, Cellule[]>; derniereLigne: number } {
  const lignes = new Map<number, Cellule[]>();
  let derniereLigne = 0;
  // Une cellule : <c r="A1" t="s" s="3"><v>12</v></c>, ou avec <f> (formule) ou <is> (chaine en ligne).
  const motif = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(xml))) {
    const attributs = m[1];
    const corps = m[2] ?? '';
    const ref = /\br="([A-Z]+\d+)"/.exec(attributs)?.[1];
    if (!ref) continue;
    const { colonne, ligne } = decoderRef(ref);
    const type = /\bt="([^"]*)"/.exec(attributs)?.[1] ?? 'n';
    const style = /\bs="(\d+)"/.exec(attributs)?.[1];
    const formule = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(corps)?.[1];
    const brutV = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(corps)?.[1];

    let texte = '';
    let nombre: number | null = null;
    if (type === 's') {
      const indice = brutV === undefined ? NaN : Number(brutV);
      texte = Number.isInteger(indice) ? (chaines[indice] ?? '') : '';
    } else if (type === 'inlineStr') {
      texte = texteDesT(corps);
    } else if (type === 'str') {
      texte = decoderXml(brutV ?? '');
    } else if (type === 'b') {
      texte = brutV === '1' ? 'VRAI' : 'FAUX';
    } else if (type === 'e') {
      texte = decoderXml(brutV ?? '');
    } else if (brutV !== undefined && brutV !== '') {
      nombre = Number(brutV);
      if (!Number.isFinite(nombre)) {
        nombre = null;
        texte = decoderXml(brutV);
      } else {
        const numeroFormat = style === undefined ? null : (styles.parStyle[Number(style)] ?? null);
        texte = estFormatDate(numeroFormat, styles.personnalises)
          ? dateSerieVersDate(nombre).toISOString().slice(0, 10)
          : String(nombre);
      }
    }

    const cellule: Cellule = { ref, colonne, ligne, texte, nombre, formule: formule === undefined ? null : decoderXml(formule) };
    const liste = lignes.get(ligne) ?? [];
    liste.push(cellule);
    lignes.set(ligne, liste);
    if (ligne > derniereLigne) derniereLigne = ligne;
  }
  for (const liste of lignes.values()) liste.sort((a, b) => a.colonne - b.colonne);
  return { lignes, derniereLigne };
}

export function lireClasseur(buffer: Buffer): Classeur {
  const entrees = lireZip(buffer);
  const chainesPartagees = lireChainesPartagees(entrees);
  const styles = lireStyles(entrees);
  const onglets: Onglet[] = [];
  for (const { nom, chemin } of lireOnglets(entrees)) {
    const partie = entrees.get(chemin);
    if (!partie) continue;
    const { lignes, derniereLigne } = lireFeuille(partie.contenu.toString('utf8'), chainesPartagees, styles);
    onglets.push({ nom, chemin, lignes, derniereLigne });
  }
  return { onglets, entrees, chainesPartagees };
}

/** Valeur texte d'une colonne (1 = A) dans une ligne de cellules. */
export function valeur(cellules: Cellule[] | undefined, colonne: number): string {
  return cellules?.find((c) => c.colonne === colonne)?.texte.trim() ?? '';
}

/** Retrouve un onglet par son nom, insensible a la casse et aux espaces. */
export function ongletNomme(classeur: Classeur, nom: string): Onglet | undefined {
  const cible = nom.trim().toLowerCase();
  return classeur.onglets.find((o) => o.nom.trim().toLowerCase() === cible);
}
