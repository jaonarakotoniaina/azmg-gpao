/**
 * Vue « Suivi des demandes » : le tableau du manager, rendu par la GPAO.
 *
 * L'import range chaque ligne du classeur en dossier, demande et evenement. Cette vue fait le
 * chemin inverse et redonne le tableau, colonne par colonne, pour qu'on retrouve ce qu'on
 * connait. La difference avec le classeur est que les colonnes calculees le sont vraiment : le
 * delai est compte en heures ouvrees, et le statut est celui de la GPAO.
 */
import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { horairesDuCompte } from '../../lib/parametres';
import { tempsDemandeAvecHoraires, type Demande } from '../demandes/service';
import { minutesOuvrees } from '@shared/heures-ouvrees';
import { FAMILLE_HORS_PERIMETRE, LIBELLES_CAUSES, type Cause, type Statut } from '@shared/constantes';

export interface LigneDeSuivi {
  demandeId: number;
  dossierId: number;
  ouverteLe: string;
  priorite: string;
  statut: string;
  famille: string;
  reprise: boolean;
  cause: Cause | null;
  causeLibelle: string | null;
  /** Sujet du classeur, qui est le libelle du dossier. */
  sujet: string;
  /** Demande telle que la donneuse d'ordre l'a ecrite. */
  demande: string;
  /** Action attendue, qui est l'objet de la demande. */
  action: string;
  poste: string | null;
  commentaire: string;
  lienMail: string;
  /**
   * Origine des colonnes de synthese : `regles` quand le repli deterministe les a remplies,
   * `synthese_ia` quand la routine a repondu, `import` quand elles viennent du classeur. Affichee
   * pour qu'une action deduite ne soit pas lue comme une action lue dans le message.
   */
  origine: string;
  statutClasseur: string;
  type: string;
  /** Echeance metier, quand elle est posee. */
  echeanceLe: string | null;
  /** Instant de cloture, quand la demande est terminee. */
  clotureeLe: string | null;
  /** Delai de traitement en heures ouvrees du client : vide tant que la demande est ouverte. */
  delaiHeures: number | null;
  /** Temps d'attente en cours, en heures ouvrees, pour une demande encore ouverte. */
  attenteHeures: number | null;
}

export interface FiltresSuivi {
  compteId: number;
  posteId?: number;
  statut?: Statut;
  reprisesSeules?: boolean;
}

function texte(suivi: unknown, cle: string): string {
  const objet = (suivi ?? {}) as Record<string, unknown>;
  const valeur = objet[cle];
  return typeof valeur === 'string' ? valeur : '';
}

export async function suiviDesDemandes(filtres: FiltresSuivi, maintenant = new Date()): Promise<LigneDeSuivi[]> {
  const conditions: SQL[] = [
    eq(schema.demandes.compteId, filtres.compteId),
    sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
  ];
  if (filtres.posteId) conditions.push(eq(schema.demandes.posteId, filtres.posteId));
  if (filtres.statut) conditions.push(eq(schema.demandes.statut, filtres.statut));
  if (filtres.reprisesSeules) conditions.push(eq(schema.demandes.reprise, true));

  const lignes = await db
    .select({
      demande: schema.demandes,
      dossier: schema.dossiers.libelle,
      poste: schema.postes.intitule,
    })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .leftJoin(schema.postes, eq(schema.postes.id, schema.demandes.posteId))
    .where(and(...conditions))
    .orderBy(desc(schema.demandes.ouverteLe))
    .limit(500);

  const horaires = await horairesDuCompte(filtres.compteId);
  const debuts = await debutsDeStatut(lignes.map((l) => l.demande));
  const liens = await liensDesMails(lignes.map((l) => l.demande.id));

  return lignes.map(({ demande, dossier, poste }) => {
    const ouverte = demande.statut !== 'termine' && demande.statut !== 'annule';
    const temps = ouverte ? tempsDemandeAvecHoraires(demande, debuts.get(demande.id) ?? demande.ouverteLe, horaires, maintenant) : null;
    return {
      demandeId: demande.id,
      dossierId: demande.dossierId,
      ouverteLe: demande.ouverteLe.toISOString(),
      priorite: demande.priorite,
      statut: demande.statut,
      famille: demande.famille,
      reprise: demande.reprise,
      cause: demande.cause,
      causeLibelle: demande.cause ? LIBELLES_CAUSES[demande.cause] : null,
      sujet: dossier,
      demande: texte(demande.suivi, 'demande'),
      action: demande.objet,
      poste,
      commentaire: texte(demande.suivi, 'commentaire'),
      lienMail: texte(demande.suivi, 'lienMail') || liens.get(demande.id) || '',
      origine: texte(demande.suivi, 'origine'),
      statutClasseur: texte(demande.suivi, 'statutClasseur'),
      type: texte(demande.suivi, 'type'),
      echeanceLe: demande.echeanceLe?.toISOString() ?? null,
      clotureeLe: demande.termineeLe?.toISOString() ?? null,
      delaiHeures: demande.termineeLe ? Math.round(minutesOuvrees(horaires, demande.ouverteLe, demande.termineeLe) / 6) / 10 : null,
      attenteHeures: temps ? Math.round(temps.total / 6) / 10 : null,
    };
  });
}

/**
 * Lien de retour vers le mail, pris sur le premier evenement qui en porte un.
 *
 * Une demande importee depuis le classeur porte son lien dans `suivi`. Une demande nee de la
 * collecte le porte sur son evenement : c'est le script de la boite qui le connait. Une seule
 * requete pour toute la page, jamais une par ligne.
 */
async function liensDesMails(demandeIds: number[]): Promise<Map<number, string>> {
  if (!demandeIds.length) return new Map();
  const lignes = await db
    .select({ demandeId: schema.evenements.demandeId, lien: schema.evenements.lienExterne, survenuLe: schema.evenements.survenuLe })
    .from(schema.evenements)
    .where(and(inArray(schema.evenements.demandeId, demandeIds), isNotNull(schema.evenements.lienExterne)))
    .orderBy(asc(schema.evenements.survenuLe));

  const parDemande = new Map<number, string>();
  for (const ligne of lignes) {
    if (ligne.demandeId && ligne.lien && !parDemande.has(ligne.demandeId)) parDemande.set(ligne.demandeId, ligne.lien);
  }
  return parDemande;
}

async function debutsDeStatut(demandes: Demande[]): Promise<Map<number, Date>> {
  if (!demandes.length) return new Map();
  const lignes = await db
    .select({ demandeId: schema.transitionsStatut.demandeId, debut: sql<Date>`max(${schema.transitionsStatut.survenuLe})`.as('debut') })
    .from(schema.transitionsStatut)
    .where(inArray(schema.transitionsStatut.demandeId, demandes.map((d) => d.id)))
    .groupBy(schema.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}
