/**
 * Typage d'un evenement : regles d'abord, IA ensuite, file « A classer » en dernier recours.
 *
 * L'ordre n'est pas anodin. Les regles sont gratuites, instantanees et **explicables** : quand le
 * manager demande pourquoi un mail a ete classe en T04, on lui montre la regle. L'IA ne traite que
 * ce qu'aucune regle ne tranche, et son resultat n'est applique que s'il depasse le seuil de
 * confiance des parametres. En dessous, l'evenement attend un humain plutot que d'etre range de
 * travers : une erreur de classement fausse la file du jour, les indicateurs et le reporting.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { lireParametres } from '../../lib/parametres';
import { demanderIa, enregistrerSimulateur } from '../../ai/service';
import { promptTyperEvenement, SCHEMA_TYPER_EVENEMENT, VERSION_TYPER_EVENEMENT } from '../../ai/prompts/typer-evenement';
import { appliquerRegles, REGLES_INITIALES, type RegleTypage } from './regles';
import { domaineDe, normaliserTypage, type MessageAClasser, type Typage } from '@shared/typage';
import { CODES_FAMILLES, estHorsPerimetre, INTERLOCUTEURS, NATURES, SENS, type Interlocuteur, type Nature, type Sens } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

// ---------------------------------------------------------------------------
// Regles en base
// ---------------------------------------------------------------------------

/** Charge les regles actives de la base, completees par le referentiel initial si la base est vide. */
export async function reglesActives(compteId?: number): Promise<RegleTypage[]> {
  const lignes = await db
    .select()
    .from(schema.reglesTypage)
    .where(and(eq(schema.reglesTypage.actif, true), eq(schema.reglesTypage.proposee, false)))
    .orderBy(asc(schema.reglesTypage.priorite));

  const enBase: RegleTypage[] = lignes
    .filter((l) => !l.compteId || !compteId || l.compteId === compteId)
    .map((l) => ({
      id: l.id,
      libelle: l.libelle,
      domaine: l.domaine,
      motsCles: (l.motsCles as string[]) ?? [],
      famille: l.famille,
      nature: l.nature,
      interlocuteur: l.interlocuteur,
      priorite: l.priorite,
      actif: l.actif,
    }));

  return enBase.length ? enBase : REGLES_INITIALES;
}

/** Copie le referentiel initial de regles en base, au premier demarrage. Idempotent. */
export async function initialiserRegles(): Promise<{ ajoutees: number }> {
  let ajoutees = 0;
  for (const regle of REGLES_INITIALES) {
    const [existe] = await db.select({ id: schema.reglesTypage.id }).from(schema.reglesTypage).where(eq(schema.reglesTypage.libelle, regle.libelle));
    if (existe) continue;
    await db.insert(schema.reglesTypage).values({
      libelle: regle.libelle,
      domaine: regle.domaine ?? null,
      motsCles: regle.motsCles ?? [],
      famille: regle.famille ?? null,
      nature: regle.nature ?? null,
      interlocuteur: regle.interlocuteur ?? null,
      priorite: regle.priorite,
      actif: true,
      proposee: false,
    });
    ajoutees++;
  }
  return { ajoutees };
}

// ---------------------------------------------------------------------------
// Typage
// ---------------------------------------------------------------------------

/** Schema de la sortie attendue de la tache IA, qui valide ce que renvoie la routine. */
export const sortieTypageSchema = z.object({
  famille: z.enum(CODES_FAMILLES as [string, ...string[]]),
  nature: z.enum(NATURES),
  sens: z.enum(SENS).optional(),
  interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
  confiance: z.number().min(0).max(1),
  justificatifs: z.array(z.string().max(300)).max(4).default([]),
});

export interface ResultatTypage {
  typage: Typage;
  /** Vrai si le typage depasse le seuil et peut etre applique sans relecture. */
  applicable: boolean;
  /** Identifiant de la tache IA si elle attend la routine. */
  tacheIaId: number | null;
}

/**
 * Type un message. `compteId` sert a prendre les regles propres au compte client.
 *
 * Les regles ont le dernier mot sur le hors perimetre : un message reconnu T00 par une regle ne
 * part jamais a l'IA. C'est voulu, pour que le filtre du perimetre reste gratuit et previsible.
 */
