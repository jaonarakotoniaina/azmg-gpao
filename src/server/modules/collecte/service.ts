/**
 * Transformation d'un mail collecte en evenement de la GPAO.
 *
 * Trois invariants, qui sont les criteres de la phase 4 :
 *  1. **Un fil importe deux fois ne cree aucun doublon.** Le dedoublonnage se fait sur
 *     l'identifiant RFC 5322 du message, pose en index unique sur `evenements`.
 *  2. **Le rattachement suit le fil.** Une reponse rejoint la demande ouverte par la tete du fil,
 *     ce qui fait qu'un mail sortant de demande de validation passe la demande en attente DO, et
 *     que la reponse de la DO la fait repasser en cours, sans aucune saisie.
 *  3. **L'horodatage d'origine est conserve.** Les delais se comptent sur la date du message, pas
 *     sur celle de la collecte, sans quoi un relevage en retard fausserait tous les indicateurs.
 */
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { journal, messageErreur } from '../../lib/journal';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { extensionAcceptee, rangerFichier } from '../../lib/stockage';
import { ajouterEvenement } from '../evenements/service';
import { trouverOuCreerDossier } from '../dossiers/service';
import { typerMessage } from '../typage/service';
import { synthetiserDemande, type Synthese } from '../typage/synthese';
import { partieUtile } from '../../adapters/collecte-mail';
import type { MessageCollecte } from '../../adapters/collecte-mail';
import { domaineDe, estUneDe } from '@shared/typage';
import { estHorsPerimetre, type Nature, type Sens } from '@shared/constantes';
import { lireParametres } from '../../lib/parametres';
import type { Auteur } from '../demandes/service';

/** Taille maximale d'une piece jointe conservee. Au-dela, seule sa reference est gardee. */
const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

export interface BilanCollecte {
  lus: number;
  crees: number;
  /** Demandes dont l'action attendue, le type et la priorite ont ete remplis par la synthese. */
  synthetisees: number;
  /** Messages deja connus : le dedoublonnage a joue. */
  doublons: number;
  /** Messages ecartes avant tout traitement : adresses du compte a ne pas suivre. */
  ignores: number;
  horsPerimetre: number;
  aClasser: number;
  piecesRangees: number;
  erreurs: { messageId: string; raison: string }[];
}

export function bilanVide(): BilanCollecte {
  return { lus: 0, crees: 0, synthetisees: 0, doublons: 0, ignores: 0, horsPerimetre: 0, aClasser: 0, piecesRangees: 0, erreurs: [] };
}

/**
 * Sens d'un message vu du poste : sortant si le poste en est l'expediteur, entrant sinon.
 * Les adresses du poste sont celles du domaine d'AZMG-Solutions.
 */
/**
 * Sens d'un message : part-il du poste, ou lui arrive-t-il ?
 *
 * L'adresse exacte passe avant le domaine, et c'est essentiel : le poste ecrit depuis une adresse
 * du client (par exemple la boite « info »), sur **le meme domaine que la donneuse d'ordre**. Un
 * test au domaine seul lirait tout ce que le poste envoie comme du courrier recu, et plus aucune
 * demande de validation ne passerait « En attente DO ».
 */
export function sensDuMessage(message: MessageCollecte, config: { adressesPoste?: string[]; domainesInternes?: string[] }): Sens {
  if (estUneDe(message.expediteur, config.adressesPoste)) return 'sortant';
  // Une adresse du poste parmi les destinataires designe un message qui lui arrive, meme si
  // l'expediteur appartient par ailleurs a un domaine interne.
  if (message.destinataires?.some((d) => estUneDe(d, config.adressesPoste))) return 'entrant';
  const domaine = domaineDe(message.expediteur);
  if (domaine && (config.domainesInternes ?? []).some((d) => domaine.endsWith(d))) return 'sortant';
  return 'entrant';
}

