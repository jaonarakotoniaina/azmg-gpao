/**
 * Synthese d'un message par regles, sans aucun appel exterieur.
 *
 * Pourquoi elle existe. Le fournisseur IA de production est `agent` : la tache part dans
 * `ai_tasks` et attend une routine Claude Code. Tant que cette routine ne tourne pas, la reponse
 * n'arrive jamais, et les quatre colonnes du suivi (action attendue, type, priorite, cause)
 * restaient vides. Le manager devait retourner a son classeur, ce qu'on cherchait a supprimer.
 *
 * Ce que ces regles s'autorisent. Elles ne devinent rien sur le cas : l'action vient soit d'une
 * phrase de demande presente dans le message, citee telle quelle, soit du travail que la famille
 * designe dans le referentiel. Le type, la priorite et la cause viennent de mots effectivement
 * presents dans le texte, et chaque conclusion rend le mot qui l'a declenchee dans
 * `justificatifs`. Rien d'invente, donc : du texte lu, et du referentiel.
 *
 * Ce qu'elles ne pretendent pas etre. Elles sont moins fines qu'une lecture du message : elles
 * sont marquees `origine: 'regles'` dans le suivi de la demande, et la sortie de la routine les
 * remplace des qu'elle arrive (voir `appliquerSynthese`).
 */
import { ACTIONS_PAR_FAMILLE, CAUSES, type Cause, type Priorite } from '@shared/constantes';
import { normaliser } from '@shared/texte';
import type { TypeDemande } from '../../ai/prompts/synthetiser-demande';

/** Sortie au format du prompt : les regles et l'IA rendent la meme forme. */
export interface SortieSynthese {
  action: string;
  type: TypeDemande;
  priorite: Priorite;
  cause?: Cause | null;
  confiance: number;
  justificatifs: string[];
}

export interface EntreeSynthese {
  objet?: string | null;
  corps?: string | null;
  famille?: string | null;
}

/** Marqueurs d'une phrase qui demande quelque chose, en francais, anglais et espagnol. */
const MARQUEURS_DEMANDE = [
  'merci de',
  'merci d',
  'pouvez vous',
  'pourriez vous',
  'peux tu',
  'peut tu',
  'veuillez',
  'il faut',
  'il faudrait',
  'j attends',
  'je souhaite',
  'je voudrais',
  'besoin de',
  'a envoyer',
  'a renvoyer',
  'a corriger',
  'a confirmer',
  'a relancer',
  'please',
  'could you',
  'kindly',
  'we need',
  'por favor',
  'necesito',
  'podria',
];

/** Mots qui disent qu'un travail revient a cause d'un manquement. */
const INDICES_RECLAMATION =
  /non fait|pas fait|pas ete fait|pas repondu|sans repondre|toujours rien|toujours pas|a revoir|non conforme|incomplet|manquant|oubli|oublie|erreur|deja demande|je redemande|plusieurs fois|comme convenu|rappel|encore une fois/;

/** Mots qui disent qu'une echeance est proche. */
const INDICES_URGENCE =
  /urgent|urgence|aujourd hui|ce matin|ce soir|avant ce soir|des que possible|asap|immediat|immediatement|cut off|cutoff|demain matin|au plus vite/;

/** Mots qui disent qu'on fixe une maniere de faire, pas un travail a rendre. */
const INDICES_PROCEDURE =
  /procedure|desormais|dorenavant|a chaque fois|systematiquement|pour la suite|a l avenir|regle|consigne a suivre|penser a toujours/;

/** Causes d'une reprise, dans l'ordre ou elles sont cherchees. Les memes que celles de l'import. */
const INDICES_CAUSE: readonly { cause: Cause; motif: RegExp }[] = [
  { cause: 'classement_tracabilite', motif: /classement|tracabilite|introuvable|pas enregistre|pas archive|retrouver le fichier|pas dans le dossier/ },
  { cause: 'erreur_document', motif: /erreur|incoherence|incorrect|faux|mauvais numero|mauvaise reference|ne correspond pas/ },
  { cause: 'qualite_livrable', motif: /non conforme|charte|mise en forme|presentation|qualite du document|a refaire/ },
  { cause: 'delai_reponse', motif: /pas repondu|sans repondre|toujours rien|toujours pas|retard|delai|depuis hier|depuis plusieurs jours/ },
  { cause: 'manque_autonomie', motif: /autonomie|sans attendre|il fallait|tu devais savoir|initiative/ },
  { cause: 'procedure_non_suivie', motif: /procedure|consigne|sans validation|sans me demander|comme convenu|je l avais dit/ },
];

