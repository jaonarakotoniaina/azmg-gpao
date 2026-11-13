/**
 * Cycle de vie d'une demande : creation, transitions de statut horodatees, temps par statut
 * et par acteur comptes en heures ouvrees du client.
 *
 * Invariants tenus ici :
 *  - toute transition laisse une ligne dans `transitions_statut` (auteur, motif, instant) ;
 *  - le temps passe dans le statut quitte est ajoute aux compteurs de la demande ;
 *  - un statut ferme (Termine, Annule) arrete le chrono ;
 *  - une demande de famille T00 ne peut pas exister (le hors perimetre n'entre pas dans le pilotage).
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser, type AuteurType } from '../../lib/evenements';
import { horairesDuCompte, lireParametres } from '../../lib/parametres';
import {
  ACTEURS,
  definitionStatut,
  estFerme,
  estHorsPerimetre,
  famille as familleRef,
  FAMILLE_HORS_PERIMETRE,
  POIDS_PRIORITES,
  STATUTS_OUVERTS,
  type Acteur,
  type Cause,
  type Priorite,
  type Source,
  type Statut,
} from '@shared/constantes';
import { ajouterHeuresOuvrees, minutesOuvrees, type HorairesOuvres } from '@shared/heures-ouvrees';

export type Demande = typeof schema.demandes.$inferSelect;

export interface Auteur {
  utilisateurId: number | null;
  type: AuteurType;
}

export const AUTEUR_SYSTEME: Auteur = { utilisateurId: null, type: 'systeme' };

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface EntreeCreationDemande {
  dossierId: number;
  famille: string;
  objet: string;
  origine?: Source;
  priorite?: Priorite;
  statut?: Statut;
  echeanceLe?: Date | null;
  notes?: string | null;
  /** Vrai quand la demande vient d'un manquement et non d'un travail ordinaire. */
  reprise?: boolean;
  /** Cause de la reprise, en liste fermee. Vide tant que personne ne l'a tranchee. */
  cause?: Cause | null;
  /** Ligne d'origine du classeur de suivi, conservee colonne par colonne. */
  suivi?: Record<string, unknown>;
  /** Instant d'ouverture : la date du message d'origine, pas celle de la saisie. */
  ouverteLe?: Date;
}

/** Calcule l'echeance SLA d'une demande a partir de la famille et des horaires du client. */
export async function calculerSla(compteId: number, famille: string, depart: Date): Promise<{ heures: number | null; echeance: Date | null }> {
  const p = await lireParametres();
  const heures = p.sla.parFamille[famille] ?? familleRef(famille)?.slaHeures ?? null;
  if (!heures || heures <= 0) return { heures: null, echeance: null };
  const horaires = await horairesDuCompte(compteId);
  return { heures, echeance: ajouterHeuresOuvrees(horaires, depart, heures) };
}

export async function creerDemande(entree: EntreeCreationDemande, auteur: Auteur): Promise<Demande> {
  if (estHorsPerimetre(entree.famille)) {
    throw new ErreurHttp(400, `La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : elle ne cree pas de demande`);
  }
  const [dossier] = await db
    .select({ id: schema.dossiers.id, compteId: schema.dossiers.compteId, posteId: schema.dossiers.posteId })
    .from(schema.dossiers)
    .where(eq(schema.dossiers.id, entree.dossierId));
  if (!dossier) throw new ErreurHttp(404, 'Dossier introuvable');

  const statut = entree.statut ?? 'nouveau';
  const def = definitionStatut(statut);
  if (!def) throw new ErreurHttp(400, `Statut inconnu : ${statut}`);
  const ouverteLe = entree.ouverteLe ?? new Date();
  const sla = await calculerSla(dossier.compteId, entree.famille, ouverteLe);

  const [demande] = await db
    .insert(schema.demandes)
    .values({
      dossierId: dossier.id,
      compteId: dossier.compteId,
      posteId: dossier.posteId,
      famille: entree.famille,
      objet: entree.objet.trim(),
      origine: entree.origine ?? 'saisie',
      statut,
      acteurAttendu: def.acteur,
      priorite: entree.priorite ?? 'normale',
      reprise: entree.reprise ?? false,
      cause: entree.cause ?? null,
      suivi: entree.suivi ?? {},
      echeanceLe: entree.echeanceLe ?? null,
      slaHeures: sla.heures,
      slaEcheanceLe: sla.echeance,
      ouverteLe,
      dernierEvenementLe: ouverteLe,
      notes: entree.notes ?? null,
      creeParId: auteur.utilisateurId,
    })
    .returning();

  // Transition initiale : elle donne le point de depart du chrono du premier statut.
  await db.insert(schema.transitionsStatut).values({
    demandeId: demande.id,
    statutAvant: null,
    statutApres: statut,
    acteurAvant: null,
    acteurApres: def.acteur,
    survenuLe: ouverteLe,
    minutesOuvrees: 0,
    motif: 'ouverture de la demande',
    auteurId: auteur.utilisateurId,
    auteurType: auteur.type,
  });

  await journaliser('demande_creee', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'demande',
    entiteId: demande.id,
    details: { dossierId: dossier.id, famille: entree.famille, statut },
  });
  return demande;
}