export async function typerMessage(message: MessageAClasser, opts: { compteId?: number; sansIa?: boolean } = {}): Promise<ResultatTypage> {
  const parametres = await lireParametres();
  const seuil = parametres.seuilConfianceTypage;

  const parRegles = appliquerRegles(message, await reglesActives(opts.compteId));
  if (parRegles && (parRegles.typage.confiance >= seuil || estHorsPerimetre(parRegles.typage.famille))) {
    return { typage: parRegles.typage, applicable: true, tacheIaId: null };
  }

  if (opts.sansIa || parametres.pauseAutomatisations || parametres.automatisations.typage_ia?.actif === false) {
    return { typage: parRegles?.typage ?? typageVide(message), applicable: false, tacheIaId: null };
  }

  const resultat = await demanderIa({
    type: 'typer_evenement',
    versionPrompt: VERSION_TYPER_EVENEMENT,
    prompt: promptTyperEvenement(),
    schema: SCHEMA_TYPER_EVENEMENT as unknown as Record<string, unknown>,
    entree: {
      objet: message.objet ?? '',
      corps: (message.corps ?? '').slice(0, 4000),
      expediteur: message.expediteur ?? '',
      destinataires: message.destinataires ?? [],
      sens: message.sens ?? null,
    },
    contexte: { compteId: opts.compteId ?? null },
    priorite: 30,
  });

  if (resultat.statut === 'traite' && resultat.sortie) {
    const valide = sortieTypageSchema.safeParse(resultat.sortie);
    if (valide.success) {
      const typage: Typage = {
        famille: valide.data.famille,
        nature: valide.data.nature,
        interlocuteur: valide.data.interlocuteur ?? parRegles?.typage.interlocuteur ?? null,
        sens: valide.data.sens ?? message.sens ?? null,
        confiance: valide.data.confiance,
        justificatifs: valide.data.justificatifs,
        origine: 'ia',
      };
      return { typage, applicable: typage.confiance >= seuil, tacheIaId: null };
    }
  }

  // L'IA n'a pas repondu (elle attend la routine) ou sa sortie est invalide : on garde ce que
  // les regles ont trouve, non applicable, et l'evenement part dans la file « A classer ».
  return { typage: parRegles?.typage ?? typageVide(message), applicable: false, tacheIaId: resultat.tacheId };
}

function typageVide(message: MessageAClasser): Typage {
  return {
    famille: null,
    nature: null,
    interlocuteur: null,
    sens: message.sens ?? null,
    confiance: 0,
    justificatifs: [],
    origine: 'defaut',
  };
}

// Simulateur du mode `mock` : il rejoue les regles, pour que les tests restent deterministes
// sans jamais appeler un service externe.
enregistrerSimulateur('typer_evenement', (entree) => {
  const message = entree as unknown as MessageAClasser;
  const parRegles = appliquerRegles(message, REGLES_INITIALES);
  if (!parRegles?.typage.famille || !parRegles.typage.nature) {
    return { famille: 'T00', nature: 'information', confiance: 0.1, justificatifs: ['aucune regle ne tranche'] };
  }
  return {
    famille: parRegles.typage.famille,
    nature: parRegles.typage.nature,
    sens: parRegles.typage.sens ?? undefined,
    interlocuteur: parRegles.typage.interlocuteur,
    confiance: parRegles.typage.confiance,
    justificatifs: parRegles.typage.justificatifs.slice(0, 4),
  };
});

// ---------------------------------------------------------------------------
// Proposition de regle a chaque correction manuelle
// ---------------------------------------------------------------------------

/**
 * Mots ecartes d'une proposition de regle.
 *
 * Deux familles : les mots vides du francais, et les mots de contexte qui reviennent dans presque
 * tous les messages du poste (« dossier », « point », « suite »). Une regle batie sur eux
 * classerait a peu pres n'importe quoi, ce qui est pire que pas de regle du tout.
 */
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux', 'en', 'pour', 'par', 'sur', 'dans',
  'avec', 'sans', 'ce', 'cet', 'cette', 'nous', 'vous', 'je', 'tu', 'il', 'elle', 'est', 'sont', 'ete', 'avoir', 'etre',
  'que', 'qui', 'quoi', 'dont', 'votre', 'notre', 'vos', 'nos', 'son', 'sa', 'ses', 'leur', 'bonjour', 'merci', 'cordialement',
  're', 'fw', 'tr', 'objet', 'madame', 'monsieur', 'bien', 'tres', 'plus', 'pas', 'ne', 'se', 'si', 'mais', 'donc',
  // Mots de contexte, trop frequents dans les echanges du poste pour distinguer quoi que ce soit.
  'dossier', 'dossiers', 'point', 'points', 'suite', 'echange', 'echanges', 'message', 'messages',
  'concernant', 'sujet', 'nouvelle', 'nouveau', 'nouvelles', 'nouveaux', 'urgent', 'important',
  'information', 'informations', 'retour', 'reponse', 'question', 'questions', 'elements', 'element',
]);