/**
 * Premiere phrase du message qui demande quelque chose.
 *
 * On rend la phrase telle qu'elle est ecrite : c'est la demande de l'interlocuteur, pas une
 * reformulation. Les phrases trop courtes (« merci de votre retour ») ou trop longues (un
 * paragraphe entier) ne sont pas des actions utilisables.
 */
export function phraseDemande(corps: string): string | null {
  // Les retours a la ligne separent avant tout : « Bonjour, » et la demande qui suit sont deux
  // phrases, meme sans point entre elles. Les espaces ne sont ramasses qu'ensuite, dans chaque
  // phrase, sans quoi la salutation resterait collee a la demande.
  const phrases = corps
    .split(/\n+/)
    .flatMap((bloc) => bloc.split(/(?<=[.!?;])\s+/))
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 15 && p.length <= 220);

  for (const phrase of phrases) {
    const nue = normaliser(phrase);
    if (MARQUEURS_DEMANDE.some((m) => nue.includes(m))) return phrase.replace(/^[-*>\s]+/, '').trim();
  }
  return null;
}

/** Premier mot du texte qui a declenche une regle, pour le rendre en justificatif. */
function motDeclencheur(texte: string, motif: RegExp): string | null {
  const trouve = motif.exec(texte);
  return trouve ? trouve[0] : null;
}

/**
 * Synthese par regles. Rend toujours un resultat : c'est son interet face a une file IA vide.
 */
export function syntheseParRegles(entree: EntreeSynthese): SortieSynthese {
  const objet = (entree.objet ?? '').trim();
  const corps = entree.corps ?? '';
  const texte = normaliser(`${objet} ${corps}`);
  const justificatifs: string[] = [];

  const motReclamation = motDeclencheur(texte, INDICES_RECLAMATION);
  const motUrgence = motDeclencheur(texte, INDICES_URGENCE);
  const motProcedure = motDeclencheur(texte, INDICES_PROCEDURE);

  // Une reclamation l'emporte : c'est elle qui compte dans le bilan du poste.
  const type: TypeDemande = motReclamation ? 'reclamation' : motUrgence ? 'urgence' : motProcedure ? 'procedure' : 'demande';
  const motType = motReclamation ?? motUrgence ?? motProcedure;
  if (motType) justificatifs.push(motType);

  // La priorite suit l'echeance et la reprise, pas l'humeur du message. Une procedure se range
  // en basse : elle vaut pour la suite, elle ne bloque rien aujourd'hui.
  const priorite: Priorite = motUrgence || motReclamation ? 'haute' : motProcedure ? 'basse' : 'normale';

  // Une cause n'a de sens que sur une reprise, et seulement si le texte la designe.
  let cause: Cause | null = null;
  if (type === 'reclamation') {
    for (const indice of INDICES_CAUSE) {
      const mot = motDeclencheur(texte, indice.motif);
      if (mot) {
        cause = indice.cause;
        justificatifs.push(mot);
        break;
      }
    }
  }

  // L'action : la phrase de demande si le message en porte une, sinon le travail que la famille
  // designe, suivi de l'objet pour savoir de quel dossier il s'agit.
  const phrase = phraseDemande(corps);
  let action: string;
  let confiance: number;
  if (phrase) {
    action = phrase;
    justificatifs.unshift(phrase.slice(0, 120));
    confiance = 0.7;
  } else {
    const repli = (entree.famille && ACTIONS_PAR_FAMILLE[entree.famille]) || 'Traiter la demande';
    action = objet ? `${repli} : ${objet}` : repli;
    // Une action deduite de la seule famille dit le genre de travail, pas le travail : elle est
    // utilisable, mais elle merite d'etre relue, et la routine la remplacera.
    confiance = 0.5;
  }

  return {
    action: action.slice(0, 400),
    type,
    priorite,
    cause: cause && CAUSES.includes(cause) ? cause : null,
    confiance,
    justificatifs: justificatifs.filter(Boolean).slice(0, 3),
  };
}
