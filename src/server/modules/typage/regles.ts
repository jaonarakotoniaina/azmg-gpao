/**
 * Moteur de regles de typage (phase 3, section 10 de CLAUDE.md).
 *
 * Les regles passent **avant** l'IA : elles sont rapides, gratuites, explicables et corrigeables
 * par le manager sans redeploiement. L'IA ne traite que ce qu'aucune regle ne tranche.
 *
 * Une regle porte sur trois signaux, tous facultatifs :
 *  - le **domaine** de l'expediteur (un transitaire connu, une autorite, la DO) ;
 *  - des **mots-cles** cherches dans l'objet, qui compte double, et dans le corps ;
 *  - des **mots d'exclusion**, qui annulent la regle (« pas de newsletter sur un vrai dossier »).
 *
 * La regle la plus prioritaire qui correspond gagne. A priorite egale, celle qui s'appuie sur le
 * plus de signaux l'emporte : un domaine connu plus deux mots-cles bat un seul mot-cle isole.
 */
import type { Interlocuteur, Nature, Sens } from '@shared/constantes';
import { contientExpression, domaineDe, estUneDe, normaliserTypage, texteDuMessage, type MessageAClasser, type Typage } from '@shared/typage';

export interface RegleTypage {
  id?: number;
  libelle: string;
  /** Domaine de l'expediteur. `null` : toute adresse. */
  domaine?: string | null;
  /** Au moins un de ces mots ou expressions doit figurer dans le message. */
  motsCles?: string[];
  /** Tous ces mots doivent figurer, en plus d'un `motsCles`. Sert a lever une ambiguite. */
  motsObligatoires?: string[];
  /** Aucun de ces mots ne doit figurer. */
  motsExclus?: string[];
  /** La regle ne s'applique qu'a ce sens. */
  sens?: Sens | null;
  famille?: string | null;
  nature?: Nature | null;
  interlocuteur?: Interlocuteur | null;
  /** Plus la valeur est basse, plus la regle est prioritaire. */
  priorite: number;
  actif?: boolean;
}

export interface ResultatRegle {
  typage: Typage;
  regle: RegleTypage;
  /** Nombre de signaux qui ont joue : sert a departager deux regles de meme priorite. */
  signaux: number;
}

// ---------------------------------------------------------------------------
// Referentiel initial
// ---------------------------------------------------------------------------

/**
 * Regles livrees avec l'application, tirees des definitions de familles de la section 4.3.
 * Elles sont copiees en base au premier demarrage et modifiables ensuite dans les Parametres.
 *
 * Les priorites s'etagent ainsi :
 *   10 a 19  hors perimetre, qui doit sortir avant tout le reste
 *   20 a 29  signaux tres specifiques (SWIFT, cut-off, legalisation)
 *   30 a 49  familles metier
 *   50 a 69  natures et interlocuteurs, qui completent une famille deja trouvee
 */
