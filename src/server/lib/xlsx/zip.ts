/**
 * Lecture d'archive ZIP minimale, sans dependance externe (un classeur xlsx est un ZIP).
 *
 * Pourquoi maison : l'export de la section 9 de CLAUDE.md doit ecrire dans un classeur fourni
 * « sans en modifier la structure » (colonnes, en-tetes, noms d'onglets, mise en forme, formules).
 * Seule une manipulation directe des entrees du ZIP garantit que les parties non touchees
 * (styles, formules, mise en forme conditionnelle, onglets voisins) ressortent octet pour octet.
 */
import zlib from 'node:zlib';

export interface EntreeZip {
  nom: string;
  /** Contenu decompresse. */
  contenu: Buffer;
  /** Metadonnees conservees pour une reecriture fidele (phase 2). */
  methode: number;
  crc32: number;
  tailleCompressee: number;
  tailleOriginale: number;
  dateHeureDos: number;
  dateDos: number;
  drapeaux: number;
}

const SIGNATURE_FIN_CENTRAL = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;
const SIGNATURE_FIN_CENTRAL_ZIP64 = 0x06064b50;

/** Taille maximale du commentaire de fin d'archive, qui borne la recherche de l'en-tete de fin. */
const TAILLE_MAX_COMMENTAIRE = 0xffff;

function trouverFinCentral(buffer: Buffer): number {
  const debut = Math.max(0, buffer.length - TAILLE_MAX_COMMENTAIRE - 22);
  for (let i = buffer.length - 22; i >= debut; i--) {
    if (buffer.readUInt32LE(i) === SIGNATURE_FIN_CENTRAL) return i;
  }
  throw new Error("Archive invalide : en-tete de fin de repertoire central introuvable (le fichier n'est pas un classeur xlsx)");
}

/**
 * Lit toutes les entrees d'une archive ZIP.
 * Les classeurs xlsx produits par Excel et LibreOffice utilisent le stockage (0) ou deflate (8).
 */
export function lireZip(buffer: Buffer): Map<string, EntreeZip> {
  const finCentral = trouverFinCentral(buffer);
  let nombre = buffer.readUInt16LE(finCentral + 10);
  let offsetCentral = buffer.readUInt32LE(finCentral + 16);

  // Archive ZIP64 (plus de 65535 entrees ou plus de 4 Go) : les vraies valeurs sont dans l'en-tete ZIP64.
  if (nombre === 0xffff || offsetCentral === 0xffffffff) {
    const locateur = finCentral - 20;
    if (locateur < 0 || buffer.readUInt32LE(locateur) !== 0x07064b50) throw new Error('Archive ZIP64 invalide');
    const offsetFinZip64 = Number(buffer.readBigUInt64LE(locateur + 8));
    if (buffer.readUInt32LE(offsetFinZip64) !== SIGNATURE_FIN_CENTRAL_ZIP64) throw new Error('Archive ZIP64 invalide');
    nombre = Number(buffer.readBigUInt64LE(offsetFinZip64 + 32));
    offsetCentral = Number(buffer.readBigUInt64LE(offsetFinZip64 + 48));
  }

  const entrees = new Map<string, EntreeZip>();
  let position = offsetCentral;
  for (let i = 0; i < nombre; i++) {
    if (buffer.readUInt32LE(position) !== SIGNATURE_CENTRAL) throw new Error(`Archive invalide : entree ${i + 1} illisible`);
    const drapeaux = buffer.readUInt16LE(position + 8);
    const methode = buffer.readUInt16LE(position + 10);
    const dateHeureDos = buffer.readUInt16LE(position + 12);
    const dateDos = buffer.readUInt16LE(position + 14);
    const crc32 = buffer.readUInt32LE(position + 16);
    const tailleCompressee = buffer.readUInt32LE(position + 20);
    const tailleOriginale = buffer.readUInt32LE(position + 24);
    const longueurNom = buffer.readUInt16LE(position + 28);
    const longueurExtra = buffer.readUInt16LE(position + 30);
    const longueurCommentaire = buffer.readUInt16LE(position + 32);
    const offsetLocal = buffer.readUInt32LE(position + 42);
    const nom = buffer.subarray(position + 46, position + 46 + longueurNom).toString('utf8');

    if (buffer.readUInt32LE(offsetLocal) !== SIGNATURE_LOCAL) throw new Error(`Archive invalide : en-tete local de « ${nom} » illisible`);
    const longueurNomLocal = buffer.readUInt16LE(offsetLocal + 26);
    const longueurExtraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const debutDonnees = offsetLocal + 30 + longueurNomLocal + longueurExtraLocal;
    const brut = buffer.subarray(debutDonnees, debutDonnees + tailleCompressee);

    let contenu: Buffer;
    if (methode === 0) contenu = Buffer.from(brut);
    else if (methode === 8) contenu = zlib.inflateRawSync(brut);
    else throw new Error(`Methode de compression ${methode} non geree pour « ${nom} »`);

    entrees.set(nom, { nom, contenu, methode, crc32, tailleCompressee, tailleOriginale, dateHeureDos, dateDos, drapeaux });
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return entrees;
}
