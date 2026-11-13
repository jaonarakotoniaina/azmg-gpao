/**
 * Synthese managériale d'un message : ce qui reste a faire, et comment le classer.
 *
 * C'est ce qui rend le classeur de suivi inutile. Les colonnes que le manager remplissait a la
 * main (action attendue, type, priorite, cause) se deduisent du message lui-meme, et la GPAO les
 * porte au fil de la collecte.
 *
 * Degradation prevue : sans fournisseur IA disponible, la synthese est vide et la demande garde
 * ce que les regles savent en dire. Une colonne vide se voit ; une colonne inventee ne se voit
 * pas.
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
import { normaliser } from '@shared/texte';
import { CAUSES, type Cause, type Priorite } from '@shared/constantes';

const sortieSchema = z.object({
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
 * Renvoie `null` quand aucune synthese n'a pu etre obtenue : fournisseur absent, automatisation
 * en pause, sortie invalide. L'appelant continue sans, il ne devine pas a la place.
 */
export async function synthetiserDemande(message: MessageASynthetiser, opts: { compteId?: number } = {}): Promise<Synthese | null> {
  const parametres = await lireParametres();
  if (parametres.pauseAutomatisations || parametres.automatisations.synthese_demande?.actif === false) return null;

  const resultat = await demanderIa({
    type: 'synthetiser_demande',
    versionPrompt: VERSION_SYNTHETISER_DEMANDE,
    prompt: promptSynthetiserDemande(),
    schema: SCHEMA_SYNTHETISER_DEMANDE as unknown as Record<string, unknown>,
    entree: {
      objet: message.objet ?? '',
      corps: (message.corps ?? '').slice(0, 4000),
      expediteur: message.expediteur ?? '',
      destinataires: message.destinataires ?? [],
      famille: message.famille ?? null,
    },
    contexte: { compteId: opts.compteId ?? null },
    priorite: 25,
  });

  if (resultat.statut !== 'traite' || !resultat.sortie) return null;
  const valide = sortieSchema.safeParse(resultat.sortie);
  if (!valide.success) return null;

  const sortie = valide.data;
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
    applicable: sortie.confiance >= parametres.seuilConfianceTypage,
  };
}

// ---------------------------------------------------------------------------
// Simulateur du mode `mock`
// ---------------------------------------------------------------------------

/**
 * Simulateur deterministe, pour que les tests n'appellent jamais de service externe.
 *
 * Il reprend les indices de cause de l'import, et deduit le type et la priorite des memes mots
 * que ceux que le prompt decrit. Il ne remplace pas l'IA : il donne un resultat stable, et assez
 * proche pour que les tests disent quelque chose.
 */
enregistrerSimulateur('synthetiser_demande', (entree) => {
  const e = entree as { objet?: string; corps?: string };
  const texte = normaliser(`${e.objet ?? ''} ${e.corps ?? ''}`);

  const reclamation = /non fait|pas fait|pas repondu|sans repondre|erreur|toujours rien|a revoir|non conforme|plusieurs fois/.test(texte);
  const urgence = /urgent|aujourd hui|cut off|ce matin|immediat|des que possible|avant ce soir/.test(texte);
  const procedure = /procedure|desormais|a chaque fois|systematiquement|pour la suite|regle/.test(texte);
  const type: TypeDemande = reclamation ? 'reclamation' : urgence ? 'urgence' : procedure ? 'procedure' : 'demande';

  const priorite = urgence || reclamation ? 'haute' : procedure ? 'basse' : 'normale';
  const cause = reclamation ? (causeSimulee(texte) ?? 'procedure_non_suivie') : null;

  return {
    action: (e.objet ?? 'Traiter la demande').slice(0, 200),
    type,
    priorite,
    cause,
    confiance: 0.85,
    justificatifs: [(e.objet ?? '').slice(0, 80)].filter(Boolean),
  };
});

/** Cause simulee, sur les memes indices que l'import : les tests restent coherents entre eux. */
function causeSimulee(texte: string): Cause | null {
  if (/classement|tracabilite|enregistre|introuvable/.test(texte)) return 'classement_tracabilite';
  if (/procedure|consigne|sans validation/.test(texte)) return 'procedure_non_suivie';
  if (/erreur|incoherence|incorrect/.test(texte)) return 'erreur_document';
  if (/charte|qualite|non conforme/.test(texte)) return 'qualite_livrable';
  if (/autonomie|sans attendre/.test(texte)) return 'manque_autonomie';
  if (/sans repondre|pas repondu|toujours rien|retard/.test(texte)) return 'delai_reponse';
  return null;
}
