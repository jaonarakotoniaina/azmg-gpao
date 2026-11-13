/**
 * Synthese managériale d'un message : ce qui reste a faire, et comment le classer.
 *
 * C'est ce qui rend le classeur de suivi inutile. Les colonnes que le manager remplissait a la
 * main (action attendue, type, priorite, cause) se deduisent du message lui-meme, et la GPAO les
 * porte au fil de la collecte.
 *
 * Deux niveaux, jamais zero. Le fournisseur de production est `agent` : la tache part en file et
 * la reponse n'arrive qu'au passage de la routine, parfois jamais si elle n'est pas installee.
 * Les colonnes ne restent donc pas vides en attendant : `syntheseParRegles` les remplit tout de
 * suite a partir du texte du message et du referentiel, le suivi porte `origine: 'regles'`, et la
 * sortie de la routine prend le relais quand elle arrive (`appliquerSynthese`).
 */
import { z } from 'zod';
import { demanderIa, enregistrerSimulateur } from '../../ai/service';
import { lireParametres } from '../../lib/parametres';
import {
  promptSynthetiserDemande,
  SCHEMA_SYNTHETISER_DEMANDE,
  TYPES_DEMANDE,
  VERSION_SYNTHETISER_DEMANDE,
  type TypeDemande,
} from '../../ai/prompts/synthetiser-demande';
import { retirerTiretsLongs } from '@shared/tirets';
import { CAUSES, type Cause, type Priorite } from '@shared/constantes';
import { syntheseParRegles, type SortieSynthese } from './synthese-regles';
import { db, schema } from '../../db/client';
import { and, eq, sql } from 'drizzle-orm';
import { journal } from '../../lib/journal';

export const sortieSyntheseSchema = z.object({
  action: z.string().trim().min(3).max(400),
  type: z.enum(TYPES_DEMANDE),
  priorite: z.enum(['haute', 'normale', 'basse']),
  cause: z.enum(CAUSES).nullish(),
  confiance: z.number().min(0).max(1),
  justificatifs: z.array(z.string()).max(3).default([]),
});

export interface Synthese {
  action: string;
  type: TypeDemande;
  priorite: Priorite;
  cause: Cause | null;
  reprise: boolean;
  confiance: number;
  justificatifs: string[];
  /** Vrai quand la confiance atteint le seuil : sinon un humain relit avant application. */
  applicable: boolean;
  /** `ia` quand la routine a repondu, `regles` quand le repli deterministe a rempli les colonnes. */
  origine: 'ia' | 'regles';
}

export interface MessageASynthetiser {
  objet?: string | null;
  corps?: string | null;
  expediteur?: string | null;
  destinataires?: string[];
  famille?: string | null;
}

/**
 * Demande la synthese d'un message.
 *
 * Renvoie `null` dans un seul cas : l'automatisation est en pause, donc le commanditaire a
 * demande que rien ne soit rempli. Partout ailleurs la fonction rend une synthese, de l'IA quand
 * elle a repondu, des regles sinon. L'appelant n'a pas a deviner a la place.
 */
export async function synthetiserDemande(
  message: MessageASynthetiser,
  opts: { compteId?: number; demandeId?: number } = {},
): Promise<Synthese | null> {
  const parametres = await lireParametres();
  if (parametres.pauseAutomatisations || parametres.automatisations.synthese_demande?.actif === false) return null;

  const entree = {
    objet: message.objet ?? '',
    corps: (message.corps ?? '').slice(0, 4000),
    expediteur: message.expediteur ?? '',
    destinataires: message.destinataires ?? [],
    famille: message.famille ?? null,
  };

  const resultat = await demanderIa({
    type: 'synthetiser_demande',
    versionPrompt: VERSION_SYNTHETISER_DEMANDE,
    prompt: promptSynthetiserDemande(),
    schema: SCHEMA_SYNTHETISER_DEMANDE as unknown as Record<string, unknown>,
    entree,
    // La demande est portee dans le contexte : c'est par elle que la routine, au moment ou elle
    // repond, retrouve la ligne a corriger.
    contexte: { compteId: opts.compteId ?? null, demandeId: opts.demandeId ?? null },
    priorite: 25,
  });

  if (resultat.statut === 'traite' && resultat.sortie) {
    const valide = sortieSyntheseSchema.safeParse(resultat.sortie);
    if (valide.success) return finaliser(valide.data, 'ia', parametres.seuilConfianceTypage);
  }

  // Pas de reponse, ou une reponse invalide : les regles remplissent les colonnes des maintenant.
  // Elles sont toujours applicables, sans quoi on retomberait sur le vide qu'on cherche a eviter.
  return finaliser(syntheseParRegles(entree), 'regles', 0);
}