// ---------------------------------------------------------------------------
// Transitions de statut
// ---------------------------------------------------------------------------

/** Instant de la derniere transition d'une demande (point de depart du chrono du statut courant). */
async function debutStatutCourant(demande: Demande): Promise<Date> {
  const [derniere] = await db
    .select({ survenuLe: schema.transitionsStatut.survenuLe })
    .from(schema.transitionsStatut)
    .where(eq(schema.transitionsStatut.demandeId, demande.id))
    .orderBy(desc(schema.transitionsStatut.survenuLe), desc(schema.transitionsStatut.id))
    .limit(1);
  return derniere?.survenuLe ?? demande.ouverteLe;
}

function cumuler(compteurs: unknown, cle: string, minutes: number): Record<string, number> {
  const base = (compteurs && typeof compteurs === 'object' ? { ...(compteurs as Record<string, number>) } : {}) as Record<string, number>;
  base[cle] = Math.round((base[cle] ?? 0) + minutes);
  return base;
}

export interface OptionsTransition {
  motif?: string | null;
  /** Acteur attendu apres le changement. Par defaut, celui du nouveau statut. */
  acteurAttendu?: Acteur;
  evenementId?: number | null;
  /** Instant du changement : l'horodatage d'origine quand il vient d'un mail. */
  survenuLe?: Date;
  /** Marque la demande comme ayant recu sa premiere reponse du poste. */
  premiereReponse?: boolean;
}

/**
 * Change le statut d'une demande. Idempotent sur un statut identique avec le meme acteur attendu :
 * aucune transition n'est ecrite, pour ne pas fausser les compteurs de temps.
 */
export async function changerStatut(demandeId: number, nouveau: Statut, auteur: Auteur, opts: OptionsTransition = {}): Promise<Demande> {
  const def = definitionStatut(nouveau);
  if (!def) throw new ErreurHttp(400, `Statut inconnu : ${nouveau}`);
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');

  const acteurApres = opts.acteurAttendu ?? def.acteur;
  if (!ACTEURS.includes(acteurApres)) throw new ErreurHttp(400, `Acteur inconnu : ${acteurApres}`);
  if (demande.statut === nouveau && demande.acteurAttendu === acteurApres && !opts.premiereReponse) return demande;

  const survenuLe = opts.survenuLe ?? new Date();
  const debut = await debutStatutCourant(demande);
  const horaires = await horairesDuCompte(demande.compteId);
  // Le chrono ne tourne plus dans un statut ferme : la demande etait deja sortie du flux.
  const minutes = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debut, survenuLe);

  await db.insert(schema.transitionsStatut).values({
    demandeId: demande.id,
    statutAvant: demande.statut,
    statutApres: nouveau,
    acteurAvant: demande.acteurAttendu,
    acteurApres,
    survenuLe,
    minutesOuvrees: minutes,
    motif: opts.motif ?? null,
    evenementId: opts.evenementId ?? null,
    auteurId: auteur.utilisateurId,
    auteurType: auteur.type,
  });

  const [maj] = await db
    .update(schema.demandes)
    .set({
      statut: nouveau,
      acteurAttendu: acteurApres,
      minutesParStatut: cumuler(demande.minutesParStatut, demande.statut, minutes),
      minutesParActeur: cumuler(demande.minutesParActeur, demande.acteurAttendu, minutes),
      premiereReponseLe: demande.premiereReponseLe ?? (opts.premiereReponse ? survenuLe : null),
      termineeLe: def.fermee ? survenuLe : null,
      dernierEvenementLe: survenuLe,
      majLe: new Date(),
    })
    .where(eq(schema.demandes.id, demande.id))
    .returning();

  await journaliser('statut_change', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'demande',
    entiteId: demande.id,
    details: { de: demande.statut, vers: nouveau, acteur: acteurApres, minutesOuvrees: minutes, motif: opts.motif ?? null },
  });
  return maj;
}

