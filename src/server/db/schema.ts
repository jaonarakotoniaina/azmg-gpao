/**
 * Schema PostgreSQL de la GPAO AZMG (Drizzle).
 *
 * Compatibilite visee : PostgreSQL 9.6 (version de l'hebergement o2switch).
 * Consequences respectees ici : identifiants `bigserial` (ni `gen_random_uuid`, ni colonnes
 * d'identite), pas de `MERGE`, pas de contrainte `NULLS NOT DISTINCT`, pas d'index sur
 * expression necessitant une extension.
 *
 * Les migrations SQL versionnees sont generees dans /drizzle par `npm run db:generate`.
 */
import {
  pgTable,
  bigserial,
  bigint,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Acteur, Interlocuteur, Nature, Priorite, Role, Sens, Source, Statut, StatutDossier, TypeEcheance } from '@shared/constantes';

const id = () => bigserial('id', { mode: 'number' }).primaryKey();
const ref = (nom: string) => bigint(nom, { mode: 'number' });
const horodatage = (nom: string) => timestamp(nom, { withTimezone: true, mode: 'date' });
const creeLe = () => horodatage('created_at').notNull().defaultNow();
const majLe = () => horodatage('updated_at').notNull().defaultNow();

// ---------------------------------------------------------------------------
// Utilisateurs, sessions, parametres
// ---------------------------------------------------------------------------

