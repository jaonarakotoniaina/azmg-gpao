/**
 * Donnees de demonstration, entierement FICTIVES.
 *
 * Regle de confidentialite de CLAUDE.md (section 3) : aucune donnee reelle de Masenz Group
 * (prix, clients, documents, echanges) n'entre dans le depot, les tests ou le seed. Les clients,
 * produits, references et montants ci-dessous sont inventes et ne correspondent a aucun dossier reel.
 *
 * Le seed est refuse en production (voir src/server/cli.ts) et idempotent : relance sans doublon.
 */
import { DateTime } from 'luxon';
import { eq } from 'drizzle-orm';
import { db, schema } from './client';
import { creerUtilisateur } from '../modules/auth/service';
import { creerCompte, creerPoste } from '../modules/comptes/service';
import { trouverOuCreerDossier } from '../modules/dossiers/service';
import { ajouterEvenement } from '../modules/evenements/service';
import { changerStatut, AUTEUR_SYSTEME } from '../modules/demandes/service';
import { initialiserChecklistsEtGrilles, initialiserReferentiel } from './referentiel';
import { FUSEAU_CLIENT_DEFAUT } from '@shared/heures-ouvrees';
import type { Role } from '@shared/constantes';

const MOT_DE_PASSE_DEMO = 'DemoGpao2026!';

const COMPTES_DEMO = [
  {
    nom: 'Masenz Group (demonstration)',
    code: 'masenz-demo',
    pays: 'Espagne',
    ville: 'Barcelone',
    fuseau: FUSEAU_CLIENT_DEFAUT,
    donneurOrdreNom: 'Responsable export (fictive)',
    donneurOrdreEmail: 'do.demo@exemple-client.test',
    poste: 'Assistante export et customer support',
  },
] as const;

