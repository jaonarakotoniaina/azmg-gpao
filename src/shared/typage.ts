/**
 * Primitives de typage partagees front et back.
 *
 * Le typage repond a quatre questions sur un evenement : quel sens, quelle famille, quelle nature,
 * quel interlocuteur. Le moteur de regles (phase 3) et la tache IA `typer_evenement` produisent
 * tous deux ce meme resultat, avec un indice de confiance qui decide de la suite : au-dessus du
 * seuil, le typage s'applique ; en dessous, l'evenement part dans la file « A classer ».
 */
import type { Interlocuteur, Nature, Sens } from './constantes';

export interface Typage {
  famille: string | null;
  nature: Nature | null;
  interlocuteur: Interlocuteur | null;
  sens: Sens | null;
  /** Entre 0 et 1. Sous le seuil des parametres, l'evenement attend un humain. */
  confiance: number;
  /** Extraits du texte qui justifient le classement. Jamais une appreciation sur le collaborateur. */
  justificatifs: string[];
  /** Ce qui a produit ce typage, pour pouvoir l'expliquer et le corriger. */
  origine: 'regle' | 'ia' | 'humain' | 'defaut';
  /** Identifiant de la regle appliquee, quand l'origine est « regle ». */
  regleId?: number | null;
}

/** Texte a classer : ce qu'on connait d'un message avant de le typer. */
export interface MessageAClasser {
  objet?: string | null;
  corps?: string | null;
  /** Adresse complete de l'expediteur, ou seulement son domaine. */
  expediteur?: string | null;
  destinataires?: string[];
  sens?: Sens | null;
  /**
   * Adresses depuis lesquelles le poste ecrit. Le poste travaille souvent depuis une adresse du
   * client (par exemple la boite « info »), sur le meme domaine que la donneuse d'ordre : le
   * domaine ne suffit donc pas a dire si un message part ou arrive.
   */
  adressesPoste?: string[];
  /** Adresse de la donneuse d'ordre, seul signal fiable pour la reconnaitre sur ce domaine. */
  adresseDo?: string | null;
  /** Domaines internes a AZMG, pour reconnaitre un encadrant qui ecrit au poste. */
  domainesInternes?: string[];
}

/** Domaines internes retenus a defaut d'indication, l'application etant celle d'AZMG. */
export const DOMAINES_INTERNES_PAR_DEFAUT = ['azmg-solutions.com'];

/** Adresse email seule, en minuscules, sans le nom d'affichage ni les chevrons. */
export function adresseNue(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const m = /<([^>]+)>/.exec(brut);
  const candidat = (m ? m[1] : brut).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidat) ? candidat : null;
}

/** Vrai si `brut` designe l'une des adresses de `liste`, quelle que soit la mise en forme. */
export function estUneDe(brut: string | null | undefined, liste: readonly string[] | null | undefined): boolean {
  const adresse = adresseNue(brut);
  if (!adresse || !liste?.length) return false;
  return liste.some((a) => adresseNue(a) === adresse);
}

/** Minuscules sans accents, ponctuation reduite a des espaces : base de toute comparaison. */
export function normaliserTypage(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    // Le point n'est conserve que s'il relie deux caracteres, c'est-a-dire dans un nom de
    // domaine. Un point de fin de phrase devient un espace : sans cela, « en piece jointe. »
    // ne serait jamais reconnu, et tout mot-cle place en fin de phrase passerait a travers.
    .replace(/\.(?![a-z0-9])/g, ' ')
    .replace(/(?<![a-z0-9])\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parties locales d'adresse qui disent qu'une machine a ecrit, et qu'on ne peut pas lui repondre.
 *
 * La liste est volontairement courte et sans ambiguite. Un expediteur comme `notification@` ou
 * `tracking@` en est absent exprès : un avis de transporteur est un vrai signal sur un dossier
 * reel, et le classer hors perimetre cacherait du travail. Mieux vaut laisser passer du bruit que
 * faire disparaitre une demande.
 */
const PARTIES_AUTOMATIQUES = [
  'no-reply',
  'noreply',
  'no_reply',
  'noreplay',
  'noresponder',
  'no-responder',
  'donotreply',
  'do-not-reply',
  'do_not_reply',
  'nepasrepondre',
  'ne-pas-repondre',
  'mailer-daemon',
  'maildaemon',
  'postmaster',
  'bounce',
  'bounces',
];

/**
 * Vrai quand l'adresse est celle d'un automate qui n'attend pas de reponse.
 *
 * Ce signal est structurel, pas metier : une boite a laquelle on ne peut pas repondre n'emet pas
 * une demande de travail. Il vaut pour tous les comptes clients et ne se parametre pas, a la
 * difference d'une regle de domaine, qui elle est propre a un compte et se saisit dans Parametres.
 */
export function estExpediteurAutomatique(adresse: string | null | undefined): boolean {
  if (!adresse) return false;
  const partieLocale = adresse.trim().toLowerCase().split('@')[0];
  if (!partieLocale) return false;
  // La comparaison ignore les separateurs : « no.reply » et « no-reply » sont la meme chose.
  const nue = partieLocale.replace(/[._-]/g, '');
  return PARTIES_AUTOMATIQUES.some((p) => nue === p.replace(/[._-]/g, '') || nue.startsWith(`${p.replace(/[._-]/g, '')}`));
}

/** Domaine d'une adresse email, en minuscules. Renvoie null si l'entree n'en contient pas. */
export function domaineDe(adresse: string | null | undefined): string | null {
  if (!adresse) return null;
  const m = /@([a-z0-9.-]+\.[a-z]{2,})/i.exec(adresse.trim());
  if (m) return m[1].toLowerCase();
  // L'entree peut deja etre un domaine nu.
  const nu = adresse.trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(nu) ? nu : null;
}

/**
 * Vrai si l'expression figure dans le texte normalise, sur des mots entiers.
 *
 * Une expression de plusieurs mots est cherchee telle quelle, ce qui evite qu'« en attente »
 * reconnaisse « attente » isole. Chaque mot tolere un pluriel francais : « cotation » reconnait
 * « cotations », « surestarie » reconnait « surestaries », sans qu'il faille ecrire les deux
 * formes dans chaque regle.
 */
export function contientExpression(texteNormalise: string, expression: string): boolean {
  const cible = normaliserTypage(expression);
  if (!cible) return false;
  const motif = cible
    .split(' ')
    .map((mot) => {
      const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Un mot d'au moins quatre lettres accepte un « s » ou un « x » final facultatif.
      return mot.length >= 4 && /[a-z]$/.test(mot) ? `${echappe}[sx]?` : echappe;
    })
    .join(' ');
  return new RegExp(`(^| )${motif}( |$)`).test(texteNormalise);
}

/** Texte normalise d'un message : objet puis corps, l'objet compte double a la recherche. */
export function texteDuMessage(message: MessageAClasser): string {
  const objet = normaliserTypage(message.objet ?? '');
  const corps = normaliserTypage(message.corps ?? '');
  return `${objet} ${objet} ${corps}`.trim();
}
