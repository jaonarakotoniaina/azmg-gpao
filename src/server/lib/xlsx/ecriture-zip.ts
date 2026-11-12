/**
 * Ecriture d'archive ZIP minimale, sans dependance externe.
 *
 * Utilisee pour reecrire un classeur xlsx en ne remplacant que les parties modifiees :
 * toutes les autres entrees sont recopiees telles quelles, ce qui preserve les styles,
 * les formules, la mise en forme conditionnelle et les onglets voisins (exigence de la
 * section 9 de CLAUDE.md pour l'export de la phase 2).
 */
import zlib from 'node:zlib';

export interface EntreeAEcrire {
  nom: string;
  contenu: Buffer;
  /** Date de modification. Par defaut, celle de l'entree d'origine ou l'epoque MS-DOS. */
  dateHeureDos?: number;
  dateDos?: number;
}

const TABLE_CRC: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = TABLE_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 1er janvier 1980 00:00, plancher du format de date MS-DOS. */
const DATE_DOS_DEFAUT = 0x0021;
const HEURE_DOS_DEFAUT = 0x0000;

/**
 * Assemble une archive ZIP. Les entrees sont ecrites dans l'ordre fourni, ce qui compte
 * pour un xlsx : `[Content_Types].xml` doit rester la premiere entree.
 */
export function ecrireZip(entrees: EntreeAEcrire[]): Buffer {
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entrees) {
    const nom = Buffer.from(e.nom, 'utf8');
    const compresse = zlib.deflateRawSync(e.contenu, { level: 6 });
    // Si la compression n'apporte rien, on stocke tel quel (methode 0).
    const gagne = compresse.length < e.contenu.length;
    const donnees = gagne ? compresse : e.contenu;
    const methode = gagne ? 8 : 0;
    const crc = crc32(e.contenu);
    const heure = e.dateHeureDos ?? HEURE_DOS_DEFAUT;
    const date = e.dateDos ?? DATE_DOS_DEFAUT;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version minimale
    local.writeUInt16LE(0x0800, 6); // drapeau : nom de fichier en UTF-8
    local.writeUInt16LE(methode, 8);
    local.writeUInt16LE(heure, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(e.contenu.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    locaux.push(local, nom, donnees);

    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(0x02014b50, 0);
    entree.writeUInt16LE(20, 4); // version d'ecriture
    entree.writeUInt16LE(20, 6); // version minimale de lecture
    entree.writeUInt16LE(0x0800, 8);
    entree.writeUInt16LE(methode, 10);
    entree.writeUInt16LE(heure, 12);
    entree.writeUInt16LE(date, 14);
    entree.writeUInt32LE(crc, 16);
    entree.writeUInt32LE(donnees.length, 20);
    entree.writeUInt32LE(e.contenu.length, 24);
    entree.writeUInt16LE(nom.length, 28);
    entree.writeUInt16LE(0, 30); // extra
    entree.writeUInt16LE(0, 32); // commentaire
    entree.writeUInt16LE(0, 34); // numero de disque
    entree.writeUInt16LE(0, 36); // attributs internes
    entree.writeUInt32LE(0, 38); // attributs externes
    entree.writeUInt32LE(offset, 42);
    central.push(entree, nom);

    offset += local.length + nom.length + donnees.length;
  }

  const repertoire = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locaux, repertoire, fin]);
}