/** Natures qui appellent un travail : ailleurs, il n'y a pas d'action a degager. */
const NATURES_A_SYNTHETISER = new Set(['demande_entrante', 'consigne_do', 'relance_recue', 'refus_do']);

export interface PosteConnu {
  id: number;
  intitule: string;
  adresses: string[];
  familles: string[];
}

export interface ConfigCollecte {
  /** Postes du compte, avec leurs adresses et leur perimetre de familles. */
  postes: PosteConnu[];
  /** Toutes les adresses de tous les postes du compte, pour deduire le sens. */
  adressesPoste: string[];
  adresseDo: string | null;
  /** Adresses du client a ne pas suivre, par exemple une boite commerciale. */
  adressesIgnorees: string[];
}

/**
 * Vrai si le message ne concerne que des adresses a ne pas suivre.
 *
 * Le test est volontairement prudent : il suffit qu'une adresse d'un poste figure parmi
 * l'expediteur ou les destinataires pour que le message soit collecte. Un mail adresse a la fois
 * a la boite commerciale et au poste reste donc du travail du poste.
 */
export function estIgnore(message: MessageCollecte, config: { adressesPoste: string[]; adressesIgnorees: string[] }): boolean {
  if (!config.adressesIgnorees.length) return false;
  const correspondants = [message.expediteur, ...(message.destinataires ?? [])];
  if (correspondants.some((a) => estUneDe(a, config.adressesPoste))) return false;
  return correspondants.some((a) => estUneDe(a, config.adressesIgnorees));
}

/**
 * Verifie qu'un compte peut recevoir une collecte, avant de toucher au moindre message.
 *
 * Sans ce controle, un identifiant de compte errone dans le script faisait echouer chaque message
 * un par un : les erreurs partaient dans le bilan, le webhook repondait tout de meme en succes, et
 * le script posait son etiquette « traite » sur des fils dont rien n'avait ete enregistre. Les
 * mails etaient consommes et perdus, sans reprise possible. Un refus franc laisse le script
 * reessayer au passage suivant, puisqu'il n'etiquette qu'en cas de succes.
 */
export async function exigerCompteCollecte(compteId: number): Promise<void> {
  const [compte] = await db
    .select({ actif: schema.comptesClients.actif })
    .from(schema.comptesClients)
    .where(eq(schema.comptesClients.id, compteId));
  if (!compte || !compte.actif) {
    throw new ErreurHttp(404, `Compte client ${compteId} inconnu ou inactif. Verifier COMPTE_ID dans le script Apps Script.`);
  }
}

/** Configuration d'un compte utile a la collecte : ses postes, et qui est la donneuse d'ordre. */
export async function configDuCompte(compteId: number): Promise<ConfigCollecte> {
  const [compte] = await db
    .select({
      donneurOrdreEmail: schema.comptesClients.donneurOrdreEmail,
      adressesIgnorees: schema.comptesClients.adressesIgnorees,
    })
    .from(schema.comptesClients)
    .where(eq(schema.comptesClients.id, compteId));

  const lignes = await db
    .select({
      id: schema.postes.id,
      intitule: schema.postes.intitule,
      adresses: schema.postes.adresses,
      familles: schema.postes.familles,
    })
    .from(schema.postes)
    .where(and(eq(schema.postes.compteId, compteId), eq(schema.postes.actif, true)));

  const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const postes: PosteConnu[] = lignes.map((l) => ({
    id: l.id,
    intitule: l.intitule,
    adresses: chaines(l.adresses),
    familles: chaines(l.familles),
  }));

  return {
    postes,
    adressesPoste: postes.flatMap((p) => p.adresses),
    adresseDo: compte?.donneurOrdreEmail ?? null,
    adressesIgnorees: chaines(compte?.adressesIgnorees),
  };
}

/**
 * Poste auquel un message appartient, quand le compte en porte plusieurs.
 *
 * L'adresse passe avant la famille : une adresse est un fait, une famille est un typage qui peut
 * se tromper. A defaut d'adresse, la famille tranche, ce qui rattrape un message venu d'un tiers
 * et adresse a une boite generique du client.
 */
