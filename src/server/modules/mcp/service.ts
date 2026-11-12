/**
 * Connecteur Claude (MCP) de la GPAO, sur le modele de celui d'AZMG Sourcing.
 *
 * Serveur MCP minimal (JSON-RPC sur HTTP, reponses JSON, sans session ni flux SSE) branche sur
 * POST /mcp, pour qu'une conversation claude.ai lise et mette a jour le pilotage du poste :
 * connecteur personnalise de claude.ai, sans OAuth, avec l'en-tete
 * `Authorization: Bearer <AZMG_MCP_TOKEN>` (docs/connecteur-claude.md).
 *
 * Garde-fous :
 *  - aucun outil n'envoie de message a un client, un transitaire ou la DO. L'export et le digest
 *    rendent un texte a relire, jamais un envoi ;
 *  - la famille T00 est hors perimetre : aucun outil ne la lit ni ne l'ecrit ;
 *  - chaque ecriture laisse une trace « claude » dans le journal des actions (section 8.13).
 */
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { config } from '../../config';
import { lireParametres } from '../../lib/parametres';
import { auteurClaude } from '../../lib/auteur';
import {
  changerStatut,
  creerDemande,
  demandesDuDossier,
  fileDuJour,
  tempsDemande,
  type Auteur,
} from '../demandes/service';
import { chercherDossiers, chronologieDossier, lireDossier, trouverOuCreerDossier } from '../dossiers/service';
import { aClasser, ajouterEvenement, corrigerTypage } from '../evenements/service';
import { tableauDeBord } from '../indicateurs/service';
import { construireBlocJour } from '../export/service';
import {
  FAMILLE_HORS_PERIMETRE,
  FAMILLES_PILOTAGE,
  INTERLOCUTEURS,
  NATURES,
  SENS,
  SOURCES,
  STATUTS,
  estHorsPerimetre,
  libelleStatut,
  statutReporting,
  type Interlocuteur,
  type Nature,
  type Sens,
  type Source,
} from '@shared/constantes';
import { formaterDuree } from '@shared/heures-ouvrees';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = [
  'GPAO AZMG-Solutions : pilotage operationnel des postes places chez les clients.',
  "L'unite de travail n'est pas le mail mais la demande, rattachee a un dossier (client, produit, operation). Un mail, une consigne WhatsApp ou un vocal sont des evenements qui creent, font avancer ou cloturent une demande.",
  'Pour parler d’un dossier, le retrouver d’abord (chercher_dossier), puis lire sa fiche (fiche_dossier). Ne rien inventer qui n’y figure pas.',
  'Tous les delais sont comptes en heures ouvrees du client (Barcelone), week-ends et feries exclus. Une journee ouvree vaut 9 heures.',
  'La famille T00 est hors perimetre du poste : elle n’apparait dans aucun outil et ne peut pas etre ecrite.',
  'Aucun outil n’envoie de message a un client, un transitaire ou la donneuse d’ordre. exporter_reporting rend un texte a relire, jamais un envoi.',
  'Ne jamais reprendre une appreciation du client sur le collaborateur : decrire l’etat factuel du dossier et l’action qui debloque.',
  'Les outils d’ecriture laissent une trace « claude » dans le journal des actions.',
].join(' ');

