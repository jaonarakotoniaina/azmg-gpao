/**
 * Import initial des dossiers depuis le classeur de suivi existant
 * (`SUIVI_MENSUEL_MASENZ_JJ-MM.xlsx`, onglet « Suivi Quotidien »), format de la section 9 de CLAUDE.md.
 *
 * Structure lue, un bloc par jour : ligne vide, ligne d'en-tete recopiee, puis les lignes de donnees.
 *   colonne A : date en texte JJ/MM/AAAA
 *   colonne C : client ou pays
 *   colonne F : produit et reference
 *   colonne G : description numerotee orientee resultat, terminee par « : Statut »
 *   colonne H : livrables finalises
 *   colonne I : priorite du lendemain
 *   colonnes B, D, E : vides
 *
 * Parti pris (voir docs/DECISIONS.md) : l'import cree et met a jour des **dossiers** avec leur
 * dernier etat connu, mais ne cree aucune demande. Le classeur ne porte ni famille ni nature,
 * et la regle « jamais de donnee inventee » interdit de les deviner. Les demandes naissent de la
 * saisie rapide, puis de la synchronisation des mails en phase 4.
 *
 * L'import est rejouable : le rapprochement se fait sur la cle normalisee client|produit|operation,
 * donc un meme classeur importe deux fois ne cree aucun doublon.
 */
import { DateTime } from 'luxon';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { sha256 } from '../../lib/securite';
import { lireClasseur, ongletNomme, valeur, type Onglet } from '../../lib/xlsx/lecture';
import { trouverOuCreerDossier, type Dossier } from '../dossiers/service';
import { normaliser } from '@shared/texte';
import { STATUTS_REPORTING, type StatutDossier, type StatutReporting } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

export const ONGLET_SUIVI_QUOTIDIEN = 'Suivi Quotidien';

/** Colonnes du format (1 = A). */
const COL_DATE = 1;
const COL_CLIENT = 3;
const COL_PRODUIT = 6;
const COL_DESCRIPTION = 7;
const COL_LIVRABLES = 8;
const COL_PRIORITE = 9;

export interface LigneSuivi {
  ligne: number;
  jour: string; // AAAA-MM-JJ
  client: string;
  produit: string;
  description: string;
  statutReporting: StatutReporting | null;
  livrables: string;
  prioriteLendemain: string;
}

export interface BilanImport {
  lignesLues: number;
  lignesIgnorees: number;
  dossiersCrees: number;
  dossiersMisAJour: number;
  jourDebut: string | null;
  jourFin: string | null;
  /** Lignes ecartees avec leur raison, pour que l'utilisateur corrige son classeur. */
  anomalies: { ligne: number; raison: string }[];
}

/** Correspondance normalisee des statuts de reporting, pour une lecture tolerante aux accents. */
const STATUTS_NORMALISES = STATUTS_REPORTING.map((s) => ({ statut: s, cle: normaliser(s) }));

/**
 * Extrait le statut de reporting d'une description terminee par « : Statut ».
 * Compare sans accent ni casse, et prend le dernier segment separe par deux-points.
 */
export function extraireStatut(description: string): StatutReporting | null {
  const texte = description.trim();
  if (!texte) return null;
  const segments = texte.split(':');
  const dernier = normaliser(segments[segments.length - 1] ?? '');
  // Le libelle le plus long d'abord : « En attente client » avant « En cours ».
  const candidats = [...STATUTS_NORMALISES].sort((a, b) => b.cle.length - a.cle.length);
  const exact = candidats.find((c) => c.cle === dernier);
  if (exact) return exact.statut;
  // Tolerance : le statut peut etre suivi d'une precision (« : Termine (BL envoye) »).
  const contenu = candidats.find((c) => dernier.startsWith(c.cle));
  return contenu?.statut ?? null;
}

/** Statut de dossier deduit du statut de reporting du dernier jour connu. */
export function statutDossierDepuisReporting(statut: StatutReporting | null): StatutDossier {
  switch (statut) {
    case 'Termine':
      return 'clos';
    case 'Annule':
      return 'annule';
    case 'En attente client':
      return 'en_attente';
    default:
      return 'ouvert';
  }
}

/** Date JJ/MM/AAAA ou AAAA-MM-JJ vers AAAA-MM-JJ. Renvoie null si la cellule n'est pas une date. */
export function lireJour(brut: string): string | null {
  const texte = brut.trim();
  if (!texte) return null;
  const jjmmaaaa = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte);
  if (jjmmaaaa) {
    const d = DateTime.fromObject({ day: Number(jjmmaaaa[1]), month: Number(jjmmaaaa[2]), year: Number(jjmmaaaa[3]) });
    return d.isValid ? d.toISODate() : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
  if (iso) {
    const d = DateTime.fromISO(texte.slice(0, 10));
    return d.isValid ? d.toISODate() : null;
  }
  return null;
}

/** Une ligne d'en-tete recopiee : elle porte le mot « date » en A ou « description » en G. */
function estEnTete(cellules: Parameters<typeof valeur>[0]): boolean {
  const a = normaliser(valeur(cellules, COL_DATE));
  const g = normaliser(valeur(cellules, COL_DESCRIPTION));
  return a.startsWith('date') || g.includes('description') || g.includes('travaux') || g.includes('taches');
}