/** Enregistre une relance emise : niveau N1, N2 puis N3, sans depasser N3. */
export async function enregistrerRelance(demandeId: number, auteur: Auteur, survenuLe = new Date()): Promise<Demande> {
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  const niveau = Math.min(3, demande.niveauRelance + 1);
  const [maj] = await db
    .update(schema.demandes)
    .set({ niveauRelance: niveau, derniereRelanceLe: survenuLe, dernierEvenementLe: survenuLe, majLe: new Date() })
    .where(eq(schema.demandes.id, demandeId))
    .returning();
  await journaliser('relance_enregistree', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'demande',
    entiteId: demandeId,
    details: { niveau },
  });
  return maj;
}

// ---------------------------------------------------------------------------
// Temps par statut et par acteur
// ---------------------------------------------------------------------------

export interface TempsDemande {
  /** Minutes ouvrees par statut, segment en cours inclus. */
  parStatut: Record<string, number>;
  parActeur: Record<string, number>;
  /** Minutes ouvrees depuis l'ouverture jusqu'a la cloture, ou jusqu'a maintenant. */
  total: number;
  /** Minutes ouvrees jusqu'a la premiere reponse du poste, si elle a eu lieu. */
  premiereReponse: number | null;
  /** Minutes ouvrees deja passees dans le statut courant. */
  statutCourant: number;
}

/**
 * Temps d'une demande, compteurs enregistres plus le segment en cours.
 * `maintenant` permet de calculer a une date donnee (tests, rapports).
 */
export async function tempsDemande(demande: Demande, maintenant = new Date()): Promise<TempsDemande> {
  const horaires = await horairesDuCompte(demande.compteId);
  const debut = await debutStatutCourant(demande);
  const enCours = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debut, maintenant);
  const parStatut = cumuler(demande.minutesParStatut, demande.statut, enCours);
  const parActeur = cumuler(demande.minutesParActeur, demande.acteurAttendu, enCours);
  const fin = demande.termineeLe ?? maintenant;
  return {
    parStatut,
    parActeur,
    total: minutesOuvrees(horaires, demande.ouverteLe, fin),
    premiereReponse: demande.premiereReponseLe ? minutesOuvrees(horaires, demande.ouverteLe, demande.premiereReponseLe) : null,
    statutCourant: enCours,
  };
}

/**
 * Temps de plusieurs demandes en un seul aller-retour : les debuts de statut sont lus en une
 * requete et les horaires une fois par compte. A utiliser des qu'on affiche une liste
 * (fiche dossier, exports), pour ne pas multiplier les requetes par le nombre de demandes.
 */
export async function tempsDesDemandes(demandes: Demande[], maintenant = new Date()): Promise<Map<number, TempsDemande>> {
  const sortie = new Map<number, TempsDemande>();
  if (!demandes.length) return sortie;

  const debuts = await db
    .select({
      demandeId: schema.transitionsStatut.demandeId,
      debut: sql<Date>`max(${schema.transitionsStatut.survenuLe})`.as('debut'),
    })
    .from(schema.transitionsStatut)
    .where(inArray(schema.transitionsStatut.demandeId, demandes.map((d) => d.id)))
    .groupBy(schema.transitionsStatut.demandeId);
  const parDemande = new Map(debuts.map((d) => [d.demandeId, new Date(d.debut)]));

  const horairesParCompte = new Map<number, HorairesOuvres>();
  for (const compteId of new Set(demandes.map((d) => d.compteId))) {
    horairesParCompte.set(compteId, await horairesDuCompte(compteId));
  }

  for (const d of demandes) {
    const debut = parDemande.get(d.id) ?? d.ouverteLe;
    sortie.set(d.id, tempsDemandeAvecHoraires(d, debut, horairesParCompte.get(d.compteId)!, maintenant));
  }
  return sortie;
}