export const REGLES_INITIALES: RegleTypage[] = [
  // --- Hors perimetre (T00) : sort du pilotage avant toute autre regle -------
  {
    libelle: 'Message promotionnel ou newsletter',
    motsCles: ['newsletter', 'se desinscrire', 'desinscription', 'unsubscribe', 'promotion', 'offre speciale', 'webinar', 'webinaire', 'ne plus recevoir'],
    famille: 'T00',
    nature: 'information',
    priorite: 10,
  },
  {
    libelle: 'Notification automatique de systeme',
    motsCles: ['no reply', 'noreply', 'ne pas repondre', 'notification automatique', 'message automatique', 'mot de passe', 'votre compte', 'mise a jour de securite'],
    famille: 'T00',
    nature: 'information',
    priorite: 11,
  },
  // --- Familles du poste de designer (D01 a D03) -----------------------------
  // Ce travail etait classe T00 tant qu'un seul poste etait pilote : il etait hors du perimetre
  // de l'assistante export, donc hors de tout. Il a desormais ses familles et son poste.
  {
    libelle: 'Publication sur les reseaux sociaux',
    motsCles: ['publication linkedin', 'post linkedin', 'brouillon linkedin', 'post instagram', 'community manager', 'page linkedin', 'calendrier editorial'],
    famille: 'D01',
    priorite: 12,
  },
  {
    libelle: 'Visuel ou support de communication',
    motsCles: ['maquette', 'visuel', 'charte graphique', 'logo', 'banniere', 'brochure', 'kakemono', 'plv', 'affiche'],
    motsExclus: ['etiquette', 'bat', 'packaging'],
    famille: 'D02',
    priorite: 13,
  },
  {
    libelle: 'Catalogue, fiche produit ou contenu marketing',
    motsCles: ['catalogue produit', 'fiche produit', 'contenu marketing', 'campagne marketing', 'newsletter client', 'plaquette'],
    motsExclus: ['se desinscrire', 'unsubscribe'],
    famille: 'D03',
    priorite: 14,
  },

  // --- Signaux tres specifiques --------------------------------------------
  {
    libelle: 'Paiement, SWIFT ou solde',
    motsCles: ['swift', 'virement', 'solde', 'reglement', 'paiement', 'impaye', 'echeance de paiement', 'avis de credit'],
    famille: 'T04',
    interlocuteur: 'client',
    priorite: 20,
  },
  {
    libelle: 'Cut-off, booking ou cotation fret',
    motsCles: ['cut off', 'cutoff', 'booking', 'cotation', 'fret', 'freight', 'taux de fret', 'lcl', 'fcl', 'etd', 'eta'],
    famille: 'T01',
    interlocuteur: 'transitaire',
    priorite: 21,
  },
  {
    libelle: 'Legalisation et enregistrement reglementaire',
    motsCles: ['legalisation', 'legalise', 'enregistrement du produit', 'fsc', 'gmp', 'certificat de vente libre', 'coc', 'chambre de commerce', 'apostille', 'autorisation de mise sur le marche'],
    famille: 'T05',
    interlocuteur: 'autorite',
    priorite: 22,
  },
  {
    libelle: 'Tracking et transport express',
    motsCles: ['tracking', 'numero de suivi', 'dhl', 'fedex', 'ups', 'surestarie', 'demurrage', 'detention', 'colis'],
    famille: 'T14',
    interlocuteur: 'transporteur',
    priorite: 23,
  },

  // --- Familles metier ------------------------------------------------------
  {
    libelle: 'Documents d’expedition',
    motsCles: ['bl', 'bill of lading', 'awb', 'lettre de transport', 'packing list', 'shipping mark', 'connaissement', 'enlevement', 'empotage', 'chargement'],
    famille: 'T02',
    priorite: 30,
  },
  {
    libelle: 'Proforma, facture et domiciliation',
    motsCles: ['proforma', 'pro forma', 'facture', 'invoice', 'pfi', 'domiciliation', 'pre domiciliation', 'avoir'],
    famille: 'T03',
    priorite: 31,
  },
  {
    libelle: 'Relance de paiement ou de piece manquante',
    motsCles: ['relance', 'rappel', 'piece manquante', 'document manquant', 'sans reponse', 'toujours en attente'],
    famille: 'T04',
    priorite: 32,
  },
  {
    libelle: 'Tableau de situation',
    motsCles: ['tableau de situation', 'point de situation', 'etat des commandes', 'recapitulatif des dossiers', 'situation par pays'],
    famille: 'T06',
    interlocuteur: 'do',
    priorite: 33,
  },
  {
    libelle: 'Qualite : COA, BAT, etiquettes et echantillons',
    motsCles: ['coa', 'certificat d analyse', 'bat', 'bon a tirer', 'etiquette', 'echantillon', 'packaging', 'notice produit'],
    famille: 'T07',
    interlocuteur: 'qualite',
    priorite: 34,
  },
  {
    libelle: 'Lead, catalogue et offre commerciale',
    motsCles: ['nouveau client', 'prospect', 'catalogue', 'liste de prix', 'moq', 'clientify', 'demande de partenariat', 'nouvelle demande commerciale'],
    famille: 'T08',
    interlocuteur: 'prospect',
    priorite: 35,
  },
  {
    libelle: 'Reporting quotidien',
    motsCles: ['rapport quotidien', 'daily', 'compte rendu du jour', 'reporting du jour', 'suivi quotidien'],
    famille: 'T09',
    interlocuteur: 'do',
    priorite: 36,
  },
  {
    libelle: 'Stagiaire : onboarding et evaluation',
    motsCles: ['stagiaire', 'stage', 'onboarding', 'evaluation de stage', 'convention de stage', 'tutorat'],
    famille: 'T10',
    interlocuteur: 'stagiaire',
    priorite: 37,
  },
  {
    libelle: 'Salon professionnel',
    motsCles: ['salon', 'badge', 'exposant', 'stand', 'vitafoods', 'cphi', 'rendez vous sur le salon'],
    famille: 'T11',
    priorite: 38,
  },
  {
    libelle: 'Lettre d’invitation et courrier type',
    motsCles: ['lettre d invitation', 'invitation letter', 'courrier type', 'attestation', 'lettre officielle', 'visa'],
    famille: 'T12',
    priorite: 39,
  },
  {
    libelle: 'Transfert a la DO pour decision',
    motsCles: ['pour decision', 'je te laisse trancher', 'je vous laisse decider', 'a arbitrer', 'besoin de ton arbitrage', 'que decide t on'],
    famille: 'T13',
    interlocuteur: 'do',
    priorite: 40,
  },

  // --- Natures --------------------------------------------------------------
  {
    libelle: 'Demande de validation a la DO',
    motsCles: [
      'merci de valider',
      'pouvez vous valider',
      'peux tu valider',
      'pour validation',
      'ton accord',
      'votre accord',
      'je te soumets',
      'je vous soumets',
      'pour approbation',
      'je te laisse trancher',
      'je vous laisse decider',
      'besoin de ton arbitrage',
      'je ne peux pas decider',
    ],
    sens: 'sortant',
    nature: 'demande_validation_do',
    interlocuteur: 'do',
    priorite: 50,
  },
  {
    libelle: 'Validation de la DO',
    motsCles: ['je valide', 'c est valide', 'd accord pour', 'ok pour', 'tu peux y aller', 'vous pouvez proceder', 'bon pour accord'],
    sens: 'entrant',
    nature: 'validation_do',
    interlocuteur: 'do',
    priorite: 51,
  },
  {
    libelle: 'Refus de la DO',
    motsCles: ['je ne valide pas', 'ne pas envoyer', 'on ne fait pas', 'refuse', 'a revoir', 'ne convient pas'],
    sens: 'entrant',
    nature: 'refus_do',
    interlocuteur: 'do',
    priorite: 52,
  },
  {
    libelle: 'Consigne de la DO',
    motsCles: ['merci de preparer', 'peux tu preparer', 'il faut faire', 'je te demande de', 'tu dois', 'prepare', 'lance la procedure', 'occupe toi de'],
    sens: 'entrant',
    nature: 'consigne_do',
    interlocuteur: 'do',
    priorite: 53,
  },
  {
    libelle: 'Envoi de livrable',
    motsCles: ['veuillez trouver ci joint', 'ci joint', 'en piece jointe', 'je vous transmets', 'je t envoie', 'voici le document', 'please find attached'],
    sens: 'sortant',
    nature: 'envoi_livrable',
    priorite: 54,
  },
  {
    libelle: 'Relance emise',
    motsCles: ['relance', 'je me permets de revenir', 'sans retour de votre part', 'pour rappel', 'je reviens vers vous'],
    sens: 'sortant',
    nature: 'relance_emise',
    priorite: 55,
  },
  {
    libelle: 'Reponse du tiers',
    motsCles: ['suite a votre demande', 'en reponse a', 'voici notre offre', 'notre proposition', 'comme convenu'],
    sens: 'entrant',
    nature: 'reponse_tiers',
    priorite: 57,
  },
  {
    libelle: 'Information explicitement annoncee',
    motsCles: ['pour information', 'pour info', 'a titre informatif', 'je vous informe', 'je t informe'],
    nature: 'information',
    priorite: 45,
  },
  {
    libelle: 'Relance recue',
    motsCles: ['toujours sans reponse', 'nous attendons toujours', 'sans retour de votre part', 'nous relancons', 'ou en est', 'ou en sont'],
    sens: 'entrant',
    nature: 'relance_recue',
    priorite: 46,
  },
  {
    libelle: 'Demande entrante',
    motsCles: [
      'pourriez vous',
      'pouvez vous nous',
      'pouvez vous me',
      'merci de nous faire parvenir',
      'nous souhaitons recevoir',
      'souhaitons recevoir',
      'auriez vous',
      'serait il possible',
      'je vous demande',
      'nous aurions besoin',
      'nous avons besoin',
      'merci de me renvoyer',
      'pourriez vous me',
      'demande de',
    ],
    sens: 'entrant',
    nature: 'demande_entrante',
    priorite: 48,
  },
  {
    libelle: 'Reponse d\u2019un tiers qui joint une piece',
    motsCles: ['veuillez trouver ci joint', 'ci joint', 'en piece jointe', 'je vous transmets', 'voici', 'nous confirmons', 'please find attached'],
    sens: 'entrant',
    nature: 'reponse_tiers',
    priorite: 57,
  },
  {
    libelle: 'Accuse de reception ou information',
    motsCles: ['bien recu', 'bien note', 'merci pour votre message', 'accuse de reception', 'pour information', 'pour info'],
    nature: 'information',
    priorite: 58,
  },

  // --- Interlocuteurs -------------------------------------------------------
  {
    libelle: 'Interlocuteur transitaire',
    motsCles: ['transitaire', 'forwarder', 'agence maritime', 'consignataire', 'commissionnaire de transport'],
    interlocuteur: 'transitaire',
    priorite: 60,
  },
  {
    libelle: 'Interlocuteur fournisseur',
    motsCles: ['fournisseur', 'notre usine', 'production', 'approvisionnement', 'bon de commande fournisseur'],
    interlocuteur: 'fournisseur',
    priorite: 61,
  },
  {
    libelle: 'Interlocuteur Qualite',
    motsCles: ['service qualite', 'assurance qualite', 'responsable qualite', 'controle qualite'],
    interlocuteur: 'qualite',
    priorite: 62,
  },
];