export function posteDuMessage(message: MessageCollecte, postes: PosteConnu[], famille: string | null): number | null {
  if (!postes.length) return null;
  if (postes.length === 1) return postes[0].id;

  const parExpediteur = postes.find((p) => estUneDe(message.expediteur, p.adresses));
  if (parExpediteur) return parExpediteur.id;

  const parDestinataire = postes.find((p) => message.destinataires?.some((d) => estUneDe(d, p.adresses)));
  if (parDestinataire) return parDestinataire.id;

  if (famille) {
    const parFamille = postes.filter((p) => p.familles.includes(famille));
    // Une famille partagee par plusieurs postes (le reporting quotidien, par exemple) ne designe
    // personne : mieux vaut laisser le rattachement a la main que de choisir au hasard.
    if (parFamille.length === 1) return parFamille[0].id;
  }
  return null;
}

/** Objet debarrasse des prefixes de reponse et de transfert, pour comparer deux messages d'un fil. */
export function objetNormalise(objet: string): string {
  return objet.replace(/^((re|re\s*:|rep|tr|fw|fwd|transf)\s*:\s*)+/i, '').trim();
}

/**
 * Demande a rattacher a un message, d'apres son fil.
 * On cherche un evenement deja enregistre portant le meme `filId` et rattache a une demande.
 */
export async function demandeDuFil(filId: string, compteId: number): Promise<{ demandeId: number; dossierId: number } | null> {
  const [ligne] = await db
    .select({ demandeId: schema.evenements.demandeId, dossierId: schema.evenements.dossierId })
    .from(schema.evenements)
    .where(and(eq(schema.evenements.filId, filId), eq(schema.evenements.compteId, compteId), isNotNull(schema.evenements.demandeId)))
    .orderBy(desc(schema.evenements.survenuLe))
    .limit(1);
  if (!ligne?.demandeId || !ligne.dossierId) return null;
  return { demandeId: ligne.demandeId, dossierId: ligne.dossierId };
}

export interface OptionsCollecte {
  compteId: number;
  posteId?: number | null;
  /** Dossier de rattachement par defaut, quand le fil est inconnu. */
  dossierParDefautId?: number | null;
  /** Domaines consideres comme internes, pour deduire le sens quand aucune adresse ne tranche. */
  domainesInternes?: string[];
  /** Config du compte, chargee une fois par lot plutot qu'a chaque message. */
  config?: ConfigCollecte;
  source?: 'mail' | 'import';
}

/**
 * Enregistre un message collecte.
 *
 * Renvoie `null` si le message etait deja connu : c'est le cas nominal d'un second passage de la
 * collecte, pas une erreur.
 */
export async function enregistrerMessage(
  message: MessageCollecte,
  opts: OptionsCollecte,
  auteur: Auteur,
): Promise<
  | { ignore: true }
  | {
      ignore?: false;
      evenementId: number;
      demandeId: number | null;
      horsPerimetre: boolean;
      aClasser: boolean;
      /** Vrai quand la synthese a rempli l'action attendue, le type et la priorite. */
      synthetisee: boolean;
      pieces: number;
    }
  | null