/** Variante sans acces base, quand les horaires sont deja connus (calculs en lot). */
export function tempsDemandeAvecHoraires(demande: Demande, debutStatut: Date, horaires: HorairesOuvres, maintenant = new Date()): TempsDemande {
  const enCours = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debutStatut, maintenant);
  const fin = demande.termineeLe ?? maintenant;
  return {
    parStatut: cumuler(demande.minutesParStatut, demande.statut, enCours),
    parActeur: cumuler(demande.minutesParActeur, demande.acteurAttendu, enCours),
    total: minutesOuvrees(horaires, demande.ouverteLe, fin),
    premiereReponse: demande.premiereReponseLe ? minutesOuvrees(horaires, demande.ouverteLe, demande.premiereReponseLe) : null,
    statutCourant: enCours,
  };
}

// ---------------------------------------------------------------------------
// File du jour
// ---------------------------------------------------------------------------

export interface FiltresFile {
  compteId?: number;
  posteId?: number;
  familles?: string[];
  acteurs?: Acteur[];
  statuts?: Statut[];
  /** Ne garder que les demandes en retard de SLA ou dont l'echeance est proche. */
  risqueSeulement?: boolean;
  limite?: number;
}

export interface LigneFile {
  id: number;
  dossierId: number;
  dossier: string;
  client: string;
  famille: string;
  objet: string;
  statut: Statut;
  acteurAttendu: Acteur;
  priorite: Priorite;
  echeanceLe: Date | null;
  slaEcheanceLe: Date | null;
  niveauRelance: number;
  ouverteLe: Date;
  dernierEvenementLe: Date | null;
  /** Minutes ouvrees ecoulees depuis l'ouverture (age du stock). */
  ageMinutes: number;
  /** Minutes ouvrees dans le statut courant. */
  attenteMinutes: number;
  /** Vrai si l'echeance SLA est depassee. */
  slaDepasse: boolean;
  /** Jours restants avant l'echeance metier la plus proche (null si aucune). */
  joursAvantEcheance: number | null;
}