// ---------------------------------------------------------------------------
// Moteur
// ---------------------------------------------------------------------------

/** Nombre de signaux d'une regle qui correspondent reellement au message. */
function evaluerRegle(regle: RegleTypage, message: MessageAClasser, texte: string, domaine: string | null): number | null {
  if (regle.actif === false) return null;
  if (regle.sens && message.sens && regle.sens !== message.sens) return null;
  // Une regle qui impose un sens ne s'applique pas a un message de sens inconnu.
  if (regle.sens && !message.sens) return null;

  let signaux = 0;

  if (regle.domaine) {
    if (!domaine || !domaine.endsWith(regle.domaine.toLowerCase())) return null;
    signaux++;
  }

  if (regle.motsExclus?.length && regle.motsExclus.some((m) => contientExpression(texte, m))) return null;

  if (regle.motsObligatoires?.length) {
    if (!regle.motsObligatoires.every((m) => contientExpression(texte, m))) return null;
    signaux += regle.motsObligatoires.length;
  }

  if (regle.motsCles?.length) {
    const trouves = regle.motsCles.filter((m) => contientExpression(texte, m)).length;
    if (!trouves) return null;
    signaux += trouves;
  }

  // Une regle sans aucun signal ne classe rien.
  return signaux > 0 ? signaux : null;
}

