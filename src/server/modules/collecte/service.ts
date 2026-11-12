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
import { journaliser } from '../../lib/evenements';
import { extensionAcceptee, rangerFichier } from '../../lib/stockage';
import { ajouterEvenement } from '../evenements/service';
import { trouverOuCreerDossier } from '../dossiers/service';
import { typerMessage } from '../typage/service';
import type { MessageCollecte } from '../../adapters/collecte-mail';
import { domaineDe, estUneDe } from '@shared/typage';
import { estHorsPerimetre, type Nature, type Sens } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

/** Taille maximale d'une piece jointe conservee. Au-dela, seule sa reference est gardee. */
const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

export interface BilanCollecte {
  lus: number;
  crees: number;
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
  return { lus: 0, crees: 0, doublons: 0, ignores: 0, horsPerimetre: 0, aClasser: 0, piecesRangees: 0, erreurs: [] };
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
  | { ignore?: false; evenementId: number; demandeId: number | null; horsPerimetre: boolean; aClasser: boolean; pieces: number }
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
      expediteur: message.expediteur,
      destinataires: message.destinataires,
      survenuLe: message.survenuLe,
      objet: message.objet,
      resume: message.corps.slice(0, 500),
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

  return {
    evenementId: resultat.evenement.id,
    demandeId: resultat.demande?.id ?? null,
    horsPerimetre,
    aClasser: !typage.applicable,
    pieces: piecesRangees.length,
  };
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