> {
  // 1. Dedoublonnage : un identifiant deja connu ne cree rien.
  const [deja] = await db.select({ id: schema.evenements.id }).from(schema.evenements).where(eq(schema.evenements.messageId, message.messageId));
  if (deja) return null;

  const config = opts.config ?? (await configDuCompte(opts.compteId));
  // Ecarte avant tout traitement : pas de typage, pas de dossier, pas de trace a lire.
  if (estIgnore(message, config)) return { ignore: true as const };
  const domainesInternes = opts.domainesInternes ?? ['azmg-solutions.com'];
  const sens = sensDuMessage(message, { adressesPoste: config.adressesPoste, domainesInternes });

  // 2. Typage : il donne la famille, la nature et l'interlocuteur. Les adresses du compte lui
  // permettent de reconnaitre la donneuse d'ordre, ce que les mots-cles ne peuvent pas faire
  // quand elle partage son domaine avec le poste.
  const typage = await typerMessage(
    {
      objet: message.objet,
      corps: message.corps,
      expediteur: message.expediteur,
      destinataires: message.destinataires,
      sens,
      adressesPoste: config.adressesPoste,
      adresseDo: config.adresseDo,
    },
    { compteId: opts.compteId },
  );
  const horsPerimetre = estHorsPerimetre(typage.typage.famille);

  // 3. Poste concerne : un compte peut porter plusieurs postes (assistante export, designer).
  const posteId = opts.posteId ?? posteDuMessage(message, config.postes, typage.applicable ? typage.typage.famille : null);

  // 4. Rattachement : le fil d'abord, le dossier par defaut ensuite.
  const parFil = horsPerimetre ? null : await demandeDuFil(message.filId, opts.compteId);
  let dossierId = parFil?.dossierId ?? opts.dossierParDefautId ?? null;

  if (!dossierId) {
    // Sans fil connu ni dossier indique, on ouvre un dossier de rattachement par interlocuteur.
    // Il sera reclasse a la main : mieux vaut un dossier a corriger qu'un message perdu.
    const client = message.expediteur ? message.expediteur.split('@')[0] : 'Expediteur inconnu';
    const { dossier } = await trouverOuCreerDossier(
      { compteId: opts.compteId, posteId, client, produit: null, operation: null, notes: 'Dossier ouvert automatiquement par la collecte des mails, a reclasser.' },
      auteur,
    );
    dossierId = dossier.id;
  }

  // 5. Pieces jointes : rangees hors du dossier public, referencees dans le dossier.
  const piecesRangees: { chemin: string; nomFichier: string; taille: number; empreinte: string }[] = [];
  for (const piece of message.pieces) {
    if (!extensionAcceptee(piece.nomFichier) || piece.contenu.length > TAILLE_MAX_PIECE) continue;
    try {
      const range = await rangerFichier(piece.contenu, piece.nomFichier);
      piecesRangees.push({ chemin: range.chemin, nomFichier: piece.nomFichier, taille: range.tailleOctets, empreinte: range.empreinte });
    } catch (e) {
      journal.warn('Piece jointe non rangee', { erreur: messageErreur(e) });
    }
  }

  // 6. Enregistrement. La nature vient du typage ; sans elle, le message est une information.
  const resultat = await ajouterEvenement(
    {
      demandeId: parFil?.demandeId ?? null,
      dossierId,
      sens,
      nature: (typage.applicable ? typage.typage.nature : null) ?? ('information' as Nature),
      famille: typage.applicable ? typage.typage.famille : null,
      interlocuteur: typage.applicable ? typage.typage.interlocuteur : null,
      source: opts.source ?? 'mail',
      filId: message.filId,
      messageId: message.messageId,
      lienExterne: lienDuMessage(message),
      expediteur: message.expediteur,
      destinataires: message.destinataires,
      survenuLe: message.survenuLe,
      objet: message.objet,
      resume: partieUtile(message.corps).slice(0, 500),
      contenu: message.corps.slice(0, 50_000),
      confianceTypage: typage.typage.confiance,
      justificatifs: typage.typage.justificatifs,
    },
    auteur,
  );

  for (const piece of piecesRangees) {
    await db.insert(schema.pieces).values({
      dossierId,
      demandeId: resultat.demande?.id ?? null,
      evenementId: resultat.evenement.id,
      type: 'piece jointe',
      nomFichier: piece.nomFichier,
      chemin: piece.chemin,
      tailleOctets: piece.taille,
      empreinte: piece.empreinte,
    });
  }

  // 7. Synthese manageriale : l'action qui debloque, le type, la priorite, la cause.
  //
  // C'est ce qui rend le classeur de suivi inutile. Elle vient apres l'enregistrement, parce
  // qu'elle a besoin de l'identifiant de la demande : c'est par lui que la routine IA retrouvera
  // la ligne a corriger quand elle repondra, plus tard, en remplacement des regles.
  //
  // Elle n'est demandee que pour un message entrant qui appelle un travail, et seulement pour une
  // demande que ce message vient de creer : elle ne touche jamais a ce qu'un humain a pose.
  let synthese: Synthese | null = null;
  if (
    sens === 'entrant' &&
    typage.applicable &&
    NATURES_A_SYNTHETISER.has(typage.typage.nature ?? '') &&
    resultat.demande &&
    resultat.demandeCreee
  ) {
    synthese = await synthetiserDemande(
      { objet: message.objet, corps: message.corps, expediteur: message.expediteur, destinataires: message.destinataires, famille: typage.typage.famille },
      { compteId: opts.compteId, demandeId: resultat.demande.id },
    );
    if (synthese?.applicable) {
      await db
        .update(schema.demandes)
        .set({
          objet: synthese.action,
          priorite: synthese.priorite,
          reprise: synthese.reprise,
          cause: synthese.cause,
          suivi: {
            action: synthese.action,
            type: synthese.type,
            demande: partieUtile(message.corps).slice(0, 2000),
            lienMail: lienDuMessage(message),
            // `regles` dit que la routine n'a pas encore repondu : elle pourra remplacer ces
            // colonnes. `synthese_ia` dit qu'elle l'a fait, et rien ne les remplacera plus.
            origine: synthese.origine === 'ia' ? 'synthese_ia' : 'regles',
            confiance: synthese.confiance,
            justificatifs: synthese.justificatifs,
          },
          majLe: new Date(),
        })
        .where(eq(schema.demandes.id, resultat.demande.id));
    }
  }

  return {
    evenementId: resultat.evenement.id,
    demandeId: resultat.demande?.id ?? null,
    horsPerimetre,
    aClasser: !typage.applicable,
    synthetisee: Boolean(synthese?.applicable),
    pieces: piecesRangees.length,
  };
}