export const utilisateurs = pgTable('utilisateurs', {
  id: id(),
  email: text('email').notNull().unique(),
  nom: text('nom').notNull(),
  role: text('role').notNull().$type<Role>(),
  motDePasseHash: text('mot_de_passe_hash').notNull(),
  actif: boolean('actif').notNull().default(true),
  derniereConnexionLe: horodatage('derniere_connexion_le'),
  creeLe: creeLe(),
  majLe: majLe(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // empreinte SHA-256 du jeton de session
    utilisateurId: ref('utilisateur_id')
      .notNull()
      .references(() => utilisateurs.id, { onDelete: 'cascade' }),
    jetonCsrf: text('jeton_csrf').notNull(),
    expireLe: horodatage('expire_le').notNull(),
    creeLe: creeLe(),
  },
  (t) => [index('sessions_utilisateur_idx').on(t.utilisateurId)],
);

export const reinitialisations = pgTable('reinitialisations', {
  id: id(),
  utilisateurId: ref('utilisateur_id')
    .notNull()
    .references(() => utilisateurs.id, { onDelete: 'cascade' }),
  jetonHash: text('jeton_hash').notNull().unique(),
  expireLe: horodatage('expire_le').notNull(),
  utiliseLe: horodatage('utilise_le'),
  creeLe: creeLe(),
});

export const parametres = pgTable('parametres', {
  cle: text('cle').primaryKey(),
  valeur: jsonb('valeur').notNull(),
  modifiePar: ref('modifie_par'),
  majLe: majLe(),
});

// ---------------------------------------------------------------------------
// Comptes clients et postes places
// ---------------------------------------------------------------------------

export const comptesClients = pgTable('comptes_clients', {
  id: id(),
  nom: text('nom').notNull(),
  code: text('code').notNull().unique(), // identifiant court, ex. « masenz »
  pays: text('pays'),
  ville: text('ville'),
  fuseau: text('fuseau').notNull().default('Europe/Madrid'),
  /** Donneur d'ordre : seule autorite de validation cote client. */
  donneurOrdreNom: text('donneur_ordre_nom'),
  donneurOrdreEmail: text('donneur_ordre_email'),
  /** Manager AZMG qui pilote le compte. */
  managerId: ref('manager_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
  /** Horaires ouvres du compte (null : horaires generaux des parametres). */
  horaires: jsonb('horaires'),
  actif: boolean('actif').notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe(),
});

export const postes = pgTable(
  'postes',
  {
    id: id(),
    compteId: ref('compte_id')
      .notNull()
      .references(() => comptesClients.id, { onDelete: 'cascade' }),
    intitule: text('intitule').notNull(),
    collaborateurId: ref('collaborateur_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    actif: boolean('actif').notNull().default(true),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [index('postes_compte_idx').on(t.compteId), index('postes_collaborateur_idx').on(t.collaborateurId)],
);

// ---------------------------------------------------------------------------
// Dossiers : client x produit x operation
// ---------------------------------------------------------------------------

export const dossiers = pgTable(
  'dossiers',
  {
    id: id(),
    compteId: ref('compte_id')
      .notNull()
      .references(() => comptesClients.id, { onDelete: 'cascade' }),
    posteId: ref('poste_id').references(() => postes.id, { onDelete: 'set null' }),
    /** Client final du compte (ex. « LAM »), son pays, le produit et l'operation. */
    client: text('client').notNull(),
    pays: text('pays'),
    produit: text('produit'),
    operation: text('operation'),
    /** Cle de rapprochement normalisee (client|produit|operation) : evite les doublons a l'import. */
    cleRapprochement: text('cle_rapprochement').notNull(),
    libelle: text('libelle').notNull(),
    statut: text('statut').notNull().default('ouvert').$type<StatutDossier>(),
    /** Etat du dossier en une ligne, oriente resultat (tache IA `resumer_dossier`). */
    resume: text('resume'),
    /** References du dossier : facture, BL, AWB, PFI, booking. */
    references: jsonb('references').notNull().default({}),
    /** Montants approuves par la DO, par nature (devise comprise). */
    montantsApprouves: jsonb('montants_approuves').notNull().default({}),
    notes: text('notes'),
    clotureLe: horodatage('cloture_le'),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [
    uniqueIndex('dossiers_cle_idx').on(t.compteId, t.cleRapprochement),
    index('dossiers_compte_statut_idx').on(t.compteId, t.statut),
    index('dossiers_client_idx').on(t.client),
  ],
);

// ---------------------------------------------------------------------------
// Demandes : l'unite de travail
// ---------------------------------------------------------------------------

export const demandes = pgTable(
  'demandes',
  {
    id: id(),
    dossierId: ref('dossier_id')
      .notNull()
      .references(() => dossiers.id, { onDelete: 'cascade' }),
    compteId: ref('compte_id')
      .notNull()
      .references(() => comptesClients.id, { onDelete: 'cascade' }),
    posteId: ref('poste_id').references(() => postes.id, { onDelete: 'set null' }),
    famille: text('famille').notNull(),
    objet: text('objet').notNull(),
    /** Comment la demande est arrivee dans la GPAO. */
    origine: text('origine').notNull().default('saisie').$type<Source>(),
    statut: text('statut').notNull().default('nouveau').$type<Statut>(),
    /** Acteur dont on attend l'action : base du temps d'attente par acteur. */
    acteurAttendu: text('acteur_attendu').notNull().default('poste').$type<Acteur>(),
    priorite: text('priorite').notNull().default('normale').$type<Priorite>(),
    /** Echeance metier de la demande (distincte de l'echeance SLA). */
    echeanceLe: horodatage('echeance_le'),
    /** Cible SLA en heures ouvrees du client, et instant correspondant. */
    slaHeures: doublePrecision('sla_heures'),
    slaEcheanceLe: horodatage('sla_echeance_le'),
    niveauRelance: integer('niveau_relance').notNull().default(0),
    derniereRelanceLe: horodatage('derniere_relance_le'),
    /** Horodatages de cycle de vie, en instants UTC. */
    ouverteLe: horodatage('ouverte_le').notNull().defaultNow(),
    premiereReponseLe: horodatage('premiere_reponse_le'),
    dernierEvenementLe: horodatage('dernier_evenement_le'),
    termineeLe: horodatage('terminee_le'),
    /** Minutes ouvrees cumulees par statut et par acteur, recalculees a chaque transition. */
    minutesParStatut: jsonb('minutes_par_statut').notNull().default({}),
    minutesParActeur: jsonb('minutes_par_acteur').notNull().default({}),
    notes: text('notes'),
    creeParId: ref('cree_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [
    index('demandes_dossier_idx').on(t.dossierId),
    index('demandes_file_idx').on(t.compteId, t.statut, t.echeanceLe),
    index('demandes_poste_statut_idx').on(t.posteId, t.statut),
    index('demandes_famille_idx').on(t.famille),
  ],
);

// ---------------------------------------------------------------------------
// Evenements : mail, consigne, note, changement d'etat
// ---------------------------------------------------------------------------

export const evenements = pgTable(
  'evenements',
  {
    id: id(),
    demandeId: ref('demande_id').references(() => demandes.id, { onDelete: 'cascade' }),
    dossierId: ref('dossier_id').references(() => dossiers.id, { onDelete: 'cascade' }),
    compteId: ref('compte_id')
      .notNull()
      .references(() => comptesClients.id, { onDelete: 'cascade' }),
    sens: text('sens').notNull().$type<Sens>(),
    famille: text('famille'),
    nature: text('nature').notNull().$type<Nature>(),
    interlocuteur: text('interlocuteur').$type<Interlocuteur>(),
    source: text('source').notNull().$type<Source>(),
    /** Identifiants du fil et du message d'origine : dedoublonnage de la collecte (phase 4). */
    filId: text('fil_id'),
    messageId: text('message_id'),
    /**
     * Adresse de l'expediteur. Sert au typage par domaine (une regle peut viser un transitaire
     * connu) et a la proposition de regle apres une correction manuelle.
     */
    expediteur: text('expediteur'),
    destinataires: jsonb('destinataires').notNull().default([]),
    /** Horodatage d'origine du message, conserve tel quel (distinct de la date de saisie). */
    survenuLe: horodatage('survenu_le').notNull(),
    objet: text('objet'),
    resume: text('resume'),
    contenu: text('contenu'),
    /** Indice de confiance du typage automatique (0 a 1), null si type par un humain. */
    confianceTypage: doublePrecision('confiance_typage'),
    corrigeParId: ref('corrige_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    corrigeLe: horodatage('corrige_le'),
    /** Extraits justificatifs du typage automatique (jamais de remarque interne). */
    justificatifs: jsonb('justificatifs').notNull().default([]),
    creeParId: ref('cree_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
  },
  (t) => [
    index('evenements_demande_idx').on(t.demandeId, t.survenuLe),
    index('evenements_dossier_idx').on(t.dossierId, t.survenuLe),
    uniqueIndex('evenements_message_idx').on(t.messageId),
    index('evenements_compte_date_idx').on(t.compteId, t.survenuLe),
  ],
);

// ---------------------------------------------------------------------------
// Transitions de statut : une ligne par changement, horodatee et signee
// ---------------------------------------------------------------------------

export const transitionsStatut = pgTable(
  'transitions_statut',
  {
    id: id(),
    demandeId: ref('demande_id')
      .notNull()
      .references(() => demandes.id, { onDelete: 'cascade' }),
    statutAvant: text('statut_avant').$type<Statut>(),
    statutApres: text('statut_apres').notNull().$type<Statut>(),
    acteurAvant: text('acteur_avant').$type<Acteur>(),
    acteurApres: text('acteur_apres').notNull().$type<Acteur>(),
    /** Instant du changement : base de tous les calculs de temps par statut. */
    survenuLe: horodatage('survenu_le').notNull().defaultNow(),
    /** Minutes ouvrees passees dans le statut precedent (0 pour la premiere transition). */
    minutesOuvrees: integer('minutes_ouvrees').notNull().default(0),
    motif: text('motif'),
    evenementId: ref('evenement_id').references(() => evenements.id, { onDelete: 'set null' }),
    auteurId: ref('auteur_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    /** « humain », « systeme » ou « claude » (connecteur MCP). */
    auteurType: text('auteur_type').notNull().default('humain'),
    creeLe: creeLe(),
  },
  (t) => [index('transitions_demande_idx').on(t.demandeId, t.survenuLe)],
);

// ---------------------------------------------------------------------------
// Echeances, pieces
// ---------------------------------------------------------------------------

export const echeances = pgTable(
  'echeances',
  {
    id: id(),
    dossierId: ref('dossier_id')
      .notNull()
      .references(() => dossiers.id, { onDelete: 'cascade' }),
    demandeId: ref('demande_id').references(() => demandes.id, { onDelete: 'set null' }),
    type: text('type').notNull().$type<TypeEcheance>(),
    libelle: text('libelle'),
    echeanceLe: horodatage('echeance_le').notNull(),
    /** Phrase source de l'extraction automatique (tache IA `extraire_elements`). */
    phraseSource: text('phrase_source'),
    honoreeLe: horodatage('honoree_le'),
    annulee: boolean('annulee').notNull().default(false),
    creeParId: ref('cree_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [index('echeances_dossier_idx').on(t.dossierId), index('echeances_date_idx').on(t.echeanceLe, t.annulee)],
);

export const pieces = pgTable(
  'pieces',
  {
    id: id(),
    dossierId: ref('dossier_id')
      .notNull()
      .references(() => dossiers.id, { onDelete: 'cascade' }),
    demandeId: ref('demande_id').references(() => demandes.id, { onDelete: 'set null' }),
    evenementId: ref('evenement_id').references(() => evenements.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    reference: text('reference'),
    nomFichier: text('nom_fichier'),
    /** Chemin relatif au dossier de stockage, hors du dossier public. */
    chemin: text('chemin'),
    tailleOctets: integer('taille_octets'),
    empreinte: text('empreinte'),
    archive: boolean('archive').notNull().default(false),
    creeLe: creeLe(),
  },
  (t) => [index('pieces_dossier_idx').on(t.dossierId)],
);

// ---------------------------------------------------------------------------
// Check-lists avant envoi et controles
// ---------------------------------------------------------------------------

export const checklists = pgTable('checklists', {
  id: id(),
  compteId: ref('compte_id').references(() => comptesClients.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  libelle: text('libelle').notNull(),
  /** Points a verifier : [{ cle, libelle, obligatoire }]. */
  points: jsonb('points').notNull().default([]),
  familles: jsonb('familles').notNull().default([]),
  actif: boolean('actif').notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe(),
});

export const controlesEnvoi = pgTable(
  'controles_envoi',
  {
    id: id(),
    demandeId: ref('demande_id')
      .notNull()
      .references(() => demandes.id, { onDelete: 'cascade' }),
    checklistId: ref('checklist_id').references(() => checklists.id, { onDelete: 'set null' }),
    evenementId: ref('evenement_id').references(() => evenements.id, { onDelete: 'set null' }),
    /** Reponses point par point : { cle: boolean }. */
    reponses: jsonb('reponses').notNull().default({}),
    conforme: boolean('conforme').notNull(),
    commentaire: text('commentaire'),
    controleParId: ref('controle_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
  },
  (t) => [index('controles_envoi_demande_idx').on(t.demandeId)],
);

// ---------------------------------------------------------------------------
// Qualite
// ---------------------------------------------------------------------------

export const grillesQualite = pgTable('grilles_qualite', {
  id: id(),
  compteId: ref('compte_id').references(() => comptesClients.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  libelle: text('libelle').notNull(),
  familles: jsonb('familles').notNull().default([]),
  /** Criteres ponderes : [{ cle, libelle, poids }]. */
  criteres: jsonb('criteres').notNull().default([]),
  actif: boolean('actif').notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe(),
});

export const controlesQualite = pgTable(
  'controles_qualite',
  {
    id: id(),
    grilleId: ref('grille_id').references(() => grillesQualite.id, { onDelete: 'set null' }),
    demandeId: ref('demande_id')
      .notNull()
      .references(() => demandes.id, { onDelete: 'cascade' }),
    /** Semaine ISO du tirage (AAAA-Www). */
    semaine: text('semaine'),
    notes: jsonb('notes').notNull().default({}),
    note: numeric('note', { precision: 5, scale: 2 }),
    reprise: boolean('reprise').notNull().default(false),
    /** Document valide par la DO sans correction : « bon du premier coup ». */
    bonDuPremierCoup: boolean('bon_du_premier_coup'),
    commentaire: text('commentaire'),
    controleParId: ref('controle_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
  },
  (t) => [index('controles_qualite_demande_idx').on(t.demandeId), index('controles_qualite_semaine_idx').on(t.semaine)],
);

// ---------------------------------------------------------------------------
// Typage : regles et referentiels
// ---------------------------------------------------------------------------

export const reglesTypage = pgTable(
  'regles_typage',
  {
    id: id(),
    compteId: ref('compte_id').references(() => comptesClients.id, { onDelete: 'cascade' }),
    libelle: text('libelle').notNull(),
    /** Domaine de l'expediteur (ex. « transitaire.com »), null : toute adresse. */
    domaine: text('domaine'),
    /** Mots-cles de l'objet ou du corps, tous normalises. */
    motsCles: jsonb('mots_cles').notNull().default([]),
    famille: text('famille'),
    nature: text('nature').$type<Nature>(),
    interlocuteur: text('interlocuteur').$type<Interlocuteur>(),
    priorite: integer('priorite').notNull().default(50),
    actif: boolean('actif').notNull().default(true),
    /** Regle proposee par une correction manuelle, en attente de confirmation. */
    proposee: boolean('proposee').notNull().default(false),
    creeParId: ref('cree_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [index('regles_typage_priorite_idx').on(t.actif, t.priorite)],
);

/** Referentiels modifiables : familles, natures, statuts, interlocuteurs, SLA. */
export const referentiels = pgTable(
  'referentiels',
  {
    id: id(),
    type: text('type').notNull(),
    code: text('code').notNull(),
    libelle: text('libelle').notNull(),
    /** Donnees propres au type (validation, temps standard, SLA, correspondance reporting). */
    attributs: jsonb('attributs').notNull().default({}),
    ordre: integer('ordre').notNull().default(0),
    actif: boolean('actif').notNull().default(true),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [uniqueIndex('referentiels_type_code_idx').on(t.type, t.code)],
);

// ---------------------------------------------------------------------------
// File de traitements, taches IA, journal
// ---------------------------------------------------------------------------

export const jobsQueue = pgTable(
  'jobs_queue',
  {
    id: id(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    statut: text('statut').notNull().default('pending'),
    priorite: integer('priorite').notNull().default(50),
    executerA: horodatage('executer_a').notNull().defaultNow(),
    essais: integer('essais').notNull().default(0),
    essaisMax: integer('essais_max').notNull().default(5),
    derniereErreur: text('derniere_erreur'),
    cleDedoublonnage: text('cle_dedoublonnage').unique(),
    verrouilleLe: horodatage('verrouille_le'),
    verrouillePar: text('verrouille_par'),
    termineLe: horodatage('termine_le'),
    creeLe: creeLe(),
  },
  (t) => [index('jobs_queue_file_idx').on(t.statut, t.priorite, t.executerA)],
);

export const cronRuns = pgTable('cron_runs', {
  tache: text('tache').primaryKey(),
  dernierPassageLe: horodatage('dernier_passage_le'),
  dernierStatut: text('dernier_statut'),
  derniereErreur: text('derniere_erreur'),
  dureeMs: integer('duree_ms'),
  dernierePeriode: text('derniere_periode'),
});

export const aiTasks = pgTable(
  'ai_tasks',
  {
    id: id(),
    type: text('type').notNull(),
    versionPrompt: text('version_prompt').notNull(),
    entree: jsonb('entree').notNull(),
    empreinteEntree: text('empreinte_entree').notNull(),
    sortie: jsonb('sortie'),
    contexte: jsonb('contexte').notNull().default({}),
    statut: text('statut').notNull().default('en_attente'),
    priorite: integer('priorite').notNull().default(50),
    fournisseur: text('fournisseur'),
    essais: integer('essais').notNull().default(0),
    essaisMax: integer('essais_max').notNull().default(3),
    erreur: text('erreur'),
    verrouilleJusqua: horodatage('verrouille_jusqua'),
    termineLe: horodatage('termine_le'),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [index('ai_tasks_file_idx').on(t.statut, t.priorite, t.creeLe)],
);

export const journalActions = pgTable(
  'journal_actions',
  {
    id: id(),
    action: text('action').notNull(),
    utilisateurId: ref('utilisateur_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    /** « humain », « systeme » ou « claude » : trace exigee pour les outils MCP d'ecriture. */
    auteurType: text('auteur_type').notNull().default('humain'),
    entite: text('entite'),
    entiteId: ref('entite_id'),
    details: jsonb('details').notNull().default({}),
    creeLe: creeLe(),
  },
  (t) => [index('journal_actions_date_idx').on(t.creeLe), index('journal_actions_entite_idx').on(t.entite, t.entiteId)],
);

/**
 * Brouillons prepares par l'application (phase 5).
 *
 * Regle d'or de CLAUDE.md : l'IA prepare, l'humain envoie. Rien dans cette table ne part tout
 * seul : un brouillon est un texte a relire, que le poste copie dans son client de messagerie.
 * `sources` cite les evenements qui l'ont produit, pour qu'on puisse toujours verifier d'ou
 * vient une affirmation.
 */
export const brouillons = pgTable(
  'brouillons',
  {
    id: id(),
    compteId: ref('compte_id')
      .notNull()
      .references(() => comptesClients.id, { onDelete: 'cascade' }),
    /** `relance`, `daily`, `semaine`, `situation_client`, `comparatif_cotations`. */
    type: text('type').notNull(),
    dossierId: ref('dossier_id').references(() => dossiers.id, { onDelete: 'cascade' }),
    demandeId: ref('demande_id').references(() => demandes.id, { onDelete: 'cascade' }),
    titre: text('titre').notNull(),
    /** Texte pret a relire, deja filtre des tirets longs. */
    contenu: text('contenu').notNull(),
    /** Donnees structurees du brouillon (lignes d'un comparatif, indicateurs du daily). */
    donnees: jsonb('donnees').notNull().default({}),
    /** Identifiants des evenements cites, exigence de la section 10. */
    sources: jsonb('sources').notNull().default([]),
    /** `prepare`, `utilise` (le poste l'a envoye lui-meme), `ecarte`. */
    statut: text('statut').notNull().default('prepare'),
    /** Niveau de relance pour un brouillon de relance : 1, 2 ou 3. */
    niveau: integer('niveau'),
    /** Cle de regroupement : un seul brouillon du meme type par cible et par periode. */
    cleUnicite: text('cle_unicite').notNull().unique(),
    prepareLe: horodatage('prepare_le').notNull().defaultNow(),
    decideLe: horodatage('decide_le'),
    decideParId: ref('decide_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: creeLe(),
    majLe: majLe(),
  },
  (t) => [index('brouillons_compte_statut_idx').on(t.compteId, t.statut, t.type), index('brouillons_demande_idx').on(t.demandeId)],
);

/** Imports de classeurs : trace de ce qui a ete cree, pour un import rejouable sans doublon. */
export const imports = pgTable('imports', {
  id: id(),
  compteId: ref('compte_id')
    .notNull()
    .references(() => comptesClients.id, { onDelete: 'cascade' }),
  nomFichier: text('nom_fichier').notNull(),
  empreinte: text('empreinte').notNull(),
  /** Bilan : lignes lues, dossiers crees, dossiers mis a jour, lignes ignorees. */
  bilan: jsonb('bilan').notNull().default({}),
  jourDebut: date('jour_debut'),
  jourFin: date('jour_fin'),
  importeParId: ref('importe_par_id').references(() => utilisateurs.id, { onDelete: 'set null' }),
  creeLe: creeLe(),
});