/** Dossiers fictifs : clients, produits et operations inventes. */
const DOSSIERS_DEMO = [
  { client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules vitamine C 180 kg', operation: 'aerien vers Alger' },
  { client: 'Beta Distrib', pays: 'Libye', produit: 'Sirop multivitamine 2 palettes', operation: 'maritime LCL vers Tripoli' },
  { client: 'Gamma Sante', pays: 'Emirats arabes unis', produit: 'Complement magnesium 400 kg', operation: 'aerien vers Dubai' },
  { client: 'Delta Medic', pays: 'France', produit: 'Comprimes zinc 90 kg', operation: 'routier vers Lyon' },
  { client: 'Epsilon Trade', pays: 'Maroc', produit: 'Huile de poisson 1 FCL', operation: 'maritime FCL vers Casablanca' },
] as const;

/**
 * Scenario par dossier : la suite d'evenements a rejouer.
 * `jours` est le decalage en jours ouvres approximatif par rapport a aujourd'hui (valeur negative).
 */
const SCENARIOS = [
  {
    dossier: 0,
    famille: 'T01',
    objet: 'Cotation fret aerien 180 kg vers Alger',
    evenements: [
      { jours: -6, sens: 'entrant', nature: 'demande_entrante', interlocuteur: 'client', resume: 'Le client demande une cotation aerienne pour 180 kg.' },
      { jours: -6, sens: 'sortant', nature: 'envoi_livrable', interlocuteur: 'transitaire', resume: 'Demande de cotation envoyee a trois transitaires.' },
      { jours: -4, sens: 'entrant', nature: 'reponse_tiers', interlocuteur: 'transitaire', resume: 'Deux offres recues, une troisieme attendue.' },
      { jours: -3, sens: 'sortant', nature: 'demande_validation_do', interlocuteur: 'do', resume: 'Comparatif des deux offres transmis pour validation du transitaire et du prix.' },
    ],
  },
  {
    dossier: 1,
    famille: 'T02',
    objet: 'Documents d’expedition LCL vers Tripoli',
    evenements: [
      { jours: -9, sens: 'entrant', nature: 'consigne_do', interlocuteur: 'do', resume: 'Preparer le jeu de documents pour l’expedition LCL.' },
      { jours: -8, sens: 'sortant', nature: 'envoi_livrable', interlocuteur: 'client', resume: 'Projet de BL et packing list envoyes au client pour accord.' },
      { jours: -5, sens: 'entrant', nature: 'reponse_tiers', interlocuteur: 'client', resume: 'Le client demande la correction du NIF sur le BL.' },
      { jours: -4, sens: 'sortant', nature: 'envoi_livrable', interlocuteur: 'client', resume: 'BL corrige envoye, accord obtenu.' },
      { jours: -2, sens: 'interne', nature: 'information', interlocuteur: 'interne_azmg', resume: 'Scan du BL archive dans le dossier.', cloturer: true },
    ],
  },
  {
    dossier: 2,
    famille: 'T03',
    objet: 'Proforma a modifier pour Gamma Sante',
    evenements: [
      { jours: -3, sens: 'entrant', nature: 'demande_entrante', interlocuteur: 'client', resume: 'Le client demande une proforma en dollars au lieu d’euros.' },
      { jours: -2, sens: 'sortant', nature: 'demande_validation_do', interlocuteur: 'do', resume: 'Modification de devise soumise a la validation de la DO.' },
      { jours: -1, sens: 'entrant', nature: 'validation_do', interlocuteur: 'do', resume: 'La DO valide la proforma en dollars.' },
    ],
  },
  {
    dossier: 3,
    famille: 'T04',
    objet: 'Relance du solde a payer',
    evenements: [
      { jours: -12, sens: 'entrant', nature: 'consigne_do', interlocuteur: 'do', resume: 'Suivre le reglement du solde et relancer le client.' },
      { jours: -12, sens: 'sortant', nature: 'envoi_livrable', interlocuteur: 'client', resume: 'Facture definitive envoyee, solde attendu.' },
      { jours: -7, sens: 'sortant', nature: 'relance_emise', interlocuteur: 'client', resume: 'Premiere relance sur le solde.' },
      { jours: -3, sens: 'sortant', nature: 'relance_emise', interlocuteur: 'client', resume: 'Deuxieme relance, copie a la DO.' },
    ],
  },
  {
    dossier: 4,
    famille: 'T05',
    objet: 'Legalisation du certificat de vente libre',
    evenements: [
      { jours: -15, sens: 'entrant', nature: 'consigne_do', interlocuteur: 'do', resume: 'Lancer la legalisation du certificat de vente libre.' },
      { jours: -14, sens: 'sortant', nature: 'envoi_livrable', interlocuteur: 'autorite', resume: 'Dossier depose pour legalisation.' },
      { jours: -5, sens: 'entrant', nature: 'relance_recue', interlocuteur: 'client', resume: 'Le client s’inquiete du delai de legalisation.' },
      { jours: -5, sens: 'interne', nature: 'information', interlocuteur: 'interne_azmg', resume: 'Autorite injoignable, dossier bloque en attente de creneau.', bloquer: true },
    ],
  },
  {
    dossier: 0,
    famille: 'T14',
    objet: 'Suivi du tracking express',
    evenements: [
      { jours: -1, sens: 'entrant', nature: 'demande_entrante', interlocuteur: 'client', resume: 'Le client demande le numero de suivi du colis echantillon.' },
    ],
  },
  /** Hors perimetre : trace mais invisible dans le pilotage (regle T00). */
  {
    dossier: 3,
    famille: 'T00',
    objet: 'Newsletter d’un salon professionnel',
    evenements: [{ jours: -2, sens: 'entrant', nature: 'information', interlocuteur: 'prospect', resume: 'Message promotionnel sans lien avec le poste.' }],
  },
] as const;

const UTILISATEURS_DEMO: { email: string; nom: string; role: Role }[] = [
  { email: 'ceo@azmg-solutions.com', nom: 'Jaona Rakotoniaina', role: 'admin' },
  { email: 'princy@azmg-solutions.com', nom: 'Princy (manager de compte)', role: 'manager' },
  { email: 'elysa@azmg-solutions.com', nom: 'Elysa (assistante export)', role: 'collaborateur' },
];

/** Decalage de `jours` jours a 10 h, heure de Barcelone (dans les heures ouvrees du client). */
function instant(jours: number): Date {
  return DateTime.now().setZone(FUSEAU_CLIENT_DEFAUT).startOf('day').plus({ days: jours, hours: 10 }).toJSDate();
}

export async function seedDemo() {
  await initialiserReferentiel();
  await initialiserChecklistsEtGrilles();

  const parEmail = new Map<string, number>();
  for (const u of UTILISATEURS_DEMO) {
    const [existe] = await db.select({ id: schema.utilisateurs.id }).from(schema.utilisateurs).where(eq(schema.utilisateurs.email, u.email));
    if (existe) {
      parEmail.set(u.email, existe.id);
      continue;
    }
    const cree = await creerUtilisateur({ ...u, motDePasse: MOT_DE_PASSE_DEMO });
    parEmail.set(u.email, cree.id);
  }

  const bilan = { comptes: 0, postes: 0, dossiers: 0, demandes: 0, evenements: 0 };
  for (const c of COMPTES_DEMO) {
    const [existe] = await db.select().from(schema.comptesClients).where(eq(schema.comptesClients.code, c.code));
    if (existe) return { ...bilan, deja: true };

    const compte = await creerCompte(
      {
        nom: c.nom,
        code: c.code,
        pays: c.pays,
        ville: c.ville,
        fuseau: c.fuseau,
        donneurOrdreNom: c.donneurOrdreNom,
        donneurOrdreEmail: c.donneurOrdreEmail,
        managerId: parEmail.get('princy@azmg-solutions.com') ?? null,
      },
      AUTEUR_SYSTEME,
    );
    bilan.comptes++;
    const poste = await creerPoste({ compteId: compte.id, intitule: c.poste, collaborateurId: parEmail.get('elysa@azmg-solutions.com') ?? null }, AUTEUR_SYSTEME);
    bilan.postes++;

    const dossiers: number[] = [];
    for (const d of DOSSIERS_DEMO) {
      const { dossier } = await trouverOuCreerDossier({ compteId: compte.id, posteId: poste.id, ...d }, AUTEUR_SYSTEME);
      dossiers.push(dossier.id);
      bilan.dossiers++;
    }

    const auteur = { utilisateurId: parEmail.get('elysa@azmg-solutions.com') ?? null, type: 'humain' as const };
    for (const scenario of SCENARIOS) {
      let demandeId: number | null = null;
      for (const e of scenario.evenements) {
        const resultat = await ajouterEvenement(
          {
            demandeId,
            dossierId: dossiers[scenario.dossier],
            sens: e.sens,
            nature: e.nature,
            famille: scenario.famille,
            interlocuteur: e.interlocuteur,
            source: 'saisie',
            survenuLe: instant(e.jours),
            objet: scenario.objet,
            resume: e.resume,
          },
          auteur,
        );
        bilan.evenements++;
        if (resultat.demandeCreee) bilan.demandes++;
        if (resultat.demande) demandeId = resultat.demande.id;
        if ('cloturer' in e && e.cloturer && demandeId) {
          await changerStatut(demandeId, 'termine', auteur, { motif: 'dossier complet et archive', survenuLe: instant(e.jours) });
        }
        if ('bloquer' in e && e.bloquer && demandeId) {
          await changerStatut(demandeId, 'bloque', auteur, { motif: 'autorite injoignable', survenuLe: instant(e.jours) });
        }
      }
    }

    // Echeances fictives pour l'echeancier et les alertes J-2 et J0.
    const echeancesDemo = [
      { dossier: 0, type: 'cut_off' as const, libelle: 'Cut-off aerien', jours: 2 },
      { dossier: 0, type: 'etd' as const, libelle: 'Depart prevu', jours: 3 },
      { dossier: 1, type: 'eta' as const, libelle: 'Arrivee prevue a Tripoli', jours: 9 },
      { dossier: 2, type: 'validite_offre' as const, libelle: 'Validite de la proforma', jours: 0 },
      { dossier: 4, type: 'expiration_document' as const, libelle: 'Expiration du certificat de vente libre', jours: 21 },
    ];
    for (const e of echeancesDemo) {
      await db.insert(schema.echeances).values({
        dossierId: dossiers[e.dossier],
        type: e.type,
        libelle: e.libelle,
        echeanceLe: instant(e.jours),
      });
    }
  }
  return bilan;
}