interface Outil {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  executer(args: Record<string, unknown>, auteur: Auteur): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function entier(v: unknown, nom: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${nom} : identifiant numerique attendu`);
  return n;
}

function texte(v: unknown, nom: string, min = 1): string {
  const t = String(v ?? '').trim();
  if (t.length < min) throw new Error(`${nom} : ${min} caractere(s) minimum attendu(s)`);
  return t;
}

function choix<T extends string>(v: unknown, valeurs: readonly T[], nom: string, defaut?: T): T {
  if (v === undefined || v === null || v === '') {
    if (defaut !== undefined) return defaut;
    throw new Error(`${nom} : valeur attendue parmi ${valeurs.join(', ')}`);
  }
  const t = String(v);
  if (!valeurs.includes(t as T)) throw new Error(`${nom} : « ${t} » inconnu. Attendu : ${valeurs.join(', ')}`);
  return t as T;
}

function familleValide(v: unknown, nom = 'famille'): string {
  const f = texte(v, nom, 2).toUpperCase();
  if (estHorsPerimetre(f)) throw new Error(`La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : elle n'entre pas dans le pilotage`);
  return f;
}

function instant(v: unknown, nom: string): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`${nom} : date attendue au format ISO (AAAA-MM-JJTHH:MM:SSZ)`);
  return d;
}

const lienDemande = (id: number) => `${config.url}/demandes/${id}`;
const lienDossier = (id: number) => `${config.url}/dossiers/${id}`;

/** Compte par defaut quand l'appelant n'en precise pas : l'unique compte actif, sinon erreur. */
async function compteDemande(v: unknown): Promise<number> {
  if (v !== undefined && v !== null && v !== '') return entier(v, 'compte_id');
  const comptes = await db.select({ id: schema.comptesClients.id, nom: schema.comptesClients.nom }).from(schema.comptesClients).where(eq(schema.comptesClients.actif, true));
  if (comptes.length === 1) return comptes[0].id;
  throw new Error(`compte_id obligatoire : plusieurs comptes clients (${comptes.map((c) => `${c.id} ${c.nom}`).join(', ')})`);
}

/** Demande existante, refusee si hors perimetre. */
async function demandeDuPerimetre(id: unknown) {
  const [d] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, entier(id, 'demande_id')));
  if (!d || estHorsPerimetre(d.famille)) throw new Error('Demande introuvable');
  return d;
}

// ---------------------------------------------------------------------------
// Les onze outils de la section 8.13
// ---------------------------------------------------------------------------

