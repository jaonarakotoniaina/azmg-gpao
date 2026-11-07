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
import { domaineDe } from '@shared/typage';
import { estHorsPerimetre, type Nature, type Sens } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

/** Taille maximale d'une piece jointe conservee. Au-dela, seule sa reference est gardee. */
const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

export interface BilanCollecte {
  lus: number;
  crees: number;
  /** Messages deja connus : le dedoublonnage a joue. */
  doublons: number;
  horsPerimetre: number;
  aClasser: number;
  piecesRangees: number;
  erreurs: { messageId: string; raison: string }[];
}

export function bilanVide(): BilanCollecte {
  return { lus: 0, crees: 0, doublons: 0, horsPerimetre: 0, aClasser: 0, piecesRangees: 0, erreurs: [] };
}

/**
 * Sens d'un message vu du poste : sortant si le poste en est l'expediteur, entrant sinon.
 * Les adresses du poste sont celles du domaine d'AZMG-Solutions.
 */
export function sensDuMessage(message: MessageCollecte, domainesInternes: string[]): Sens {
  const domaine = domaineDe(message.expediteur);
  if (domaine && domainesInternes.some((d) => domaine.endsWith(d))) return 'sortant';
  return 'entrant';
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
  /** Domaines consideres comme internes, pour deduire le sens. */
  domainesInternes?: string[];
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
): Promise<{ evenementId: number; demandeId: number | null; horsPerimetre: boolean; aClasser: boolean; pieces: number } | null> {
  // 1. Dedoublonnage : un identifiant deja connu ne cree rien.
  const [deja] = await db.select({ id: schema.evenements.id }).from(schema.evenements).where(eq(schema.evenements.messageId, message.messageId));
  if (deja) return null;

  const domainesInternes = opts.domainesInternes ?? ['azmg-solutions.com'];
  const sens = sensDuMessage(message, domainesInternes);

  // 2. Typage : il donne la famille, la nature et l'interlocuteur.
  const typage = await typerMessage(
    { objet: message.objet, corps: message.corps, expediteur: message.expediteur, destinataires: message.destinataires, sens },
    { compteId: opts.compteId },
  );
  const horsPerimetre = estHorsPerimetre(typage.typage.famille);

  // 3. Rattachement : le fil d'abord, le dossier par defaut ensuite.
  const parFil = horsPerimetre ? null : await demandeDuFil(message.filId, opts.compteId);
  let dossierId = parFil?.dossierId ?? opts.dossierParDefautId ?? null;

  if (!dossierId) {
    // Sans fil connu ni dossier indique, on ouvre un dossier de rattachement par interlocuteur.
    // Il sera reclasse a la main : mieux vaut un dossier a corriger qu'un message perdu.
    const client = message.expediteur ? message.expediteur.split('@')[0] : 'Expediteur inconnu';
    const { dossier } = await trouverOuCreerDossier(
      { compteId: opts.compteId, posteId: opts.posteId ?? null, client, produit: null, operation: null, notes: 'Dossier ouvert automatiquement par la collecte des mails, a reclasser.' },
      auteur,
    );
    dossierId = dossier.id;
  }

  // 4. Pieces jointes : rangees hors du dossier public, referencees dans le dossier.
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

  // 5. Enregistrement. La nature vient du typage ; sans elle, le message est une information.
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

  for (const message of ordonnes) {
    bilan.lus++;
    try {
      const resultat = await enregistrerMessage(message, opts, auteur);
      if (!resultat) {
        bilan.doublons++;
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