/** Lit les lignes de donnees de l'onglet « Suivi Quotidien ». */
export function lireSuiviQuotidien(onglet: Onglet): { lignes: LigneSuivi[]; anomalies: { ligne: number; raison: string }[] } {
  const lignes: LigneSuivi[] = [];
  const anomalies: { ligne: number; raison: string }[] = [];
  // La date n'est repetee qu'au debut d'un bloc : on la reporte sur les lignes suivantes du bloc.
  let jourCourant: string | null = null;

  for (let numero = 1; numero <= onglet.derniereLigne; numero++) {
    const cellules = onglet.lignes.get(numero);
    if (!cellules?.length) continue;
    const toutVide = cellules.every((c) => !c.texte.trim());
    if (toutVide) continue;
    if (estEnTete(cellules)) continue;

    const jourLu = lireJour(valeur(cellules, COL_DATE));
    if (jourLu) jourCourant = jourLu;
    const client = valeur(cellules, COL_CLIENT);
    const produit = valeur(cellules, COL_PRODUIT);
    const description = valeur(cellules, COL_DESCRIPTION);

    if (!client && !produit && !description) continue;
    if (!jourCourant) {
      anomalies.push({ ligne: numero, raison: 'aucune date de bloc connue pour cette ligne' });
      continue;
    }
    if (!client) {
      anomalies.push({ ligne: numero, raison: 'client ou pays absent en colonne C' });
      continue;
    }

    lignes.push({
      ligne: numero,
      jour: jourCourant,
      client,
      produit,
      description,
      statutReporting: extraireStatut(description),
      livrables: valeur(cellules, COL_LIVRABLES),
      prioriteLendemain: valeur(cellules, COL_PRIORITE),
    });
  }
  return { lignes, anomalies };
}

/**
 * Importe un classeur. Un meme dossier present plusieurs fois dans la periode est reduit a son
 * dernier etat connu (regle « un meme dossier dans la journee = une seule ligne au dernier etat »,
 * etendue a toute la periode importee).
 */
export async function importerClasseur(
  buffer: Buffer,
  opts: { compteId: number; posteId?: number | null; nomFichier: string },
  auteur: Auteur,
): Promise<{ bilan: BilanImport; dossiers: Dossier[] }> {
  let classeur;
  try {
    classeur = lireClasseur(buffer);
  } catch (e) {
    throw new ErreurHttp(400, `Classeur illisible : ${e instanceof Error ? e.message : String(e)}`);
  }

  const onglet = ongletNomme(classeur, ONGLET_SUIVI_QUOTIDIEN);
  if (!onglet) {
    const noms = classeur.onglets.map((o) => o.nom).join(', ');
    throw new ErreurHttp(400, `Onglet « ${ONGLET_SUIVI_QUOTIDIEN} » absent du classeur. Onglets trouves : ${noms || 'aucun'}`);
  }

  const { lignes, anomalies } = lireSuiviQuotidien(onglet);

  // Dernier etat connu par dossier : la ligne la plus recente gagne, et a jour egal la derniere lue.
  const parDossier = new Map<string, LigneSuivi>();
  for (const l of lignes) {
    const cle = `${normaliser(l.client)}|${normaliser(l.produit)}`;
    const precedent = parDossier.get(cle);
    if (!precedent || l.jour >= precedent.jour) parDossier.set(cle, l);
  }

  const dossiers: Dossier[] = [];
  let crees = 0;
  let misAJour = 0;
  for (const l of parDossier.values()) {
    const { dossier, cree } = await trouverOuCreerDossier(
      {
        compteId: opts.compteId,
        posteId: opts.posteId ?? null,
        client: l.client,
        produit: l.produit || null,
        operation: null,
      },
      auteur,
    );
    const statut = statutDossierDepuisReporting(l.statutReporting);
    // Resume oriente resultat : l'etat du dossier, jamais une appreciation sur le collaborateur.
    const resume = l.statutReporting ? `${l.statutReporting} au ${DateTime.fromISO(l.jour).toFormat('dd/MM/yyyy')}` : null;
    const [maj] = await db
      .update(schema.dossiers)
      .set({ statut, resume, clotureLe: statut === 'clos' || statut === 'annule' ? new Date() : null, majLe: new Date() })
      .where(eq(schema.dossiers.id, dossier.id))
      .returning();
    dossiers.push(maj ?? dossier);
    if (cree) crees++;
    else misAJour++;
  }

  const jours = lignes.map((l) => l.jour).sort();
  const bilan: BilanImport = {
    lignesLues: lignes.length,
    lignesIgnorees: anomalies.length,
    dossiersCrees: crees,
    dossiersMisAJour: misAJour,
    jourDebut: jours[0] ?? null,
    jourFin: jours[jours.length - 1] ?? null,
    anomalies: anomalies.slice(0, 50),
  };

  await db.insert(schema.imports).values({
    compteId: opts.compteId,
    nomFichier: opts.nomFichier,
    empreinte: sha256(buffer),
    bilan,
    jourDebut: bilan.jourDebut,
    jourFin: bilan.jourFin,
    importeParId: auteur.utilisateurId,
  });

  await journaliser('classeur_importe', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'compte',
    entiteId: opts.compteId,
    details: { nomFichier: opts.nomFichier, ...bilan, anomalies: bilan.anomalies.length },
  });

  return { bilan, dossiers };
}