export const OUTILS: Outil[] = [
  {
    name: 'file_du_jour',
    title: 'File du jour',
    description:
      'Demandes ouvertes du poste, triees par urgence : delai cible depasse, echeance proche, priorite, puis anciennete. Les durees sont en heures ouvrees du client.',
    inputSchema: {
      type: 'object',
      properties: {
        compte_id: { type: 'integer', description: 'Compte client. Facultatif s’il n’y en a qu’un.' },
        famille: { type: 'string', description: 'Code de famille, par exemple T01' },
        acteur: { type: 'string', enum: ['poste', 'do', 'client', 'tiers'], description: 'Acteur dont on attend l’action' },
        risque_seulement: { type: 'boolean', description: 'Ne garder que les demandes en retard ou proches d’une echeance' },
        limite: { type: 'integer', minimum: 1, maximum: 100, description: '30 par defaut' },
      },
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const lignes = await fileDuJour({
        compteId,
        familles: args.famille ? [familleValide(args.famille)] : undefined,
        acteurs: args.acteur ? [choix(args.acteur, ['poste', 'do', 'client', 'tiers'] as const, 'acteur')] : undefined,
        risqueSeulement: Boolean(args.risque_seulement),
        limite: Math.min(Math.max(Number(args.limite) || 30, 1), 100),
      });
      return lignes.map((l) => ({
        demande_id: l.id,
        dossier_id: l.dossierId,
        dossier: l.dossier,
        objet: l.objet,
        famille: l.famille,
        statut: libelleStatut(l.statut),
        statut_reporting: statutReporting(l.statut),
        acteur_attendu: l.acteurAttendu,
        age: formaterDuree(l.ageMinutes),
        attente_dans_le_statut: formaterDuree(l.attenteMinutes),
        delai_cible_depasse: l.slaDepasse,
        jours_avant_echeance: l.joursAvantEcheance,
        niveau_relance: l.niveauRelance,
        lien: lienDemande(l.id),
      }));
    },
  },

  {
    name: 'chercher_dossier',
    title: 'Chercher un dossier',
    description: 'Cherche un dossier par client, produit, pays ou operation. Renvoie le dossier_id a utiliser avec les autres outils.',
    inputSchema: {
      type: 'object',
      properties: {
        recherche: { type: 'string', description: 'Client, produit, pays ou operation (partiel accepte)' },
        compte_id: { type: 'integer' },
        limite: { type: 'integer', minimum: 1, maximum: 50, description: '20 par defaut' },
      },
      required: ['recherche'],
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const lignes = await chercherDossiers(texte(args.recherche, 'recherche', 2), {
        compteId,
        limite: Math.min(Math.max(Number(args.limite) || 20, 1), 50),
      });
      return lignes.map((d) => ({
        dossier_id: d.id,
        libelle: d.libelle,
        client: d.client,
        pays: d.pays,
        produit: d.produit,
        operation: d.operation,
        statut: d.statut,
        etat: d.resume,
        demandes_ouvertes: d.demandesOuvertes,
        lien: lienDossier(d.id),
      }));
    },
  },

  {
    name: 'fiche_dossier',
    title: 'Fiche d’un dossier',
    description:
      'Lit un dossier : identification, references, montants approuves, demandes avec leurs delais, echeances, et la chronologie des evenements. Le hors perimetre en est exclu.',
    inputSchema: {
      type: 'object',
      properties: {
        dossier_id: { type: 'integer' },
        evenements: { type: 'integer', minimum: 0, maximum: 100, description: 'Nombre d’evenements de la chronologie, 20 par defaut' },
      },
      required: ['dossier_id'],
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const dossier = await lireDossier(entier(args.dossier_id, 'dossier_id'));
      const demandes = await demandesDuDossier(dossier.id);
      const avecTemps = await Promise.all(
        demandes.map(async (d) => {
          const temps = await tempsDemande(d);
          return {
            demande_id: d.id,
            objet: d.objet,
            famille: d.famille,
            statut: libelleStatut(d.statut),
            statut_reporting: statutReporting(d.statut),
            acteur_attendu: d.acteurAttendu,
            delai_total: formaterDuree(temps.total),
            premiere_reponse: temps.premiereReponse === null ? null : formaterDuree(temps.premiereReponse),
            niveau_relance: d.niveauRelance,
            lien: lienDemande(d.id),
          };
        }),
      );
      const echeances = await db
        .select()
        .from(schema.echeances)
        .where(and(eq(schema.echeances.dossierId, dossier.id), eq(schema.echeances.annulee, false)))
        .orderBy(asc(schema.echeances.echeanceLe));
      const chrono = await chronologieDossier(dossier.id);
      const limite = Math.min(Math.max(Number(args.evenements ?? 20), 0), 100);

      return {
        dossier_id: dossier.id,
        libelle: dossier.libelle,
        client: dossier.client,
        pays: dossier.pays,
        produit: dossier.produit,
        operation: dossier.operation,
        statut: dossier.statut,
        etat: dossier.resume,
        references: dossier.references,
        montants_approuves: dossier.montantsApprouves,
        notes: dossier.notes,
        demandes: avecTemps,
        echeances: echeances.map((e) => ({ type: e.type, libelle: e.libelle, le: e.echeanceLe.toISOString().slice(0, 10), honoree: Boolean(e.honoreeLe) })),
        chronologie: chrono.slice(0, limite).map((l) => ({ type: l.type, le: l.survenuLe.toISOString(), titre: l.titre, detail: l.detail })),
        lien: lienDossier(dossier.id),
      };
    },
  },

  {
    name: 'creer_demande',
    title: 'Creer une demande',
    description:
      'Ouvre une demande dans un dossier existant, ou cree le dossier a la volee si client et produit sont fournis. Un dossier identique existant est reutilise.',
    inputSchema: {
      type: 'object',
      properties: {
        dossier_id: { type: 'integer', description: 'Dossier existant. Sinon, renseigner client.' },
        compte_id: { type: 'integer' },
        client: { type: 'string', description: 'Client du nouveau dossier' },
        pays: { type: 'string' },
        produit: { type: 'string' },
        operation: { type: 'string' },
        famille: { type: 'string', description: `Code de famille parmi ${FAMILLES_PILOTAGE.map((f) => f.code).join(', ')}` },
        objet: { type: 'string', description: 'Ce qu’il y a a faire, en une ligne' },
        priorite: { type: 'string', enum: ['basse', 'normale', 'haute', 'critique'] },
        echeance: { type: 'string', description: 'Echeance de la demande, au format ISO' },
      },
      required: ['famille', 'objet'],
    },
    async executer(args, auteur) {
      const famille = familleValide(args.famille);
      const objet = texte(args.objet, 'objet', 2);
      let dossierId: number;
      if (args.dossier_id) {
        dossierId = (await lireDossier(entier(args.dossier_id, 'dossier_id'))).id;
      } else {
        const compteId = await compteDemande(args.compte_id);
        const { dossier } = await trouverOuCreerDossier(
          {
            compteId,
            client: texte(args.client, 'client'),
            pays: args.pays ? String(args.pays) : null,
            produit: args.produit ? String(args.produit) : null,
            operation: args.operation ? String(args.operation) : null,
          },
          auteur,
        );
        dossierId = dossier.id;
      }
      const demande = await creerDemande(
        {
          dossierId,
          famille,
          objet,
          origine: 'saisie',
          priorite: args.priorite ? choix(args.priorite, ['basse', 'normale', 'haute', 'critique'] as const, 'priorite') : undefined,
          echeanceLe: instant(args.echeance, 'echeance') ?? null,
        },
        auteur,
      );
      return { demande_id: demande.id, dossier_id: dossierId, statut: libelleStatut(demande.statut), lien: lienDemande(demande.id) };
    },
  },

  {
    name: 'ajouter_evenement',
    title: 'Ajouter un evenement',
    description:
      'Enregistre un mail, une consigne, une note ou une reponse sur une demande ou un dossier. C’est la nature qui fait avancer la demande (voir le referentiel).',
    inputSchema: {
      type: 'object',
      properties: {
        demande_id: { type: 'integer' },
        dossier_id: { type: 'integer', description: 'A defaut de demande_id' },
        sens: { type: 'string', enum: [...SENS] },
        nature: { type: 'string', enum: [...NATURES] },
        famille: { type: 'string' },
        interlocuteur: { type: 'string', enum: [...INTERLOCUTEURS] },
        source: { type: 'string', enum: [...SOURCES] },
        objet: { type: 'string' },
        resume: { type: 'string', description: 'Etat factuel et action qui debloque, jamais une appreciation sur le collaborateur' },
        survenu_le: { type: 'string', description: 'Horodatage d’origine, au format ISO. Maintenant par defaut.' },
      },
      required: ['nature'],
    },
    async executer(args, auteur) {
      if (!args.demande_id && !args.dossier_id) throw new Error('Indiquez demande_id ou dossier_id');
      const nature = choix(args.nature, NATURES, 'nature');
      const resultat = await ajouterEvenement(
        {
          demandeId: args.demande_id ? (await demandeDuPerimetre(args.demande_id)).id : null,
          dossierId: args.dossier_id ? entier(args.dossier_id, 'dossier_id') : null,
          sens: choix(args.sens, SENS, 'sens', 'entrant' as Sens),
          nature,
          famille: args.famille ? familleValide(args.famille) : null,
          interlocuteur: args.interlocuteur ? choix(args.interlocuteur, INTERLOCUTEURS, 'interlocuteur') : null,
          source: choix(args.source, SOURCES, 'source', 'saisie' as Source),
          objet: args.objet ? String(args.objet) : null,
          resume: args.resume ? String(args.resume) : null,
          survenuLe: instant(args.survenu_le, 'survenu_le'),
        },
        auteur,
      );
      return {
        evenement_id: resultat.evenement.id,
        demande_id: resultat.demande?.id ?? null,
        demande_creee: resultat.demandeCreee,
        statut: resultat.demande ? libelleStatut(resultat.demande.statut) : null,
        hors_perimetre: resultat.horsPerimetre,
      };
    },
  },

  {
    name: 'changer_statut',
    title: 'Changer le statut d’une demande',
    description: 'Change le statut d’une demande. La transition est horodatee et le temps passe dans le statut quitte est comptabilise.',
    inputSchema: {
      type: 'object',
      properties: {
        demande_id: { type: 'integer' },
        statut: { type: 'string', enum: [...STATUTS] },
        motif: { type: 'string' },
      },
      required: ['demande_id', 'statut'],
    },
    async executer(args, auteur) {
      const demande = await demandeDuPerimetre(args.demande_id);
      const maj = await changerStatut(demande.id, choix(args.statut, STATUTS, 'statut'), auteur, {
        motif: args.motif ? String(args.motif).slice(0, 300) : 'via le connecteur Claude',
      });
      const temps = await tempsDemande(maj);
      return {
        demande_id: maj.id,
        statut: libelleStatut(maj.statut),
        statut_reporting: statutReporting(maj.statut),
        acteur_attendu: maj.acteurAttendu,
        delai_total: formaterDuree(temps.total),
        lien: lienDemande(maj.id),
      };
    },
  },

  {
    name: 'echeances_a_venir',
    title: 'Echeances a venir',
    description: 'Cut-off, departs et arrivees prevus, validites d’offre, expirations de document et creneaux d’entrepot, du plus proche au plus lointain.',
    inputSchema: {
      type: 'object',
      properties: {
        compte_id: { type: 'integer' },
        jours: { type: 'integer', minimum: 1, maximum: 180, description: '14 par defaut' },
      },
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const jours = Math.min(Math.max(Number(args.jours) || 14, 1), 180);
      const maintenant = new Date();
      const lignes = await db
        .select({ echeance: schema.echeances, dossierId: schema.dossiers.id, dossier: schema.dossiers.libelle })
        .from(schema.echeances)
        .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.echeances.dossierId))
        .where(
          and(
            eq(schema.dossiers.compteId, compteId),
            eq(schema.echeances.annulee, false),
            sql`${schema.echeances.honoreeLe} IS NULL`,
            gte(schema.echeances.echeanceLe, new Date(maintenant.getTime() - 7 * 86_400_000)),
            lte(schema.echeances.echeanceLe, new Date(maintenant.getTime() + jours * 86_400_000)),
          ),
        )
        .orderBy(asc(schema.echeances.echeanceLe))
        .limit(100);
      return lignes.map((l) => ({
        dossier_id: l.dossierId,
        dossier: l.dossier,
        type: l.echeance.type,
        libelle: l.echeance.libelle,
        le: l.echeance.echeanceLe.toISOString().slice(0, 10),
        jours_restants: Math.floor((l.echeance.echeanceLe.getTime() - maintenant.getTime()) / 86_400_000),
        lien: lienDossier(l.dossierId),
      }));
    },
  },

  {
    name: 'indicateurs',
    title: 'Indicateurs de pilotage',
    description: 'Flux, stock, delais, respect du delai cible, attente par acteur et charge estimee, avec la comparaison a la periode precedente.',
    inputSchema: {
      type: 'object',
      properties: {
        compte_id: { type: 'integer' },
        jours: { type: 'integer', minimum: 1, maximum: 365, description: '7 par defaut' },
      },
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const tb = await tableauDeBord(Math.min(Math.max(Number(args.jours) || 7, 1), 365), { compteId });
      return {
        periode_jours: tb.periode.jours,
        flux: { entrees: tb.flux.entrees, sorties: tb.flux.sorties, solde: tb.flux.solde },
        flux_periode_precedente: { entrees: tb.precedent.flux.entrees, sorties: tb.precedent.flux.sorties },
        stock: {
          total: tb.stock.total,
          par_statut: tb.stock.parStatut,
          par_acteur: tb.stock.parActeur,
          age_moyen: formaterDuree(tb.stock.ageMoyenMinutes),
          delai_cible_depasse: tb.stock.slaDepasse,
        },
        delais: {
          terminees: tb.delais.terminees,
          premiere_reponse_mediane: tb.delais.premiereReponseMedianeMinutes === null ? null : formaterDuree(tb.delais.premiereReponseMedianeMinutes),
          delai_total_median: tb.delais.delaiTotalMedianMinutes === null ? null : formaterDuree(tb.delais.delaiTotalMedianMinutes),
          respect_delai_cible: tb.delais.respectSla,
          attente_par_acteur: Object.fromEntries(
            Object.entries(tb.delais.attenteParActeurMinutes).filter(([, m]) => m > 0).map(([a, m]) => [a, formaterDuree(m)]),
          ),
        },
        charge_estimee_jours: tb.charge.totalJours,
        attentes_do_longues: tb.attentesDoLongues.map((a) => ({
          demande_id: a.demandeId,
          objet: a.objet,
          dossier: a.dossier,
          attente: formaterDuree(a.minutesAttente),
        })),
        echeances_proches: tb.echeancesProches.map((e) => ({ dossier: e.dossier, libelle: e.libelle ?? e.type, jours_restants: e.joursRestants })),
      };
    },
  },

  {
    name: 'a_classer',
    title: 'File « A classer »',
    description: 'Evenements dont le typage automatique est sous le seuil de confiance, ou dont la famille manque. Le hors perimetre en est exclu.',
    inputSchema: {
      type: 'object',
      properties: { limite: { type: 'integer', minimum: 1, maximum: 100, description: '20 par defaut' } },
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const parametres = await lireParametres();
      const lignes = await aClasser(parametres.seuilConfianceTypage, Math.min(Math.max(Number(args.limite) || 20, 1), 100));
      return lignes.map((l) => ({
        evenement_id: l.evenement.id,
        dossier: l.dossier,
        objet: l.evenement.objet,
        resume: l.evenement.resume,
        sens: l.evenement.sens,
        nature: l.evenement.nature,
        famille: l.evenement.famille,
        confiance: l.evenement.confianceTypage,
        survenu_le: l.evenement.survenuLe.toISOString(),
      }));
    },
  },

  {
    name: 'corriger_typage',
    title: 'Corriger le typage d’un evenement',
    description: 'Corrige la famille, la nature, le sens ou l’interlocuteur d’un evenement mal classe. La correction est tracee avec son auteur.',
    inputSchema: {
      type: 'object',
      properties: {
        evenement_id: { type: 'integer' },
        famille: { type: 'string' },
        nature: { type: 'string', enum: [...NATURES] },
        sens: { type: 'string', enum: [...SENS] },
        interlocuteur: { type: 'string', enum: [...INTERLOCUTEURS] },
      },
      required: ['evenement_id'],
    },
    async executer(args, auteur) {
      const modifs: { famille?: string; nature?: Nature; sens?: Sens; interlocuteur?: Interlocuteur } = {};
      if (args.famille) modifs.famille = familleValide(args.famille);
      if (args.nature) modifs.nature = choix(args.nature, NATURES, 'nature');
      if (args.sens) modifs.sens = choix(args.sens, SENS, 'sens');
      if (args.interlocuteur) modifs.interlocuteur = choix(args.interlocuteur, INTERLOCUTEURS, 'interlocuteur');
      if (!Object.keys(modifs).length) throw new Error('Indiquez au moins une correction');
      const maj = await corrigerTypage(entier(args.evenement_id, 'evenement_id'), modifs, auteur);
      return { evenement_id: maj.id, famille: maj.famille, nature: maj.nature, sens: maj.sens, interlocuteur: maj.interlocuteur };
    },
  },

  {
    name: 'exporter_reporting',
    title: 'Preparer le reporting d’un jour',
    description:
      'Prepare les lignes du reporting quotidien pour un jour donne : une ligne par dossier, au dernier etat connu, description terminee par le statut exact. Rend un texte a relire, n’envoie rien et n’ecrit dans aucun classeur.',
    inputSchema: {
      type: 'object',
      properties: {
        compte_id: { type: 'integer' },
        jour: { type: 'string', description: 'AAAA-MM-JJ. Aujourd’hui par defaut.' },
      },
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const jour = args.jour ? texte(args.jour, 'jour', 10).slice(0, 10) : DateTime.now().toISODate()!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error('jour : format AAAA-MM-JJ attendu');
      const bloc = await construireBlocJour(compteId, jour);
      return {
        jour: DateTime.fromISO(jour).toFormat('dd/MM/yyyy'),
        lignes: bloc.lignes.map((l) => ({
          client_ou_pays: l.client,
          produit_et_reference: l.produit,
          description: l.description,
          statut: l.statut,
          livrables_finalises: l.livrables,
          priorite_du_lendemain: l.prioriteLendemain,
        })),
        rappel: "Ce texte est un brouillon a relire. L'ecriture dans le classeur se fait dans l'application, ecran Export.",
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Protocole JSON-RPC
// ---------------------------------------------------------------------------

export interface MessageRpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, any>;
}

function erreur(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: (id as string | number | null) ?? null, error: { code, message } };
}

/** Compte au nom duquel le connecteur agit : celui des parametres, sinon le premier administrateur. */
async function utilisateurDuConnecteur(): Promise<number | null> {
  if (config.mcp.utilisateur) {
    const [u] = await db
      .select({ id: schema.utilisateurs.id })
      .from(schema.utilisateurs)
      .where(and(eq(schema.utilisateurs.email, config.mcp.utilisateur), eq(schema.utilisateurs.actif, true)));
    if (u) return u.id;
  }
  const [admin] = await db
    .select({ id: schema.utilisateurs.id })
    .from(schema.utilisateurs)
    .where(and(eq(schema.utilisateurs.role, 'admin'), eq(schema.utilisateurs.actif, true)))
    .orderBy(asc(schema.utilisateurs.id));
  return admin?.id ?? null;
}

export async function traiterMessage(msg: MessageRpc) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return erreur(msg?.id, -32600, 'Requete JSON-RPC invalide');
  const { id, method } = msg;
  const params = msg.params ?? {};
  // Une notification (sans identifiant) n'attend pas de reponse.
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'azmg-gpao', title: 'AZMG GPAO', version: '1.0.0' },
          instructions: INSTRUCTIONS,
        },
      };
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: OUTILS.map(({ executer: _e, ...o }) => o) } };
    case 'tools/call': {
      const outil = OUTILS.find((o) => o.name === params.name);
      if (!outil) return erreur(id, -32602, `Outil inconnu : ${String(params.name)}`);
      try {
        const auteur = auteurClaude(await utilisateurDuConnecteur());
        const resultat = await outil.executer((params.arguments ?? {}) as Record<string, unknown>, auteur);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(resultat, null, 1) }],
            structuredContent: Array.isArray(resultat) ? { resultats: resultat } : (resultat as Record<string, unknown>),
          },
        };
      } catch (e) {
        // Une erreur metier revient a Claude comme un resultat en erreur, pas comme une panne.
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: (e as Error).message }], isError: true } };
      }
    }
    default:
      return erreur(id, -32601, `Methode non prise en charge : ${method}`);
  }
}