/**
 * Propose une regle a partir d'une correction manuelle.
 *
 * Elle est enregistree en base avec `proposee = true` : elle ne classe rien tant qu'un
 * administrateur ne l'a pas acceptee dans les Parametres. C'est deliberé : une regle tiree d'un
 * seul message se trompe souvent, et une mauvaise regle contamine tout le pilotage.
 */
export async function proposerRegle(
  evenementId: number,
  correction: { famille?: string; nature?: Nature; interlocuteur?: Interlocuteur | null; sens?: Sens },
  auteur: Auteur,
): Promise<{ regleId: number; motsCles: string[]; domaine: string | null } | null> {
  const [evenement] = await db.select().from(schema.evenements).where(eq(schema.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, 'Evenement introuvable');

  // Mots distinctifs de l'objet : c'est lui qui porte le sujet du message.
  const motsObjet = normaliserTypage(evenement.objet ?? '')
    .split(' ')
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m));
  const motsCles = [...new Set(motsObjet)].slice(0, 4);
  // Le domaine de l'expediteur n'est retenu que s'il est exterieur a AZMG : une regle sur le
  // domaine du poste lui-meme classerait tous ses propres envois de la meme facon.
  const domaineBrut = domaineDe(evenement.expediteur);
  const domaine = domaineBrut && !domaineBrut.includes('azmg-solutions') ? domaineBrut : null;

  if (!motsCles.length && !domaine) return null;

  const libelle = `Propose depuis « ${(evenement.objet ?? 'un evenement').slice(0, 60)} »`;
  const [existe] = await db.select({ id: schema.reglesTypage.id }).from(schema.reglesTypage).where(eq(schema.reglesTypage.libelle, libelle));
  if (existe) return null;

  const [regle] = await db
    .insert(schema.reglesTypage)
    .values({
      compteId: evenement.compteId,
      libelle,
      domaine,
      motsCles,
      famille: correction.famille ?? null,
      nature: correction.nature ?? null,
      interlocuteur: correction.interlocuteur ?? null,
      // Priorite basse : une regle proposee ne doit pas primer sur le referentiel.
      priorite: 80,
      actif: true,
      proposee: true,
      creeParId: auteur.utilisateurId,
    })
    .returning();

  await journaliser('regle_proposee', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'regle_typage',
    entiteId: regle.id,
    details: { evenementId, motsCles, famille: correction.famille ?? null, nature: correction.nature ?? null },
  });

  return { regleId: regle.id, motsCles, domaine };
}

/** Accepte une regle proposee : elle entre alors dans le jeu actif. */
export async function accepterRegle(regleId: number, auteur: Auteur) {
  const [maj] = await db
    .update(schema.reglesTypage)
    .set({ proposee: false, majLe: new Date() })
    .where(eq(schema.reglesTypage.id, regleId))
    .returning();
  if (!maj) throw new ErreurHttp(404, 'Regle introuvable');
  await journaliser('regle_acceptee', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'regle_typage', entiteId: regleId });
  return maj;
}

export async function refuserRegle(regleId: number, auteur: Auteur) {
  const [maj] = await db
    .update(schema.reglesTypage)
    .set({ actif: false, majLe: new Date() })
    .where(eq(schema.reglesTypage.id, regleId))
    .returning();
  if (!maj) throw new ErreurHttp(404, 'Regle introuvable');
  await journaliser('regle_refusee', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'regle_typage', entiteId: regleId });
  return maj;
}

/** Regles en attente de decision, pour l'ecran Parametres. */
export async function reglesProposees(limite = 50) {
  return db
    .select()
    .from(schema.reglesTypage)
    .where(and(eq(schema.reglesTypage.proposee, true), eq(schema.reglesTypage.actif, true)))
    .orderBy(desc(schema.reglesTypage.creeLe))
    .limit(limite);
}

export { sql };