/**
 * Applique le jeu de regles a un message.
 *
 * Les regles sont cumulatives : la premiere qui donne une famille la fixe, la premiere qui donne
 * une nature la fixe, et ainsi de suite. Une regle de famille n'ecrase donc pas la nature trouvee
 * par une regle plus prioritaire, et inversement. C'est ce qui permet d'ecrire des regles courtes
 * et independantes plutot qu'une regle par combinaison.
 */
export function appliquerRegles(message: MessageAClasser, regles: RegleTypage[] = REGLES_INITIALES): ResultatRegle | null {
  const texte = texteDuMessage(message);
  if (!texte) return null;
  const domaine = domaineDe(message.expediteur);

  const correspondances = regles
    .map((regle) => ({ regle, signaux: evaluerRegle(regle, message, texte, domaine) }))
    .filter((c): c is { regle: RegleTypage; signaux: number } => c.signaux !== null)
    .sort((a, b) => a.regle.priorite - b.regle.priorite || b.signaux - a.signaux);

  if (!correspondances.length) return null;

  const typage: Typage = {
    famille: null,
    nature: null,
    interlocuteur: null,
    sens: message.sens ?? null,
    confiance: 0,
    justificatifs: [],
    origine: 'regle',
    regleId: null,
  };

  const appliquees: { regle: RegleTypage; signaux: number }[] = [];
  for (const { regle, signaux } of correspondances) {
    let utile = false;
    if (typage.famille === null && regle.famille) {
      typage.famille = regle.famille;
      utile = true;
    }
    if (typage.nature === null && regle.nature) {
      typage.nature = regle.nature;
      utile = true;
    }
    if (typage.interlocuteur === null && regle.interlocuteur) {
      typage.interlocuteur = regle.interlocuteur;
      utile = true;
    }
    if (utile) appliquees.push({ regle, signaux });
    if (typage.famille && typage.nature && typage.interlocuteur) break;
  }

  if (!appliquees.length) return null;

  const principale = appliquees[0];
  typage.regleId = principale.regle.id ?? null;
  typage.justificatifs = appliquees.map((a) => a.regle.libelle);

  // Les deductions par defaut s'ajoutent apres les regles, et seulement apres : elles doivent
  // rester visibles dans les justificatifs, car c'est ce qui fait baisser la confiance.
  completerParDefaut(typage, message);

  typage.confiance = confianceRegles(typage, appliquees);

  return { typage, regle: principale.regle, signaux: principale.signaux };
}

