/**
 * Prompt versionne de la tache `typer_evenement`.
 *
 * Il est envoye tel quel a la routine Claude Code (fournisseur `agent`) ou a l'API (fournisseur
 * `api`). Toute evolution passe par une nouvelle version, pour qu'un resultat reste rattachable
 * au prompt qui l'a produit.
 */
import { DEFINITIONS_NATURES, FAMILLES, INTERLOCUTEURS, LIBELLES_INTERLOCUTEURS, SENS } from '@shared/constantes';

export const VERSION_TYPER_EVENEMENT = 'typer_evenement@1';

export const SCHEMA_TYPER_EVENEMENT = {
  type: 'object',
  properties: {
    famille: { type: 'string', description: 'Code de famille, par exemple T01' },
    nature: { type: 'string', enum: DEFINITIONS_NATURES.map((n) => n.code) },
    sens: { type: 'string', enum: [...SENS] },
    interlocuteur: { type: ['string', 'null'], enum: [...INTERLOCUTEURS, null] },
    confiance: { type: 'number', minimum: 0, maximum: 1 },
    justificatifs: { type: 'array', items: { type: 'string' }, maxItems: 4 },
  },
  required: ['famille', 'nature', 'confiance', 'justificatifs'],
} as const;

export function promptTyperEvenement(): string {
  const familles = FAMILLES.map((f) => `  ${f.code} : ${f.libelle}`).join('\n');
  const natures = DEFINITIONS_NATURES.map((n) => `  ${n.code} : ${n.libelle}, ${n.effet}`).join('\n');
  const interlocuteurs = INTERLOCUTEURS.map((c) => `  ${c} : ${LIBELLES_INTERLOCUTEURS[c]}`).join('\n');

  return [
    "Tu classes un message recu ou envoye par une assistante export, pour une GPAO de suivi d'activite.",
    '',
    'Reponds par un seul objet JSON conforme au schema fourni. Rien avant, rien apres.',
    '',
    'FAMILLES :',
    familles,
    '',
    'NATURES :',
    natures,
    '',
    'INTERLOCUTEURS :',
    interlocuteurs,
    '',
    'REGLES, sans exception :',
    "  1. N'invente rien. Si le message ne permet pas de trancher, baisse la confiance au lieu de deviner.",
    '     Sous le seuil, un humain classera : c’est le comportement voulu, pas un echec.',
    '  2. Chaque champ propose doit s’appuyer sur un extrait du message, que tu rends dans',
    '     justificatifs (quatre au maximum, courts).',
    '  3. Un message de marketing, de design, une notification automatique ou un spam se classe en',
    '     T00 avec une confiance elevee. Ne lui cherche pas une autre famille : il doit sortir du',
    '     pilotage.',
    '  4. Ne reprends jamais une appreciation du client sur la personne qui tient le poste, ni en',
    '     justificatif ni ailleurs. Tu decris ce dont parle le message, pas la qualite du travail.',
    "  5. Aucun tiret long dans ta reponse : ni cadratin, ni demi-cadratin. Virgule, deux-points,",
    '     parentheses ou point.',
    '  6. Le sens est donne quand il est connu. S’il ne l’est pas, deduis-le : un message de',
    "     l'assistante vers l'exterieur est sortant, un message recu est entrant, une note est interne.",
    '',
    'ENTREE : un objet JSON avec objet, corps, expediteur, destinataires et sens eventuel.',
  ].join('\n');
}