/**
 * Lien Gmail vers un message, construit a partir de son identifiant.
 *
 * Il n'ouvre la bonne boite que pour qui y a acces : c'est un raccourci de lecture, pas une
 * source de verite. Le contenu du message est deja dans la GPAO.
 */
export function lienGmail(messageId: string): string {
  const nu = messageId.replace(/^<|>$/g, '').split('@')[0];
  return /^[a-f0-9]{8,}$/i.test(nu) ? `https://mail.google.com/mail/u/0/#all/${nu}` : '';
}

/**
 * Lien de retour vers le mail d'origine.
 *
 * Le lien donne par la source fait foi : seul le script installe sur la boite connait
 * l'identifiant interne de Gmail. A defaut, on tente de le deduire de l'identifiant RFC 5322,
 * ce qui ne marche que pour un message compose dans Gmail. Sinon, pas de lien : une adresse
 * fausse coute plus cher qu'une absence de lien.
 */
export function lienDuMessage(message: Pick<MessageCollecte, 'messageId' | 'lienExterne'>): string {
  return message.lienExterne || lienGmail(message.messageId);
}

/** Enregistre un lot de messages et rend le bilan. */
export async function enregistrerLot(messages: MessageCollecte[], opts: OptionsCollecte, auteur: Auteur): Promise<BilanCollecte> {
  const bilan = bilanVide();
  // Les messages sont traites du plus ancien au plus recent : un fil se construit dans l'ordre,
  // sans quoi une reponse arriverait avant la demande qu'elle fait avancer.
  const ordonnes = [...messages].sort((a, b) => a.survenuLe.getTime() - b.survenuLe.getTime());
  // La config du compte est la meme pour tout le lot : une lecture, pas une par message.
  const config = opts.config ?? (await configDuCompte(opts.compteId));

  for (const message of ordonnes) {
    bilan.lus++;
    try {
      const resultat = await enregistrerMessage(message, { ...opts, config }, auteur);
      if (!resultat) {
        bilan.doublons++;
        continue;
      }
      if (resultat.ignore) {
        bilan.ignores++;
        continue;
      }
      bilan.crees++;
      if (resultat.synthetisee) bilan.synthetisees++;
      if (resultat.horsPerimetre) bilan.horsPerimetre++;
      if (resultat.aClasser) bilan.aClasser++;
      bilan.piecesRangees += resultat.pieces;
    } catch (e) {
      bilan.erreurs.push({ messageId: message.messageId, raison: messageErreur(e).slice(0, 300) });
    }
  }

  await journaliser('mails_collectes', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'compte',
    entiteId: opts.compteId,
    details: { ...bilan, erreurs: bilan.erreurs.length },
  });
  return bilan;
}