/** Condition de perimetre : T00 n'apparait dans aucune vue de pilotage. */
export function conditionPerimetre(): SQL {
  return sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`;
}

/**
 * File de travail triee par urgence : priorite, echeance SLA, echeance metier, puis anciennete.
 * Le tri final (risque) est affine en memoire car il depend des heures ouvrees.
 */
export async function fileDuJour(filtres: FiltresFile = {}, maintenant = new Date()): Promise<LigneFile[]> {
  const conditions: SQL[] = [conditionPerimetre()];
  conditions.push(inArray(schema.demandes.statut, filtres.statuts ?? STATUTS_OUVERTS));
  if (filtres.compteId) conditions.push(eq(schema.demandes.compteId, filtres.compteId));
  if (filtres.posteId) conditions.push(eq(schema.demandes.posteId, filtres.posteId));
  if (filtres.familles?.length) conditions.push(inArray(schema.demandes.famille, filtres.familles));
  if (filtres.acteurs?.length) conditions.push(inArray(schema.demandes.acteurAttendu, filtres.acteurs));

  const lignes = await db
    .select({
      demande: schema.demandes,
      dossierLibelle: schema.dossiers.libelle,
      client: schema.dossiers.client,
      debutStatut: sql<Date>`coalesce((
        SELECT max(t.survenu_le) FROM transitions_statut t WHERE t.demande_id = ${schema.demandes.id}
      ), ${schema.demandes.ouverteLe})`.as('debut_statut'),
      prochaineEcheance: sql<Date | null>`(
        SELECT min(e.echeance_le) FROM echeances e
        WHERE e.dossier_id = ${schema.demandes.dossierId} AND e.annulee = false AND e.honoree_le IS NULL AND e.echeance_le >= ${maintenant}
      )`.as('prochaine_echeance'),
    })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditions))
    .orderBy(asc(schema.demandes.echeanceLe), asc(schema.demandes.ouverteLe))
    .limit(Math.min(filtres.limite ?? 300, 1000));

  // Les horaires sont lus une fois par compte : pas de requete par ligne.
  const horairesParCompte = new Map<number, HorairesOuvres>();
  for (const compteId of new Set(lignes.map((l) => l.demande.compteId))) {
    horairesParCompte.set(compteId, await horairesDuCompte(compteId));
  }

  const resultat: LigneFile[] = lignes.map((l) => {
    const d = l.demande;
    const horaires = horairesParCompte.get(d.compteId)!;
    const temps = tempsDemandeAvecHoraires(d, new Date(l.debutStatut), horaires, maintenant);
    const echeance = l.prochaineEcheance ? new Date(l.prochaineEcheance) : null;
    return {
      id: d.id,
      dossierId: d.dossierId,
      dossier: l.dossierLibelle,
      client: l.client,
      famille: d.famille,
      objet: d.objet,
      statut: d.statut,
      acteurAttendu: d.acteurAttendu,
      priorite: d.priorite,
      echeanceLe: d.echeanceLe,
      slaEcheanceLe: d.slaEcheanceLe,
      niveauRelance: d.niveauRelance,
      ouverteLe: d.ouverteLe,
      dernierEvenementLe: d.dernierEvenementLe,
      ageMinutes: temps.total,
      attenteMinutes: temps.statutCourant,
      slaDepasse: Boolean(d.slaEcheanceLe && d.slaEcheanceLe <= maintenant),
      joursAvantEcheance: echeance ? Math.floor((echeance.getTime() - maintenant.getTime()) / 86_400_000) : null,
    };
  });

  const p = await lireParametres();
  const seuilAlerte = Math.max(...p.alertes.joursAvantEcheance, 0);
  const filtre = filtres.risqueSeulement
    ? resultat.filter((l) => l.slaDepasse || (l.joursAvantEcheance !== null && l.joursAvantEcheance <= seuilAlerte))
    : resultat;

  // Tri d'urgence : SLA depasse, puis echeance proche, puis priorite, puis anciennete.
  return filtre.sort((a, b) => {
    if (a.slaDepasse !== b.slaDepasse) return a.slaDepasse ? -1 : 1;
    const ea = a.joursAvantEcheance ?? 9999;
    const eb = b.joursAvantEcheance ?? 9999;
    if (ea !== eb) return ea - eb;
    const pa = POIDS_PRIORITES[a.priorite];
    const pb = POIDS_PRIORITES[b.priorite];
    if (pa !== pb) return pa - pb;
    return b.ageMinutes - a.ageMinutes;
  });
}

/** Demandes dont l'attente DO depasse le seuil, pour le digest de validation (phase 2). */
export async function attentesDo(compteId?: number) {
  const conditions: SQL[] = [conditionPerimetre(), eq(schema.demandes.statut, 'attente_do')];
  if (compteId) conditions.push(eq(schema.demandes.compteId, compteId));
  return db
    .select({ demande: schema.demandes, dossier: schema.dossiers.libelle, client: schema.dossiers.client })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditions))
    .orderBy(asc(schema.demandes.ouverteLe));
}

/** Demandes ouvertes d'un dossier. */
export async function demandesDuDossier(dossierId: number, ouvertesSeulement = false) {
  const conditions: SQL[] = [eq(schema.demandes.dossierId, dossierId), conditionPerimetre()];
  if (ouvertesSeulement) conditions.push(inArray(schema.demandes.statut, STATUTS_OUVERTS));
  return db.select().from(schema.demandes).where(and(...conditions)).orderBy(desc(schema.demandes.ouverteLe));
}

export { estFerme, isNull, isNotNull, or, lte };