/**
 * Complete un typage partiel par les deductions les plus sures, quand aucune regle n'a tranche.
 *
 * Deux deductions seulement, parce qu'elles sont vraies par construction du referentiel :
 *  - une validation, un refus ou une demande de validation sans famille identifiee releve du
 *    transfert a la DO pour decision (T13), qui est precisement la famille de ces echanges ;
 *  - un message sortant qui ne releve d'aucune nature connue est un envoi, un message entrant
 *    est une information. C'est le comportement par defaut le moins faux, et il baisse la
 *    confiance pour que le cas passe sous le seuil s'il est isole.
 */
/**
 * Reconnait la donneuse d'ordre a son adresse.
 *
 * Les regles ne savent la reconnaitre qu'au domaine de l'expediteur. Or la DO partage souvent son
 * domaine avec le poste (une boite « export » et une boite « info » chez le meme client) : seule
 * l'adresse exacte les distingue. Ce signal est deterministe, il passe donc avant les mots-cles.
 */
function deduireInterlocuteur(typage: Typage, message: MessageAClasser) {
  if (typage.interlocuteur || !message.adresseDo) return;
  if (estUneDe(message.expediteur, [message.adresseDo])) {
    typage.interlocuteur = 'do';
    typage.justificatifs.push('message recu de l’adresse de la donneuse d’ordre');
    return;
  }
  if (message.destinataires?.some((d) => estUneDe(d, [message.adresseDo!]))) {
    typage.interlocuteur = 'do';
    typage.justificatifs.push('message adresse a la donneuse d’ordre');
  }
}

function completerParDefaut(typage: Typage, message: MessageAClasser) {
  deduireInterlocuteur(typage, message);
  if (!typage.famille && typage.nature && ['validation_do', 'refus_do', 'demande_validation_do'].includes(typage.nature)) {
    typage.famille = 'T13';
    typage.justificatifs.push('decision attendue de la DO, sans autre famille identifiee');
  }
  if (!typage.nature && message.sens) {
    if (message.sens === 'sortant' && typage.interlocuteur === 'do') {
      // Un envoi a la DO attend une decision : la demande doit passer « En attente DO », pas
      // « en attente du destinataire ». C'est ce qui alimente le digest de validation.
      typage.nature = 'demande_validation_do';
      typage.justificatifs.push('envoi a la donneuse d’ordre, decision attendue');
    } else {
      typage.nature = message.sens === 'sortant' ? 'envoi_livrable' : 'information';
      typage.justificatifs.push(`nature deduite du sens « ${message.sens} »`);
    }
  }
}

/**
 * Confiance d'un typage par regles.
 *
 * Elle part de ce qui a ete trouve (famille et nature valent plus que l'interlocuteur seul) et
 * monte avec le nombre de signaux. Un classement partiel reste volontairement sous le seuil de
 * 0,8 : mieux vaut faire relire un demi-classement que l'appliquer en silence.
 */
function confianceRegles(typage: Typage, appliquees: { regle: RegleTypage; signaux: number }[]): number {
  const signaux = appliquees.reduce((s, a) => s + a.signaux, 0);
  const parDefaut = typage.justificatifs.filter((j) => j.startsWith('nature deduite') || j.startsWith('decision attendue')).length;
  let base = 0.4;
  if (typage.famille) base += 0.25;
  if (typage.nature) base += 0.2;
  if (typage.interlocuteur) base += 0.05;
  // Une deduction par defaut vaut moins qu'une regle : le cas doit pouvoir passer sous le seuil.
  base -= parDefaut * 0.12;
  // Chaque signal supplementaire au-dela du premier ajoute un peu de certitude, plafonnee.
  const bonus = Math.min(0.15, Math.max(0, signaux - 1) * 0.05);
  // Le hors perimetre est une decision tranchee : un seul signal suffit a l'ecarter du pilotage.
  if (typage.famille === 'T00') return Math.min(0.95, 0.85 + bonus);
  return Math.round(Math.min(0.95, base + bonus) * 100) / 100;
}

export { normaliserTypage };
