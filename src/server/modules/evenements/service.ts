/**
 * Evenements : mail entrant ou sortant, consigne WhatsApp, vocal, note, import.
 *
 * Un evenement est l'unite de trace ; c'est son couple (sens, nature) qui fait avancer la demande,
 * d'apres le tableau « Natures et effet sur la demande » de la section 4.3 de CLAUDE.md.
 *
 * Deux regles de confidentialite sont tenues ici :
 *  - un evenement de famille T00 (hors perimetre) est trace mais ne cree ni ne fait avancer
 *    aucune demande, et n'apparait dans aucune vue de pilotage ni aucun export ;
 *  - aucune appreciation du client sur le collaborateur n'est extraite ni stockee en champ
 *    structure : seuls l'etat factuel du dossier et l'action qui debloque sont enregistres.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { changerStatut, creerDemande, enregistrerRelance, type Auteur, type Demande } from '../demandes/service';
import { definitionNature, estHorsPerimetre, type Interlocuteur, type Nature, type Priorite, type Sens, type Source, type Statut } from '@shared/constantes';

export type Evenement = typeof schema.evenements.$inferSelect;

export interface EntreeEvenement {
  /** Rattachement : une demande existante, ou un dossier (une demande sera creee si la nature l'exige). */
  demandeId?: number | null;
  dossierId?: number | null;
  sens: Sens;
  nature: Nature;
  famille?: string | null;
  interlocuteur?: Interlocuteur | null;
  source: Source;
  survenuLe?: Date;
  objet?: string | null;
  resume?: string | null;
  contenu?: string | null;
  filId?: string | null;
  messageId?: string | null;
  confianceTypage?: number | null;
  justificatifs?: unknown[];
  /** Pour une nature qui cree une demande : priorite et echeance a lui donner. */
  priorite?: Priorite;
  echeanceLe?: Date | null;
}

export interface ResultatEvenement {
  evenement: Evenement;
  demande: Demande | null;
  /** Vrai si une demande a ete creee par cet evenement. */
  demandeCreee: boolean;
  /** Statut applique a la demande, null si aucun changement. */
  statutApplique: Statut | null;
  /** Vrai si l'evenement est hors perimetre : trace seulement, aucun effet. */
  horsPerimetre: boolean;
}

/**
 * Effet d'une nature sur la demande.
 * `creation` : la nature ouvre une demande si l'evenement n'est pas deja rattache a une demande.
 */
interface Effet {
  creation: boolean;
  statut?: Statut;
  acteur?: 'poste' | 'do' | 'client' | 'tiers' | 'aucun';
  premiereReponse?: boolean;
  relance?: boolean;
}

export function effetNature(nature: Nature, interlocuteur?: Interlocuteur | null): Effet {
  switch (nature) {
    case 'demande_entrante':
      return { creation: true, statut: 'nouveau' };
    case 'consigne_do':
      return { creation: true, statut: 'en_cours', acteur: 'poste' };
    case 'envoi_livrable':
      // Le livrable part vers le destinataire : l'attente est a lui.
      return { creation: false, statut: 'attente_tiers', acteur: interlocuteur === 'client' ? 'client' : 'tiers', premiereReponse: true };
    case 'demande_validation_do':
      return { creation: false, statut: 'attente_do', acteur: 'do', premiereReponse: true };
    case 'validation_do':
      // La DO a valide : le travail revient au poste, qui finalise puis cloture lui-meme.
      return { creation: false, statut: 'en_cours', acteur: 'poste' };
    case 'refus_do':
      return { creation: false, statut: 'en_cours', acteur: 'poste' };
    case 'relance_emise':
      return { creation: false, relance: true };
    case 'relance_recue':
      // Le tiers relance : la balle est revenue au poste.
      return { creation: false, statut: 'en_cours', acteur: 'poste' };
    case 'reponse_tiers':
      return { creation: false, statut: 'en_cours', acteur: 'poste' };
    case 'information':
      return { creation: false };
  }
}