/** Mise en forme commune : les deux origines passent par le meme filtre et la meme regle de cause. */
function finaliser(sortie: SortieSynthese, origine: 'ia' | 'regles', seuil: number): Synthese {
  const reprise = sortie.type === 'reclamation';
  return {
    // Dernier filtre avant qu'un texte arrive sous les yeux d'un humain.
    action: retirerTiretsLongs(sortie.action),
    type: sortie.type,
    priorite: sortie.priorite,
    // Une cause n'a de sens que sur une reprise : ailleurs elle serait un jugement sans objet.
    cause: reprise ? (sortie.cause ?? null) : null,
    reprise,
    confiance: sortie.confiance,
    justificatifs: sortie.justificatifs.map(retirerTiretsLongs),
    applicable: sortie.confiance >= seuil,
    origine,
  };
}

/**
 * Applique a une demande la synthese que la routine vient de rendre.
 *
 * Elle ne remplace que ce que les regles avaient pose : une correction humaine, ou une ligne
 * venue de l'import du classeur, reste intacte. C'est la contrepartie du repli deterministe,
 * sans quoi la routine n'aurait plus aucun effet sur les demandes deja remplies.
 */
export async function appliquerSynthese(demandeId: number, sortie: unknown): Promise<boolean> {
  const valide = sortieSyntheseSchema.safeParse(sortie);
  if (!valide.success) return false;
  const parametres = await lireParametres();
  const synthese = finaliser(valide.data, 'ia', parametres.seuilConfianceTypage);
  if (!synthese.applicable) return false;

  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, demandeId));
  if (!demande) return false;
  const suivi = (demande.suivi ?? {}) as Record<string, unknown>;
  if (suivi.origine && suivi.origine !== 'regles') return false;

  await db
    .update(schema.demandes)
    .set({
      objet: synthese.action,
      priorite: synthese.priorite,
      reprise: synthese.reprise,
      cause: synthese.cause,
      suivi: { ...suivi, action: synthese.action, type: synthese.type, origine: 'synthese_ia', confiance: synthese.confiance, justificatifs: synthese.justificatifs },
      majLe: new Date(),
    })
    .where(and(eq(schema.demandes.id, demandeId), sql`coalesce(${schema.demandes.suivi} ->> 'origine', '') = 'regles'`));
  journal.info('Synthese IA appliquee a une demande', { demandeId });
  return true;
}

// ---------------------------------------------------------------------------
// Simulateur du mode `mock`
// ---------------------------------------------------------------------------

/**
 * Simulateur deterministe, pour que les tests n'appellent jamais de service externe.
 *
 * Il delegue aux memes regles que le repli de production, avec une confiance relevee : en mode
 * `mock`, la sortie tient la place de celle de l'IA.
 */
enregistrerSimulateur('synthetiser_demande', (entree) => {
  const e = entree as { objet?: string; corps?: string; famille?: string | null };
  // Le simulateur et le repli de production partagent les memes regles : ce que les tests
  // verifient est exactement ce qui tourne quand la routine n'a pas repondu.
  return { ...syntheseParRegles({ objet: e.objet, corps: e.corps, famille: e.famille ?? null }), confiance: 0.85 };
});
