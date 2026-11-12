/**
 * Stockage des fichiers (pieces jointes des mails, pieces d'un dossier).
 *
 * Contrainte de la section 5 de CLAUDE.md : les fichiers sont ranges **hors du dossier public**
 * et servis par une route authentifiee. Rien, jamais, n'est accessible par une URL devinable.
 *
 * Le chemin est derive de l'empreinte du contenu : deux fois la meme piece jointe n'occupe le
 * disque qu'une fois, et le nom de fichier d'origine n'apparait pas sur le disque (il peut
 * contenir le nom d'un client).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { sha256 } from './securite';

/** Extensions acceptees pour une piece jointe. Tout le reste est ignore. */
const EXTENSIONS_ACCEPTEES = new Set([
  '.pdf', '.xlsx', '.xls', '.csv', '.docx', '.doc', '.txt', '.rtf',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.tif', '.tiff',
  '.zip', '.eml', '.msg', '.xml', '.json',
]);

export interface FichierRange {
  /** Chemin relatif au dossier de stockage. Jamais expose tel quel a un navigateur. */
  chemin: string;
  empreinte: string;
  tailleOctets: number;
  /** Vrai si le fichier etait deja present : le disque n'a pas grossi. */
  deja: boolean;
}

export function extensionAcceptee(nomFichier: string): boolean {
  return EXTENSIONS_ACCEPTEES.has(path.extname(nomFichier).toLowerCase());
}

/** Chemin absolu d'un fichier range, verifie contre toute remontee d'arborescence. */
export function cheminAbsolu(cheminRelatif: string): string {
  const racine = path.resolve(config.stockage);
  const absolu = path.resolve(racine, cheminRelatif);
  if (absolu !== racine && !absolu.startsWith(racine + path.sep)) {
    throw new Error('Chemin de fichier hors du dossier de stockage');
  }
  return absolu;
}

/**
 * Range un contenu et renvoie son chemin relatif.
 * Deux niveaux de sous-dossiers evitent un repertoire de plusieurs milliers d'entrees.
 */
export async function rangerFichier(contenu: Buffer, nomFichier: string, sousDossier = 'pieces'): Promise<FichierRange> {
  const empreinte = sha256(contenu);
  const extension = path.extname(nomFichier).toLowerCase().slice(0, 12);
  const chemin = path.join(sousDossier, empreinte.slice(0, 2), empreinte.slice(2, 4), `${empreinte}${extension}`);
  const absolu = cheminAbsolu(chemin);

  try {
    const stat = await fs.stat(absolu);
    return { chemin, empreinte, tailleOctets: stat.size, deja: true };
  } catch {
    // Le fichier n'existe pas encore : on le cree.
  }

  await fs.mkdir(path.dirname(absolu), { recursive: true });
  await fs.writeFile(absolu, contenu);
  return { chemin, empreinte, tailleOctets: contenu.length, deja: false };
}

export async function lireFichier(cheminRelatif: string): Promise<Buffer> {
  return fs.readFile(cheminAbsolu(cheminRelatif));
}

export async function fichierExiste(cheminRelatif: string): Promise<boolean> {
  try {
    await fs.access(cheminAbsolu(cheminRelatif));
    return true;
  } catch {
    return false;
  }
}