function verifierSens(nature: Nature, sens: Sens) {
  const def = definitionNature(nature);
  if (!def) throw new ErreurHttp(400, `Nature inconnue : ${nature}`);
  if (def.sens && !def.sens.includes(sens)) {
    throw new ErreurHttp(400, `La nature « ${def.libelle} » n'est pas compatible avec le sens « ${sens} »`);
  }
}

/**
 * Enregistre un evenement et applique son effet sur la demande.
 * Dedoublonnage : un `messageId` deja connu renvoie l'evenement existant sans rien modifier,
 * ce qui rend l'import d'un fil deux fois sans effet (critere de la phase 4).
 */
export async function ajouterEvenement(entree: EntreeEvenement, auteur: Auteur): Promise<ResultatEvenement> {
  verifierSens(entree.nature, entree.sens);
  if (!entree.demandeId && !entree.dossierId) throw new ErreurHttp(400, 'Un evenement doit etre rattache a une demande ou a un dossier');

  if (entree.messageId) {
    const [deja] = await db.select().from(schema.evenements).where(eq(schema.evenements.messageId, entree.messageId));
    if (deja) {
      const demande = deja.demandeId ? await lireDemande(deja.demandeId) : null;
      return { evenement: deja, demande, demandeCreee: false, statutApplique: null, horsPerimetre: estHorsPerimetre(deja.famille) };
    }
  }

  let demande: Demande | null = entree.demandeId ? await lireDemande(entree.demandeId) : null;
  const dossierId = demande?.dossierId ?? entree.dossierId ?? null;
  if (!dossierId) throw new ErreurHttp(400, 'Dossier introuvable pour cet evenement');

  const [dossier] = await db
    .select({ id: schema.dossiers.id, compteId: schema.dossiers.compteId })
    .from(schema.dossiers)
    .where(eq(schema.dossiers.id, dossierId));
  if (!dossier) throw new ErreurHttp(404, 'Dossier introuvable');

  const survenuLe = entree.survenuLe ?? new Date();
  const horsPerimetre = estHorsPerimetre(entree.famille);
  const effet = horsPerimetre ? { creation: false } : effetNature(entree.nature, entree.interlocuteur);

  // Une nature creatrice sans demande rattachee ouvre une demande, sauf hors perimetre.
  let demandeCreee = false;
  if (!demande && effet.creation) {
    const famille = entree.famille;
    if (!famille) throw new ErreurHttp(400, 'La famille est obligatoire pour ouvrir une demande');
    demande = await creerDemande(
      {
        dossierId: dossier.id,
        famille,
        objet: entree.objet?.trim() || entree.resume?.trim() || 'Demande sans objet',
        origine: entree.source,
        statut: effet.statut ?? 'nouveau',
        priorite: entree.priorite,
        echeanceLe: entree.echeanceLe ?? null,
        ouverteLe: survenuLe,
      },
      auteur,
    );
    demandeCreee = true;
  }

  const [evenement] = await db
    .insert(schema.evenements)
    .values({
      demandeId: demande?.id ?? null,
      dossierId: dossier.id,
      compteId: dossier.compteId,
      sens: entree.sens,
      famille: entree.famille ?? demande?.famille ?? null,
      nature: entree.nature,
      interlocuteur: entree.interlocuteur ?? null,
      source: entree.source,
      filId: entree.filId ?? null,
      messageId: entree.messageId ?? null,
      survenuLe,
      objet: entree.objet ?? null,
      resume: entree.resume ?? null,
      contenu: entree.contenu ?? null,
      confianceTypage: entree.confianceTypage ?? null,
      justificatifs: entree.justificatifs ?? [],
      creeParId: auteur.utilisateurId,
    })
    .returning();

  let statutApplique: Statut | null = null;
  if (demande && !horsPerimetre) {
    if (effet.relance) {
      demande = await enregistrerRelance(demande.id, auteur, survenuLe);
    }
    if (effet.statut && !demandeCreee) {
      const avant = demande.statut;
      demande = await changerStatut(demande.id, effet.statut, auteur, {
        motif: definitionNature(entree.nature)?.libelle ?? entree.nature,
        acteurAttendu: effet.acteur,
        evenementId: evenement.id,
        survenuLe,
        premiereReponse: effet.premiereReponse,
      });
      statutApplique = demande.statut === avant ? null : demande.statut;
    } else if (demandeCreee) {
      statutApplique = demande.statut;
    }
    // Un evenement de pure information met a jour la fraicheur sans toucher au statut.
    if (!effet.statut && !effet.relance) {
      await db
        .update(schema.demandes)
        .set({ dernierEvenementLe: survenuLe, majLe: new Date() })
        .where(eq(schema.demandes.id, demande.id));
    }
  }

  await journaliser('evenement_ajoute', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'evenement',
    entiteId: evenement.id,
    details: { dossierId: dossier.id, demandeId: demande?.id ?? null, nature: entree.nature, sens: entree.sens, source: entree.source, horsPerimetre },
  });

  return { evenement, demande, demandeCreee, statutApplique, horsPerimetre };
}