export { inArray, sql };

// ---------------------------------------------------------------------------
// Journal de collecte : ce que la boite a envoye, et ce qui en a ete fait
// ---------------------------------------------------------------------------

export interface MessageCollecte_Journal {
  evenementId: number;
  collecteLe: Date;
  survenuLe: Date;
  expediteur: string | null;
  destinataires: string[];
  objet: string | null;
  famille: string | null;
  confiance: number | null;
  demandeId: number | null;
  dossierId: number | null;
  posteId: number | null;
  lienExterne: string | null;
  /** Ce que la GPAO a decide de ce message, en un mot. */
  sort: 'demande' | 'rattache' | 'hors_perimetre' | 'a_classer' | 'trace';
}

/**
 * Les derniers messages collectes, avec le sort reserve a chacun.
 *
 * C'est la reponse a la seule question qu'on pose quand un mail ne se retrouve pas : est-il
 * arrive, et qu'en a-t-on fait ? Sans cet ecran, la seule facon de repondre etait de lire la
 * base, ce que le commanditaire ne peut pas faire.
 *
 * Les messages hors perimetre y figurent **exprès**, alors qu'ils sont exclus de toutes les vues
 * de pilotage : leur absence ailleurs est justement ce qu'il faut pouvoir expliquer.
 */
export async function journalDeCollecte(compteId: number, limite = 50): Promise<MessageCollecte_Journal[]> {
  const parametres = await lireParametres();
  const lignes = await db
    .select()
    .from(schema.evenements)
    .where(and(eq(schema.evenements.compteId, compteId), inArray(schema.evenements.source, ['mail', 'import'])))
    .orderBy(desc(schema.evenements.creeLe))
    .limit(Math.min(limite, 200));

  return lignes.map((e) => {
    const horsPerimetre = estHorsPerimetre(e.famille);
    const sousLeSeuil = e.confianceTypage !== null && Number(e.confianceTypage) < parametres.seuilConfianceTypage;
    let sort: MessageCollecte_Journal['sort'];
    if (horsPerimetre) sort = 'hors_perimetre';
    else if (!e.famille || sousLeSeuil) sort = 'a_classer';
    else if (e.demandeId) sort = 'demande';
    else sort = 'trace';

    return {
      evenementId: e.id,
      collecteLe: e.creeLe,
      survenuLe: e.survenuLe,
      expediteur: e.expediteur,
      destinataires: (e.destinataires ?? []) as string[],
      objet: e.objet,
      famille: e.famille,
      confiance: e.confianceTypage === null ? null : Number(e.confianceTypage),
      demandeId: e.demandeId,
      dossierId: e.dossierId,
      posteId: null,
      lienExterne: e.lienExterne,
      sort,
    };
  });
}

/** Les derniers passages de la collecte, avec leur bilan : dit si la boite pousse encore. */
export async function passagesDeCollecte(limite = 20) {
  const lignes = await db
    .select({ le: schema.journalActions.creeLe, bilan: schema.journalActions.details })
    .from(schema.journalActions)
    .where(eq(schema.journalActions.action, 'mails_collectes'))
    .orderBy(desc(schema.journalActions.creeLe))
    .limit(Math.min(limite, 100));
  return lignes;
}
