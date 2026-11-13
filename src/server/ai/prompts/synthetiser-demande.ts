/**
 * Prompt versionne de la tache `synthetiser_demande`.
 *
 * Le classeur de suivi tenu a la main portait quatre colonnes que le mail ne donne pas tel quel :
 * l'action qui debloque, le type de la demande, sa priorite et, s'il s'agit d'une reprise, sa
 * cause. Ce sont des syntheses, pas des champs : c'est exactement ce qu'une tache IA sait faire,
 * et ce qui evite d'avoir a tenir un classeur en parallele.
 *
 * Deux regles non negociables dans le prompt :
 *  - l'action attendue decrit **ce qui debloque**, jamais le reproche ;
 *  - rien n'est invente : ce que le message ne dit pas reste vide.
 */
import { CAUSES, LIBELLES_CAUSES } from '@shared/constantes';

export const VERSION_SYNTHETISER_DEMANDE = 'synthetiser_demande@1';

export const TYPES_DEMANDE = ['demande', 'reclamation', 'urgence', 'procedure', 'consigne', 'information'] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

export const SCHEMA_SYNTHETISER_DEMANDE = {
  type: 'object',
  properties: {
    action: { type: 'string', description: 'Action qui debloque, a l’infinitif, une phrase' },
    type: { type: 'string', enum: [...TYPES_DEMANDE] },
    priorite: { type: 'string', enum: ['haute', 'normale', 'basse'] },
    cause: { type: ['string', 'null'], enum: [...CAUSES, null] },
    confiance: { type: 'number', minimum: 0, maximum: 1 },
    justificatifs: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: ['action', 'type', 'priorite', 'confiance', 'justificatifs'],
} as const;

export function promptSynthetiserDemande(): string {
  const causes = CAUSES.map((c) => `  ${c} : ${LIBELLES_CAUSES[c]}`).join('\n');

  return [
    'Tu lis un message recu par une assistante placee chez un client, et tu en tires ce qu’il reste',
    'a faire. Le resultat alimente une GPAO de suivi d’activite.',
    '',
    'Reponds par un seul objet JSON conforme au schema fourni. Rien avant, rien apres.',
    '',
    'ACTION ATTENDUE',
    '  Une phrase a l’infinitif, qui dit ce qui debloque le dossier.',
    '  Ecris ce qu’il faut faire, jamais ce qui a ete mal fait.',
    '  « Renvoyer la facture avec le NIF du client » et non « la facture a ete envoyee sans le NIF ».',
    '  Si le message n’appelle aucune action, ecris exactement : Aucune action attendue.',
    '',
    'TYPE',
    '  demande     : un travail est demande',
    '  reclamation : le message signale un manquement, en plus de demander un travail',
    '  urgence     : une echeance tombe dans la journee ou un tiers est bloque',
    '  procedure   : une regle de travail est posee pour la suite',
    '  consigne    : une instruction ponctuelle, sans reproche',
    '  information : le message informe, sans rien attendre',
    '',
    'PRIORITE',
    '  haute   : echeance sous 24 heures, ou un client ou un tiers reste bloque',
    '  normale : le travail de la semaine',
    '  basse   : forme, classement, procedure, sans echeance',
    '  Ne mets pas tout en haute : une priorite qui ne trie plus rien ne sert a rien.',
    '',
    'CAUSE, seulement si le type est « reclamation », sinon null :',
    causes,
    '',
    'REGLES',
    '  N’invente rien. Ce que le message ne dit pas reste vide ou null.',
    '  Les justificatifs sont des extraits courts du message, recopies tels quels.',
    '  La confiance dit a quel point tu es sur : sous 0,8 un humain relira.',
    '  N’emploie jamais de tiret long.',
  ].join('\n');
}