async function lireDemande(id: number): Promise<Demande> {
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, id));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  return demande;
}

/** Evenements d'une demande, du plus recent au plus ancien. */
export async function evenementsDeLaDemande(demandeId: number, limite = 100) {
  return db
    .select()
    .from(schema.evenements)
    .where(eq(schema.evenements.demandeId, demandeId))
    .orderBy(desc(schema.evenements.survenuLe))
    .limit(Math.min(limite, 500));
}

/**
 * File « A classer » : evenements dont le typage automatique est sous le seuil de confiance,
 * ou qui n'ont pas de famille. Exclut le hors perimetre, qui n'a pas besoin d'etre classe.
 */
export async function aClasser(seuil: number, limite = 50) {
  return db
    .select({ evenement: schema.evenements, dossier: schema.dossiers.libelle })
    .from(schema.evenements)
    .leftJoin(schema.dossiers, eq(schema.dossiers.id, schema.evenements.dossierId))
    .where(
      and(
        sql`coalesce(${schema.evenements.famille}, '') <> 'T00'`,
        sql`${schema.evenements.corrigeLe} IS NULL`,
        sql`(${schema.evenements.famille} IS NULL OR (${schema.evenements.confianceTypage} IS NOT NULL AND ${schema.evenements.confianceTypage} < ${seuil}))`,
      ),
    )
    .orderBy(desc(schema.evenements.survenuLe))
    .limit(Math.min(limite, 200));
}

/**
 * Correction manuelle du typage d'un evenement. Trace le correcteur et la date :
 * la phase 3 s'en sert pour proposer une nouvelle regle de typage.
 */
export async function corrigerTypage(
  evenementId: number,
  modifs: { famille?: string; nature?: Nature; interlocuteur?: Interlocuteur | null; sens?: Sens },
  auteur: Auteur,
): Promise<Evenement> {
  const [evenement] = await db.select().from(schema.evenements).where(eq(schema.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, 'Evenement introuvable');
  if (modifs.nature && modifs.sens) verifierSens(modifs.nature, modifs.sens);

  const [maj] = await db
    .update(schema.evenements)
    .set({
      famille: modifs.famille ?? evenement.famille,
      nature: modifs.nature ?? evenement.nature,
      interlocuteur: modifs.interlocuteur !== undefined ? modifs.interlocuteur : evenement.interlocuteur,
      sens: modifs.sens ?? evenement.sens,
      // Le typage devient humain : la confiance automatique n'a plus de sens.
      confianceTypage: null,
      corrigeParId: auteur.utilisateurId,
      corrigeLe: new Date(),
    })
    .where(eq(schema.evenements.id, evenementId))
    .returning();

  await journaliser('typage_corrige', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'evenement',
    entiteId: evenementId,
    details: { avant: { famille: evenement.famille, nature: evenement.nature, interlocuteur: evenement.interlocuteur }, apres: modifs },
  });
  return maj;
}
