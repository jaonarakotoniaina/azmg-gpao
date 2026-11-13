"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc3) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc3 = __getOwnPropDesc(from, key)) || desc3.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server/charger-env.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var candidats = [process.env.AZMG_ENV_FILE, import_node_path.default.resolve(__dirname, "..", "..", ".env"), import_node_path.default.resolve(process.cwd(), ".env")].filter(Boolean);
var fichier = candidats.find((f) => import_node_fs.default.existsSync(f));
if (fichier && typeof process.loadEnvFile === "function" && !process.env.AZMG_ENV_CHARGE) {
  process.loadEnvFile(fichier);
  process.env.AZMG_ENV_CHARGE = "1";
}

// src/server/db/client.ts
var import_pg = require("pg");
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_migrator = require("drizzle-orm/node-postgres/migrator");

// src/server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiTasks: () => aiTasks,
  brouillons: () => brouillons,
  checklists: () => checklists,
  comptesClients: () => comptesClients,
  controlesEnvoi: () => controlesEnvoi,
  controlesQualite: () => controlesQualite,
  cronRuns: () => cronRuns,
  demandes: () => demandes,
  dossiers: () => dossiers,
  echeances: () => echeances,
  evenements: () => evenements,
  grillesQualite: () => grillesQualite,
  imports: () => imports,
  jobsQueue: () => jobsQueue,
  journalActions: () => journalActions,
  parametres: () => parametres,
  pieces: () => pieces,
  postes: () => postes,
  referentiels: () => referentiels,
  reglesTypage: () => reglesTypage,
  reinitialisations: () => reinitialisations,
  sessions: () => sessions,
  transitionsStatut: () => transitionsStatut,
  utilisateurs: () => utilisateurs
});
var import_pg_core = require("drizzle-orm/pg-core");
var id = () => (0, import_pg_core.bigserial)("id", { mode: "number" }).primaryKey();
var ref = (nom) => (0, import_pg_core.bigint)(nom, { mode: "number" });
var horodatage = (nom) => (0, import_pg_core.timestamp)(nom, { withTimezone: true, mode: "date" });
var creeLe = () => horodatage("created_at").notNull().defaultNow();
var majLe = () => horodatage("updated_at").notNull().defaultNow();
var utilisateurs = (0, import_pg_core.pgTable)("utilisateurs", {
  id: id(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  nom: (0, import_pg_core.text)("nom").notNull(),
  role: (0, import_pg_core.text)("role").notNull().$type(),
  motDePasseHash: (0, import_pg_core.text)("mot_de_passe_hash").notNull(),
  actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
  derniereConnexionLe: horodatage("derniere_connexion_le"),
  creeLe: creeLe(),
  majLe: majLe()
});
var sessions = (0, import_pg_core.pgTable)(
  "sessions",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    // empreinte SHA-256 du jeton de session
    utilisateurId: ref("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    jetonCsrf: (0, import_pg_core.text)("jeton_csrf").notNull(),
    expireLe: horodatage("expire_le").notNull(),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("sessions_utilisateur_idx").on(t.utilisateurId)]
);
var reinitialisations = (0, import_pg_core.pgTable)("reinitialisations", {
  id: id(),
  utilisateurId: ref("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  jetonHash: (0, import_pg_core.text)("jeton_hash").notNull().unique(),
  expireLe: horodatage("expire_le").notNull(),
  utiliseLe: horodatage("utilise_le"),
  creeLe: creeLe()
});
var parametres = (0, import_pg_core.pgTable)("parametres", {
  cle: (0, import_pg_core.text)("cle").primaryKey(),
  valeur: (0, import_pg_core.jsonb)("valeur").notNull(),
  modifiePar: ref("modifie_par"),
  majLe: majLe()
});
var comptesClients = (0, import_pg_core.pgTable)("comptes_clients", {
  id: id(),
  nom: (0, import_pg_core.text)("nom").notNull(),
  code: (0, import_pg_core.text)("code").notNull().unique(),
  // identifiant court, ex. « masenz »
  pays: (0, import_pg_core.text)("pays"),
  ville: (0, import_pg_core.text)("ville"),
  fuseau: (0, import_pg_core.text)("fuseau").notNull().default("Europe/Madrid"),
  /** Donneur d'ordre : seule autorite de validation cote client. */
  donneurOrdreNom: (0, import_pg_core.text)("donneur_ordre_nom"),
  donneurOrdreEmail: (0, import_pg_core.text)("donneur_ordre_email"),
  /**
   * Adresses du client a ne pas suivre. Un message qui ne concerne qu'elles n'est pas collecte
   * du tout : il ne cree ni evenement, ni dossier, ni demande. C'est plus net que de le classer
   * hors perimetre, qui laisse une trace a lire.
   */
  adressesIgnorees: (0, import_pg_core.jsonb)("adresses_ignorees").notNull().default([]),
  /** Manager AZMG qui pilote le compte. */
  managerId: ref("manager_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  /** Horaires ouvres du compte (null : horaires generaux des parametres). */
  horaires: (0, import_pg_core.jsonb)("horaires"),
  actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe()
});
var postes = (0, import_pg_core.pgTable)(
  "postes",
  {
    id: id(),
    compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
    intitule: (0, import_pg_core.text)("intitule").notNull(),
    collaborateurId: ref("collaborateur_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** Metier du poste : il pre-remplit les familles. `export`, `designer`, ... */
    metier: (0, import_pg_core.text)("metier").notNull().default("export"),
    /**
     * Adresses depuis lesquelles ce poste ecrit, souvent des adresses du client sur le meme
     * domaine que la donneuse d'ordre. Elles servent a deux choses : dire si un message part ou
     * arrive, et dire **a quel poste** il appartient quand le compte en porte plusieurs.
     */
    adresses: (0, import_pg_core.jsonb)("adresses").notNull().default([]),
    /** Familles du perimetre de ce poste. Vide : toutes les familles hors T00. */
    familles: (0, import_pg_core.jsonb)("familles").notNull().default([]),
    actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.index)("postes_compte_idx").on(t.compteId), (0, import_pg_core.index)("postes_collaborateur_idx").on(t.collaborateurId)]
);
var dossiers = (0, import_pg_core.pgTable)(
  "dossiers",
  {
    id: id(),
    compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
    posteId: ref("poste_id").references(() => postes.id, { onDelete: "set null" }),
    /** Client final du compte (ex. « LAM »), son pays, le produit et l'operation. */
    client: (0, import_pg_core.text)("client").notNull(),
    pays: (0, import_pg_core.text)("pays"),
    produit: (0, import_pg_core.text)("produit"),
    operation: (0, import_pg_core.text)("operation"),
    /** Cle de rapprochement normalisee (client|produit|operation) : evite les doublons a l'import. */
    cleRapprochement: (0, import_pg_core.text)("cle_rapprochement").notNull(),
    libelle: (0, import_pg_core.text)("libelle").notNull(),
    statut: (0, import_pg_core.text)("statut").notNull().default("ouvert").$type(),
    /** Etat du dossier en une ligne, oriente resultat (tache IA `resumer_dossier`). */
    resume: (0, import_pg_core.text)("resume"),
    /** References du dossier : facture, BL, AWB, PFI, booking. */
    references: (0, import_pg_core.jsonb)("references").notNull().default({}),
    /** Montants approuves par la DO, par nature (devise comprise). */
    montantsApprouves: (0, import_pg_core.jsonb)("montants_approuves").notNull().default({}),
    notes: (0, import_pg_core.text)("notes"),
    clotureLe: horodatage("cloture_le"),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [
    (0, import_pg_core.uniqueIndex)("dossiers_cle_idx").on(t.compteId, t.cleRapprochement),
    (0, import_pg_core.index)("dossiers_compte_statut_idx").on(t.compteId, t.statut),
    (0, import_pg_core.index)("dossiers_client_idx").on(t.client)
  ]
);
var demandes = (0, import_pg_core.pgTable)(
  "demandes",
  {
    id: id(),
    dossierId: ref("dossier_id").notNull().references(() => dossiers.id, { onDelete: "cascade" }),
    compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
    posteId: ref("poste_id").references(() => postes.id, { onDelete: "set null" }),
    famille: (0, import_pg_core.text)("famille").notNull(),
    objet: (0, import_pg_core.text)("objet").notNull(),
    /** Comment la demande est arrivee dans la GPAO. */
    origine: (0, import_pg_core.text)("origine").notNull().default("saisie").$type(),
    statut: (0, import_pg_core.text)("statut").notNull().default("nouveau").$type(),
    /** Acteur dont on attend l'action : base du temps d'attente par acteur. */
    acteurAttendu: (0, import_pg_core.text)("acteur_attendu").notNull().default("poste").$type(),
    priorite: (0, import_pg_core.text)("priorite").notNull().default("normale").$type(),
    /** Echeance metier de la demande (distincte de l'echeance SLA). */
    echeanceLe: horodatage("echeance_le"),
    /** Cible SLA en heures ouvrees du client, et instant correspondant. */
    slaHeures: (0, import_pg_core.doublePrecision)("sla_heures"),
    slaEcheanceLe: horodatage("sla_echeance_le"),
    /**
     * Cause d'une reprise, quand la demande en est une. Vide pour un travail ordinaire : seule
     * une demande qui revient a cause d'un manquement porte une cause.
     */
    cause: (0, import_pg_core.text)("cause").$type(),
    /** Vrai quand le suivi du manager a classe cette demande comme une reclamation. */
    reprise: (0, import_pg_core.boolean)("reprise").notNull().default(false),
    /**
     * Ligne d'origine du classeur de suivi, colonne par colonne.
     *
     * Les notes gardent un texte lisible, mais un tableau a besoin de champs separes : le type du
     * suivi, la demande telle qu'elle a ete ecrite, le commentaire et le lien vers le mail. On
     * conserve donc la ligne source plutot que de la reconstituer en relisant les notes.
     */
    suivi: (0, import_pg_core.jsonb)("suivi").notNull().default({}),
    niveauRelance: (0, import_pg_core.integer)("niveau_relance").notNull().default(0),
    derniereRelanceLe: horodatage("derniere_relance_le"),
    /** Horodatages de cycle de vie, en instants UTC. */
    ouverteLe: horodatage("ouverte_le").notNull().defaultNow(),
    premiereReponseLe: horodatage("premiere_reponse_le"),
    dernierEvenementLe: horodatage("dernier_evenement_le"),
    termineeLe: horodatage("terminee_le"),
    /** Minutes ouvrees cumulees par statut et par acteur, recalculees a chaque transition. */
    minutesParStatut: (0, import_pg_core.jsonb)("minutes_par_statut").notNull().default({}),
    minutesParActeur: (0, import_pg_core.jsonb)("minutes_par_acteur").notNull().default({}),
    notes: (0, import_pg_core.text)("notes"),
    creeParId: ref("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [
    (0, import_pg_core.index)("demandes_dossier_idx").on(t.dossierId),
    (0, import_pg_core.index)("demandes_file_idx").on(t.compteId, t.statut, t.echeanceLe),
    (0, import_pg_core.index)("demandes_poste_statut_idx").on(t.posteId, t.statut),
    (0, import_pg_core.index)("demandes_famille_idx").on(t.famille)
  ]
);
var evenements = (0, import_pg_core.pgTable)(
  "evenements",
  {
    id: id(),
    demandeId: ref("demande_id").references(() => demandes.id, { onDelete: "cascade" }),
    dossierId: ref("dossier_id").references(() => dossiers.id, { onDelete: "cascade" }),
    compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
    sens: (0, import_pg_core.text)("sens").notNull().$type(),
    famille: (0, import_pg_core.text)("famille"),
    nature: (0, import_pg_core.text)("nature").notNull().$type(),
    interlocuteur: (0, import_pg_core.text)("interlocuteur").$type(),
    source: (0, import_pg_core.text)("source").notNull().$type(),
    /** Identifiants du fil et du message d'origine : dedoublonnage de la collecte (phase 4). */
    filId: (0, import_pg_core.text)("fil_id"),
    messageId: (0, import_pg_core.text)("message_id"),
    /**
     * Lien vers le message dans sa boite d'origine, quand la source le fournit.
     *
     * L'identifiant RFC 5322 ne permet pas de construire une adresse Gmail : seul l'identifiant
     * interne de la boite le permet, et c'est le script de collecte qui le connait.
     */
    lienExterne: (0, import_pg_core.text)("lien_externe"),
    /**
     * Adresse de l'expediteur. Sert au typage par domaine (une regle peut viser un transitaire
     * connu) et a la proposition de regle apres une correction manuelle.
     */
    expediteur: (0, import_pg_core.text)("expediteur"),
    destinataires: (0, import_pg_core.jsonb)("destinataires").notNull().default([]),
    /** Horodatage d'origine du message, conserve tel quel (distinct de la date de saisie). */
    survenuLe: horodatage("survenu_le").notNull(),
    objet: (0, import_pg_core.text)("objet"),
    resume: (0, import_pg_core.text)("resume"),
    contenu: (0, import_pg_core.text)("contenu"),
    /** Indice de confiance du typage automatique (0 a 1), null si type par un humain. */
    confianceTypage: (0, import_pg_core.doublePrecision)("confiance_typage"),
    corrigeParId: ref("corrige_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    corrigeLe: horodatage("corrige_le"),
    /** Extraits justificatifs du typage automatique (jamais de remarque interne). */
    justificatifs: (0, import_pg_core.jsonb)("justificatifs").notNull().default([]),
    creeParId: ref("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe()
  },
  (t) => [
    (0, import_pg_core.index)("evenements_demande_idx").on(t.demandeId, t.survenuLe),
    (0, import_pg_core.index)("evenements_dossier_idx").on(t.dossierId, t.survenuLe),
    (0, import_pg_core.uniqueIndex)("evenements_message_idx").on(t.messageId),
    (0, import_pg_core.index)("evenements_compte_date_idx").on(t.compteId, t.survenuLe)
  ]
);
var transitionsStatut = (0, import_pg_core.pgTable)(
  "transitions_statut",
  {
    id: id(),
    demandeId: ref("demande_id").notNull().references(() => demandes.id, { onDelete: "cascade" }),
    statutAvant: (0, import_pg_core.text)("statut_avant").$type(),
    statutApres: (0, import_pg_core.text)("statut_apres").notNull().$type(),
    acteurAvant: (0, import_pg_core.text)("acteur_avant").$type(),
    acteurApres: (0, import_pg_core.text)("acteur_apres").notNull().$type(),
    /** Instant du changement : base de tous les calculs de temps par statut. */
    survenuLe: horodatage("survenu_le").notNull().defaultNow(),
    /** Minutes ouvrees passees dans le statut precedent (0 pour la premiere transition). */
    minutesOuvrees: (0, import_pg_core.integer)("minutes_ouvrees").notNull().default(0),
    motif: (0, import_pg_core.text)("motif"),
    evenementId: ref("evenement_id").references(() => evenements.id, { onDelete: "set null" }),
    auteurId: ref("auteur_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** « humain », « systeme » ou « claude » (connecteur MCP). */
    auteurType: (0, import_pg_core.text)("auteur_type").notNull().default("humain"),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("transitions_demande_idx").on(t.demandeId, t.survenuLe)]
);
var echeances = (0, import_pg_core.pgTable)(
  "echeances",
  {
    id: id(),
    dossierId: ref("dossier_id").notNull().references(() => dossiers.id, { onDelete: "cascade" }),
    demandeId: ref("demande_id").references(() => demandes.id, { onDelete: "set null" }),
    type: (0, import_pg_core.text)("type").notNull().$type(),
    libelle: (0, import_pg_core.text)("libelle"),
    echeanceLe: horodatage("echeance_le").notNull(),
    /** Phrase source de l'extraction automatique (tache IA `extraire_elements`). */
    phraseSource: (0, import_pg_core.text)("phrase_source"),
    honoreeLe: horodatage("honoree_le"),
    annulee: (0, import_pg_core.boolean)("annulee").notNull().default(false),
    creeParId: ref("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.index)("echeances_dossier_idx").on(t.dossierId), (0, import_pg_core.index)("echeances_date_idx").on(t.echeanceLe, t.annulee)]
);
var pieces = (0, import_pg_core.pgTable)(
  "pieces",
  {
    id: id(),
    dossierId: ref("dossier_id").notNull().references(() => dossiers.id, { onDelete: "cascade" }),
    demandeId: ref("demande_id").references(() => demandes.id, { onDelete: "set null" }),
    evenementId: ref("evenement_id").references(() => evenements.id, { onDelete: "set null" }),
    type: (0, import_pg_core.text)("type").notNull(),
    reference: (0, import_pg_core.text)("reference"),
    nomFichier: (0, import_pg_core.text)("nom_fichier"),
    /** Chemin relatif au dossier de stockage, hors du dossier public. */
    chemin: (0, import_pg_core.text)("chemin"),
    tailleOctets: (0, import_pg_core.integer)("taille_octets"),
    empreinte: (0, import_pg_core.text)("empreinte"),
    archive: (0, import_pg_core.boolean)("archive").notNull().default(false),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("pieces_dossier_idx").on(t.dossierId)]
);
var checklists = (0, import_pg_core.pgTable)("checklists", {
  id: id(),
  compteId: ref("compte_id").references(() => comptesClients.id, { onDelete: "cascade" }),
  code: (0, import_pg_core.text)("code").notNull(),
  libelle: (0, import_pg_core.text)("libelle").notNull(),
  /** Points a verifier : [{ cle, libelle, obligatoire }]. */
  points: (0, import_pg_core.jsonb)("points").notNull().default([]),
  familles: (0, import_pg_core.jsonb)("familles").notNull().default([]),
  actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe()
});
var controlesEnvoi = (0, import_pg_core.pgTable)(
  "controles_envoi",
  {
    id: id(),
    demandeId: ref("demande_id").notNull().references(() => demandes.id, { onDelete: "cascade" }),
    checklistId: ref("checklist_id").references(() => checklists.id, { onDelete: "set null" }),
    evenementId: ref("evenement_id").references(() => evenements.id, { onDelete: "set null" }),
    /** Reponses point par point : { cle: boolean }. */
    reponses: (0, import_pg_core.jsonb)("reponses").notNull().default({}),
    conforme: (0, import_pg_core.boolean)("conforme").notNull(),
    commentaire: (0, import_pg_core.text)("commentaire"),
    controleParId: ref("controle_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("controles_envoi_demande_idx").on(t.demandeId)]
);
var grillesQualite = (0, import_pg_core.pgTable)("grilles_qualite", {
  id: id(),
  compteId: ref("compte_id").references(() => comptesClients.id, { onDelete: "cascade" }),
  code: (0, import_pg_core.text)("code").notNull(),
  libelle: (0, import_pg_core.text)("libelle").notNull(),
  familles: (0, import_pg_core.jsonb)("familles").notNull().default([]),
  /** Criteres ponderes : [{ cle, libelle, poids }]. */
  criteres: (0, import_pg_core.jsonb)("criteres").notNull().default([]),
  actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
  creeLe: creeLe(),
  majLe: majLe()
});
var controlesQualite = (0, import_pg_core.pgTable)(
  "controles_qualite",
  {
    id: id(),
    grilleId: ref("grille_id").references(() => grillesQualite.id, { onDelete: "set null" }),
    demandeId: ref("demande_id").notNull().references(() => demandes.id, { onDelete: "cascade" }),
    /** Semaine ISO du tirage (AAAA-Www). */
    semaine: (0, import_pg_core.text)("semaine"),
    notes: (0, import_pg_core.jsonb)("notes").notNull().default({}),
    note: (0, import_pg_core.numeric)("note", { precision: 5, scale: 2 }),
    reprise: (0, import_pg_core.boolean)("reprise").notNull().default(false),
    /** Document valide par la DO sans correction : « bon du premier coup ». */
    bonDuPremierCoup: (0, import_pg_core.boolean)("bon_du_premier_coup"),
    commentaire: (0, import_pg_core.text)("commentaire"),
    controleParId: ref("controle_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("controles_qualite_demande_idx").on(t.demandeId), (0, import_pg_core.index)("controles_qualite_semaine_idx").on(t.semaine)]
);
var reglesTypage = (0, import_pg_core.pgTable)(
  "regles_typage",
  {
    id: id(),
    compteId: ref("compte_id").references(() => comptesClients.id, { onDelete: "cascade" }),
    libelle: (0, import_pg_core.text)("libelle").notNull(),
    /** Domaine de l'expediteur (ex. « transitaire.com »), null : toute adresse. */
    domaine: (0, import_pg_core.text)("domaine"),
    /** Mots-cles de l'objet ou du corps, tous normalises. */
    motsCles: (0, import_pg_core.jsonb)("mots_cles").notNull().default([]),
    famille: (0, import_pg_core.text)("famille"),
    nature: (0, import_pg_core.text)("nature").$type(),
    interlocuteur: (0, import_pg_core.text)("interlocuteur").$type(),
    priorite: (0, import_pg_core.integer)("priorite").notNull().default(50),
    actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
    /** Regle proposee par une correction manuelle, en attente de confirmation. */
    proposee: (0, import_pg_core.boolean)("proposee").notNull().default(false),
    creeParId: ref("cree_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.index)("regles_typage_priorite_idx").on(t.actif, t.priorite)]
);
var referentiels = (0, import_pg_core.pgTable)(
  "referentiels",
  {
    id: id(),
    type: (0, import_pg_core.text)("type").notNull(),
    code: (0, import_pg_core.text)("code").notNull(),
    libelle: (0, import_pg_core.text)("libelle").notNull(),
    /** Donnees propres au type (validation, temps standard, SLA, correspondance reporting). */
    attributs: (0, import_pg_core.jsonb)("attributs").notNull().default({}),
    ordre: (0, import_pg_core.integer)("ordre").notNull().default(0),
    actif: (0, import_pg_core.boolean)("actif").notNull().default(true),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.uniqueIndex)("referentiels_type_code_idx").on(t.type, t.code)]
);
var jobsQueue = (0, import_pg_core.pgTable)(
  "jobs_queue",
  {
    id: id(),
    type: (0, import_pg_core.text)("type").notNull(),
    payload: (0, import_pg_core.jsonb)("payload").notNull().default({}),
    statut: (0, import_pg_core.text)("statut").notNull().default("pending"),
    priorite: (0, import_pg_core.integer)("priorite").notNull().default(50),
    executerA: horodatage("executer_a").notNull().defaultNow(),
    essais: (0, import_pg_core.integer)("essais").notNull().default(0),
    essaisMax: (0, import_pg_core.integer)("essais_max").notNull().default(5),
    derniereErreur: (0, import_pg_core.text)("derniere_erreur"),
    cleDedoublonnage: (0, import_pg_core.text)("cle_dedoublonnage").unique(),
    verrouilleLe: horodatage("verrouille_le"),
    verrouillePar: (0, import_pg_core.text)("verrouille_par"),
    termineLe: horodatage("termine_le"),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("jobs_queue_file_idx").on(t.statut, t.priorite, t.executerA)]
);
var cronRuns = (0, import_pg_core.pgTable)("cron_runs", {
  tache: (0, import_pg_core.text)("tache").primaryKey(),
  dernierPassageLe: horodatage("dernier_passage_le"),
  dernierStatut: (0, import_pg_core.text)("dernier_statut"),
  derniereErreur: (0, import_pg_core.text)("derniere_erreur"),
  dureeMs: (0, import_pg_core.integer)("duree_ms"),
  dernierePeriode: (0, import_pg_core.text)("derniere_periode")
});
var aiTasks = (0, import_pg_core.pgTable)(
  "ai_tasks",
  {
    id: id(),
    type: (0, import_pg_core.text)("type").notNull(),
    versionPrompt: (0, import_pg_core.text)("version_prompt").notNull(),
    entree: (0, import_pg_core.jsonb)("entree").notNull(),
    empreinteEntree: (0, import_pg_core.text)("empreinte_entree").notNull(),
    sortie: (0, import_pg_core.jsonb)("sortie"),
    contexte: (0, import_pg_core.jsonb)("contexte").notNull().default({}),
    statut: (0, import_pg_core.text)("statut").notNull().default("en_attente"),
    priorite: (0, import_pg_core.integer)("priorite").notNull().default(50),
    fournisseur: (0, import_pg_core.text)("fournisseur"),
    essais: (0, import_pg_core.integer)("essais").notNull().default(0),
    essaisMax: (0, import_pg_core.integer)("essais_max").notNull().default(3),
    erreur: (0, import_pg_core.text)("erreur"),
    verrouilleJusqua: horodatage("verrouille_jusqua"),
    termineLe: horodatage("termine_le"),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.index)("ai_tasks_file_idx").on(t.statut, t.priorite, t.creeLe)]
);
var journalActions = (0, import_pg_core.pgTable)(
  "journal_actions",
  {
    id: id(),
    action: (0, import_pg_core.text)("action").notNull(),
    utilisateurId: ref("utilisateur_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    /** « humain », « systeme » ou « claude » : trace exigee pour les outils MCP d'ecriture. */
    auteurType: (0, import_pg_core.text)("auteur_type").notNull().default("humain"),
    entite: (0, import_pg_core.text)("entite"),
    entiteId: ref("entite_id"),
    details: (0, import_pg_core.jsonb)("details").notNull().default({}),
    creeLe: creeLe()
  },
  (t) => [(0, import_pg_core.index)("journal_actions_date_idx").on(t.creeLe), (0, import_pg_core.index)("journal_actions_entite_idx").on(t.entite, t.entiteId)]
);
var brouillons = (0, import_pg_core.pgTable)(
  "brouillons",
  {
    id: id(),
    compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
    /** `relance`, `daily`, `semaine`, `situation_client`, `comparatif_cotations`. */
    type: (0, import_pg_core.text)("type").notNull(),
    dossierId: ref("dossier_id").references(() => dossiers.id, { onDelete: "cascade" }),
    demandeId: ref("demande_id").references(() => demandes.id, { onDelete: "cascade" }),
    titre: (0, import_pg_core.text)("titre").notNull(),
    /** Texte pret a relire, deja filtre des tirets longs. */
    contenu: (0, import_pg_core.text)("contenu").notNull(),
    /** Donnees structurees du brouillon (lignes d'un comparatif, indicateurs du daily). */
    donnees: (0, import_pg_core.jsonb)("donnees").notNull().default({}),
    /** Identifiants des evenements cites, exigence de la section 10. */
    sources: (0, import_pg_core.jsonb)("sources").notNull().default([]),
    /** `prepare`, `utilise` (le poste l'a envoye lui-meme), `ecarte`. */
    statut: (0, import_pg_core.text)("statut").notNull().default("prepare"),
    /** Niveau de relance pour un brouillon de relance : 1, 2 ou 3. */
    niveau: (0, import_pg_core.integer)("niveau"),
    /** Cle de regroupement : un seul brouillon du meme type par cible et par periode. */
    cleUnicite: (0, import_pg_core.text)("cle_unicite").notNull().unique(),
    prepareLe: horodatage("prepare_le").notNull().defaultNow(),
    decideLe: horodatage("decide_le"),
    decideParId: ref("decide_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
    creeLe: creeLe(),
    majLe: majLe()
  },
  (t) => [(0, import_pg_core.index)("brouillons_compte_statut_idx").on(t.compteId, t.statut, t.type), (0, import_pg_core.index)("brouillons_demande_idx").on(t.demandeId)]
);
var imports = (0, import_pg_core.pgTable)("imports", {
  id: id(),
  compteId: ref("compte_id").notNull().references(() => comptesClients.id, { onDelete: "cascade" }),
  nomFichier: (0, import_pg_core.text)("nom_fichier").notNull(),
  empreinte: (0, import_pg_core.text)("empreinte").notNull(),
  /** Bilan : lignes lues, dossiers crees, dossiers mis a jour, lignes ignorees. */
  bilan: (0, import_pg_core.jsonb)("bilan").notNull().default({}),
  jourDebut: (0, import_pg_core.date)("jour_debut"),
  jourFin: (0, import_pg_core.date)("jour_fin"),
  importeParId: ref("importe_par_id").references(() => utilisateurs.id, { onDelete: "set null" }),
  creeLe: creeLe()
});

// src/server/config.ts
var import_node_path2 = __toESM(require("node:path"));
function lire(nom, defaut = "") {
  const brut = process.env[nom];
  if (brut === void 0) return defaut;
  const v = brut.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return v === "" ? defaut : v;
}
function lireBool(nom, defaut = false) {
  const v = process.env[nom];
  if (v === void 0 || v === "") return defaut;
  return ["1", "true", "oui", "yes"].includes(v.toLowerCase());
}
function lireEntier(nom, defaut) {
  const v = Number(process.env[nom]);
  return Number.isFinite(v) && process.env[nom] !== "" && process.env[nom] !== void 0 ? v : defaut;
}
function construire() {
  const env = lire("NODE_ENV", "development");
  const production = env === "production";
  const test = env === "test";
  const racine = import_node_path2.default.resolve(__dirname, "..", "..");
  const cleAnthropic = lire("ANTHROPIC_API_KEY");
  const jetonAgent = lire("AGENT_API_TOKEN", production ? "" : "jeton-agent-developpement");
  const fournisseurDemande = lire("AI_PROVIDER");
  let fournisseurIa;
  if (fournisseurDemande === "api") fournisseurIa = cleAnthropic ? "api" : "mock";
  else if (fournisseurDemande === "agent") fournisseurIa = jetonAgent ? "agent" : "mock";
  else if (fournisseurDemande === "mock") fournisseurIa = "mock";
  else fournisseurIa = production && jetonAgent ? "agent" : "mock";
  const collecteDemandee = lire("COLLECTE_MAIL");
  const secretAppsScript = lire("APPS_SCRIPT_SECRET");
  const imapConfigure = Boolean(lire("IMAP_HOST") && lire("IMAP_PASSWORD"));
  let collecteMail;
  if (test) collecteMail = "mock";
  else if (collecteDemandee === "apps_script") collecteMail = secretAppsScript ? "apps_script" : "mock";
  else if (collecteDemandee === "imap") collecteMail = imapConfigure ? "imap" : "mock";
  else if (secretAppsScript) collecteMail = "apps_script";
  else if (imapConfigure) collecteMail = "imap";
  else collecteMail = "mock";
  const smtpMode = lire("SMTP_HOST") && !test ? "real" : "mock";
  return {
    env,
    production,
    test,
    racine,
    port: lireEntier("PORT", 3e3),
    trustProxy: lireBool("TRUST_PROXY", production),
    databaseUrl: lire(
      "DATABASE_URL",
      test ? "postgresql://azmg:azmg@localhost:5432/azmg_gpao_test" : "postgresql://azmg:azmg@localhost:5432/azmg_gpao_dev"
    ),
    databaseSsl: lireBool("DATABASE_SSL", false),
    sessionSecret: lire("SESSION_SECRET", production ? "" : "secret-de-developpement-a-changer-absolument"),
    url: lire("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
    stockage: import_node_path2.default.resolve(racine, lire("STORAGE_DIR", test ? "storage/test" : "storage")),
    /** Fuseau d'affichage de l'interface : le poste travaille a Antananarivo. */
    fuseau: "Indian/Antananarivo",
    agent: { jeton: jetonAgent },
    /** Connecteur Claude (MCP) : cle d'au moins 32 caracteres, sinon /mcp reste ferme. */
    mcp: {
      jeton: lire("AZMG_MCP_TOKEN", test ? "cle-connecteur-claude-des-tests-0123456789" : "").trim(),
      utilisateur: lire("AZMG_MCP_UTILISATEUR", "").trim().toLowerCase()
    },
    ia: {
      fournisseur: fournisseurIa,
      cleApi: cleAnthropic,
      modeleRapide: lire("ANTHROPIC_MODEL_FAST"),
      modeleIntelligent: lire("ANTHROPIC_MODEL_SMART"),
      timeoutMs: lireEntier("AI_TIMEOUT_MS", 9e4)
    },
    collecte: {
      mode: collecteMail,
      secretAppsScript,
      imap: {
        hote: lire("IMAP_HOST"),
        port: lireEntier("IMAP_PORT", 993),
        securise: lireBool("IMAP_SECURE", true),
        utilisateur: lire("IMAP_USER"),
        motDePasse: lire("IMAP_PASSWORD"),
        dossier: lire("IMAP_FOLDER", "INBOX")
      }
    },
    smtp: {
      mode: smtpMode,
      hote: lire("SMTP_HOST"),
      port: lireEntier("SMTP_PORT", 465),
      securise: lireBool("SMTP_SECURE", true),
      utilisateur: lire("SMTP_USER"),
      motDePasse: lire("SMTP_PASSWORD"),
      expediteur: lire("SMTP_FROM", "AZMG GPAO <gpao@azmg-solutions.com>")
    },
    emailAlerte: lire("ALERT_EMAIL"),
    cronEnProcessus: lireBool("CRON_INPROCESS", false),
    seedDemo: lireBool("SEED_DEMO", !production),
    /** Taille maximale d'un classeur importe. */
    tailleMaxImportOctets: lireEntier("IMPORT_MAX_BYTES", 15 * 1024 * 1024)
  };
}
var config = construire();

// src/server/db/client.ts
var pool = null;
var instance = null;
function getPool() {
  if (!pool) {
    pool = new import_pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: config.production ? 5 : 10
    });
    pool.on("error", () => {
    });
  }
  return pool;
}
function getDb() {
  if (!instance) instance = (0, import_node_postgres.drizzle)(getPool(), { schema: schema_exports });
  return instance;
}
var db = new Proxy({}, {
  get(_cible, prop) {
    return getDb()[prop];
  }
});
async function fermerDb() {
  if (pool) await pool.end();
  pool = null;
  instance = null;
}

// src/server/taches-periodiques.ts
var import_drizzle_orm6 = require("drizzle-orm");

// src/server/lib/file.ts
var import_drizzle_orm = require("drizzle-orm");
var import_node_os = __toESM(require("node:os"));

// src/server/lib/journal.ts
var EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
var TELEPHONE = /(?<![\d-])(\+\d{2,3}|00\d{2,3}|0)[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{3}[\s.]?\d{2}(?!\d)/g;
function masquer(texte) {
  return texte.replace(EMAIL, "[email]").replace(TELEPHONE, "[telephone]");
}
var ordre = { debug: 10, info: 20, warn: 30, error: 40 };
function ecrire(niveau, message, details) {
  const seuil = process.env.LOG_LEVEL || (config.test ? "warn" : "info");
  if (ordre[niveau] < ordre[seuil]) return;
  const ligne = masquer(JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), niveau, message, ...details ?? {} }));
  if (niveau === "error" || niveau === "warn") console.error(ligne);
  else process.stdout.write(ligne + "\n");
}
var journal = {
  debug: (m, d) => ecrire("debug", m, d),
  info: (m, d) => ecrire("info", m, d),
  warn: (m, d) => ecrire("warn", m, d),
  error: (m, d) => ecrire("error", m, d)
};
function messageErreur(e) {
  return e instanceof Error ? e.message : String(e);
}

// src/server/lib/evenements.ts
async function journaliser(action, opts = {}) {
  await db.insert(schema_exports.journalActions).values({
    action,
    utilisateurId: opts.utilisateurId ?? null,
    auteurType: opts.auteurType ?? "humain",
    entite: opts.entite ?? null,
    entiteId: opts.entiteId ?? null,
    details: opts.details ?? {}
  });
}

// src/server/lib/file.ts
var gestionnaires = /* @__PURE__ */ new Map();
function enregistrerGestionnaire(type, fn) {
  gestionnaires.set(type, fn);
}
function delaiReprise(essai) {
  return Math.min(60 * 60 * 1e3, 3e4 * 2 ** Math.max(0, essai - 1));
}
var DUREE_MAX_TRAITEMENT_MS = 2 * 6e4;
var MINUTES_AVANT_INTERRUPTION = 6;
var MESSAGE_INTERRUPTION = "Traitement interrompu (processus arrete par l'hebergeur : delai depasse ou memoire insuffisante)";
async function recupererTachesBloquees(minutes = MINUTES_AVANT_INTERRUPTION) {
  const res = await db.execute(import_drizzle_orm.sql`
    SELECT id, type, payload, essais, essais_max AS "essaisMax" FROM jobs_queue
    WHERE statut = 'running' AND verrouille_le < now() - make_interval(mins => ${minutes}::int)`);
  const lignes = res.rows;
  for (const t of lignes) {
    const id2 = Number(t.id);
    if (t.essais < t.essaisMax) {
      await db.execute(import_drizzle_orm.sql`
        UPDATE jobs_queue SET statut = 'failed', verrouille_le = NULL, verrouille_par = NULL,
          derniere_erreur = ${MESSAGE_INTERRUPTION}, executer_a = ${new Date(Date.now() + delaiReprise(t.essais))}
        WHERE id = ${id2} AND statut = 'running'`);
      continue;
    }
    await db.execute(import_drizzle_orm.sql`
      UPDATE jobs_queue SET statut = 'dead', verrouille_le = NULL, verrouille_par = NULL, termine_le = now(),
        derniere_erreur = ${MESSAGE_INTERRUPTION}
      WHERE id = ${id2} AND statut = 'running'`);
    await journaliser("tache_abandonnee", {
      auteurType: "systeme",
      entite: "jobs_queue",
      entiteId: id2,
      details: { type: t.type, erreur: MESSAGE_INTERRUPTION }
    });
  }
  return lignes.length;
}
function avecDelai(promesse, ms) {
  let minuteur;
  const delai = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`Traitement trop long (plus de ${Math.round(ms / 1e3)} s)`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
async function prendreTache(ouvrier) {
  const res = await db.execute(import_drizzle_orm.sql`
    UPDATE jobs_queue SET statut = 'running', verrouille_le = now(), verrouille_par = ${ouvrier}, essais = essais + 1
    WHERE id = (
      SELECT id FROM jobs_queue
      WHERE statut IN ('pending', 'failed') AND executer_a <= now()
      ORDER BY priorite ASC, executer_a ASC, id ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, essais, essais_max AS "essaisMax"`);
  return res.rows[0] ?? null;
}
async function traiterFile(opts = {}) {
  const limite = opts.limite ?? 200;
  const fin = Date.now() + (opts.budgetMs ?? 4 * 60 * 1e3);
  const ouvrier = `${import_node_os.default.hostname()}:${process.pid}`;
  const bilan = { traitees: 0, erreurs: 0 };
  try {
    await recupererTachesBloquees();
  } catch (e) {
    journal.error("Recuperation des traitements interrompus impossible", { erreur: messageErreur(e) });
  }
  while (bilan.traitees + bilan.erreurs < limite && Date.now() < fin) {
    const tache = await prendreTache(ouvrier);
    if (!tache) break;
    const id2 = Number(tache.id);
    const fn = gestionnaires.get(tache.type);
    try {
      if (!fn) throw new Error(`Aucun gestionnaire pour le type \xAB ${tache.type} \xBB`);
      await avecDelai(fn(tache.payload, { id: id2, essais: tache.essais }), opts.dureeMaxTraitementMs ?? DUREE_MAX_TRAITEMENT_MS);
      await db.execute(import_drizzle_orm.sql`UPDATE jobs_queue SET statut = 'done', termine_le = now(), verrouille_le = NULL, derniere_erreur = NULL WHERE id = ${id2}`);
      bilan.traitees++;
    } catch (e) {
      bilan.erreurs++;
      const message = messageErreur(e).slice(0, 2e3);
      const definitif = tache.essais >= tache.essaisMax;
      journal.warn("Echec de tache", { type: tache.type, id: id2, essai: tache.essais, definitif, erreur: message });
      await db.execute(import_drizzle_orm.sql`
        UPDATE jobs_queue SET statut = ${definitif ? "dead" : "failed"}, verrouille_le = NULL, derniere_erreur = ${message},
          executer_a = ${new Date(Date.now() + delaiReprise(tache.essais))}
        WHERE id = ${id2}`);
      if (definitif) {
        await journaliser("tache_abandonnee", {
          auteurType: "systeme",
          entite: "jobs_queue",
          entiteId: id2,
          details: { type: tache.type, erreur: message }
        });
      }
    }
  }
  return bilan;
}

// src/server/modules/index.ts
enregistrerGestionnaire("ping", async (payload) => {
  journal.info("Tache ping traitee", { payload });
});

// src/server/modules/brouillons/service.ts
var import_drizzle_orm5 = require("drizzle-orm");
var import_luxon3 = require("luxon");

// src/server/lib/parametres.ts
var import_drizzle_orm2 = require("drizzle-orm");

// src/shared/parametres.ts
var import_zod = require("zod");

// src/shared/constantes.ts
var FAMILLES = [
  { code: "T00", libelle: "Hors perimetre (notifications systeme, infolettres, spam)", validation: "exclu du pilotage", horsPerimetre: true, tempsStandardMinutes: 0, slaHeures: 0 },
  { code: "T01", libelle: "Cotations fret et relances transitaires (FCL, LCL, aerien)", validation: "la DO valide transitaire, prix et booking", tempsStandardMinutes: 25, slaHeures: 8 },
  { code: "T02", libelle: "Enlevements, transport local, documents d'expedition (BL, PL, AWB, shipping marks)", validation: "le client valide, la DO pour les exceptions", tempsStandardMinutes: 30, slaHeures: 8 },
  { code: "T03", libelle: "Proformas, factures, modifications, pre-domiciliation", validation: "la DO valide chaque modification", tempsStandardMinutes: 20, slaHeures: 8 },
  { code: "T04", libelle: "Relances clients, paiements, SWIFT, soldes, pieces manquantes", validation: "aucune", tempsStandardMinutes: 15, slaHeures: 16 },
  { code: "T05", libelle: "Reglementaire : enregistrement pays, FSC, GMP, COC, legalisation", validation: "la DO et l'autorite du pays", tempsStandardMinutes: 40, slaHeures: 24 },
  { code: "T06", libelle: "Tableaux de situation par client ou pays", validation: "la DO", tempsStandardMinutes: 35, slaHeures: 24 },
  { code: "T07", libelle: "COA, BAT, etiquettes, echantillons avec la Qualite", validation: "la Qualite et le client", tempsStandardMinutes: 30, slaHeures: 24 },
  { code: "T08", libelle: "Leads, catalogue, offres, Clientify", validation: "la DO pour les prix et le MOQ", tempsStandardMinutes: 20, slaHeures: 24 },
  { code: "T09", libelle: "Reporting quotidien", validation: "la DO lit", tempsStandardMinutes: 25, slaHeures: 8 },
  { code: "T10", libelle: "Stagiaires : onboarding, instructions, evaluations", validation: "la DO", tempsStandardMinutes: 20, slaHeures: 24 },
  { code: "T11", libelle: "Salons : acces, rendez-vous, saisie de contacts", validation: "la DO", tempsStandardMinutes: 20, slaHeures: 24 },
  { code: "T12", libelle: "Lettres d'invitation et courriers types", validation: "signature de la DO", tempsStandardMinutes: 15, slaHeures: 16 },
  { code: "T13", libelle: "Transferts a la DO pour decision", validation: "la DO", tempsStandardMinutes: 10, slaHeures: 4 },
  { code: "T14", libelle: "Tracking, transporteurs express, surestaries", validation: "aucune", tempsStandardMinutes: 10, slaHeures: 8 },
  // Familles du poste de designer. Elles etaient confondues avec T00 tant qu'un seul poste etait
  // pilote : le travail de la designer etait hors du perimetre de l'assistante export, et donc
  // hors de tout. Il a desormais ses propres familles, et son propre poste.
  { code: "D01", libelle: "Publications et reseaux sociaux (LinkedIn, pages)", validation: "la DO valide avant publication", tempsStandardMinutes: 30, slaHeures: 16 },
  { code: "D02", libelle: "Visuels et supports (brochures, bannieres, PLV, packaging)", validation: "la DO valide le visuel", tempsStandardMinutes: 45, slaHeures: 24 },
  { code: "D03", libelle: "Catalogue, fiches produits et contenus marketing", validation: "la DO pour les textes et les prix", tempsStandardMinutes: 40, slaHeures: 24 }
];
var CODES_FAMILLES = FAMILLES.map((f) => f.code);
var FAMILLE_HORS_PERIMETRE = "T00";
var FAMILLES_PILOTAGE = FAMILLES.filter((f) => !f.horsPerimetre);
var DEFINITIONS_STATUTS = [
  { code: "nouveau", libelle: "Nouveau", reporting: "En cours", acteur: "poste", fermee: false },
  { code: "en_cours", libelle: "En cours", reporting: "En cours", acteur: "poste", fermee: false },
  { code: "attente_tiers", libelle: "En attente client / tiers", reporting: "En attente client", acteur: "client", fermee: false },
  { code: "attente_do", libelle: "En attente DO", reporting: "En cours", mention: "validation DO attendue", acteur: "do", fermee: false },
  { code: "bloque", libelle: "Bloque", reporting: "Bloque", acteur: "poste", fermee: false },
  { code: "termine", libelle: "Termine", reporting: "Termine", acteur: "aucun", fermee: true },
  { code: "annule", libelle: "Annule", reporting: "Annule", acteur: "aucun", fermee: true }
];
function definitionStatut(code) {
  return DEFINITIONS_STATUTS.find((s) => s.code === code);
}
function statutReporting(code) {
  return definitionStatut(code)?.reporting ?? "En cours";
}
var STATUTS_OUVERTS = DEFINITIONS_STATUTS.filter((s) => !s.fermee).map((s) => s.code);
var STATUTS_FERMES = DEFINITIONS_STATUTS.filter((s) => s.fermee).map((s) => s.code);
function estFerme(statut) {
  return STATUTS_FERMES.includes(statut);
}

// src/shared/heures-ouvrees.ts
var import_luxon = require("luxon");
var FUSEAU_TANA = "Indian/Antananarivo";
var FUSEAU_CLIENT_DEFAUT = "Europe/Madrid";
var HORAIRES_PAR_DEFAUT = {
  fuseau: FUSEAU_CLIENT_DEFAUT,
  semaine: {
    1: [{ debut: "09:00", fin: "18:00" }],
    2: [{ debut: "09:00", fin: "18:00" }],
    3: [{ debut: "09:00", fin: "18:00" }],
    4: [{ debut: "09:00", fin: "18:00" }],
    5: [{ debut: "09:00", fin: "18:00" }]
  },
  feriesClient: [],
  feriesLocaux: [],
  feriesCollaborateur: false
};
function paques(annee, fuseau) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = (h + l - 7 * m + 114) % 31 + 1;
  return import_luxon.DateTime.fromObject({ year: annee, month: mois, day: jour }, { zone: fuseau });
}
function joursFeriesEspagne(annee) {
  const fixes = ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"].map((j) => `${annee}-${j}`);
  const p = paques(annee, FUSEAU_CLIENT_DEFAUT);
  const mobiles = [p.minus({ days: 2 }).toISODate()];
  return [...fixes, ...mobiles].sort();
}
function joursFeriesMadagascar(annee) {
  const fixes = ["01-01", "03-29", "05-01", "06-26", "08-15", "11-01", "12-25"].map((j) => `${annee}-${j}`);
  const p = paques(annee, FUSEAU_TANA);
  const mobiles = [1, 39, 50].map((n) => p.plus({ days: n }).toISODate());
  return [...fixes, ...mobiles].sort();
}
function horairesCompteParDefaut(anneeDebut, nombreAnnees = 3) {
  const annees = Array.from({ length: nombreAnnees }, (_, i) => anneeDebut + i);
  return {
    ...HORAIRES_PAR_DEFAUT,
    feriesClient: annees.flatMap(joursFeriesEspagne),
    feriesLocaux: annees.flatMap(joursFeriesMadagascar)
  };
}
function jourNonTravaille(h, iso) {
  if (h.feriesClient.includes(iso)) return true;
  return h.feriesCollaborateur && h.feriesLocaux.includes(iso);
}
function plagesDuJour(h, jour) {
  const j = jour.setZone(h.fuseau).startOf("day");
  const iso = j.toISODate();
  if (jourNonTravaille(h, iso)) return [];
  return h.semaine[j.weekday] ?? [];
}
function bornes(h, jour, plage) {
  const [hd, md] = plage.debut.split(":").map(Number);
  const [hf, mf] = plage.fin.split(":").map(Number);
  const base = jour.setZone(h.fuseau).startOf("day");
  const debut = base.set({ hour: hd, minute: md });
  const fin = base.set({ hour: hf, minute: mf });
  return fin > debut ? { debut, fin } : null;
}
var JOURS_MAX = 3660;
function minutesOuvrees(h, debut, fin) {
  if (fin <= debut) return 0;
  const d = import_luxon.DateTime.fromJSDate(debut).setZone(h.fuseau);
  const f = import_luxon.DateTime.fromJSDate(fin).setZone(h.fuseau);
  let total = 0;
  let jour = d.startOf("day");
  for (let i = 0; i < JOURS_MAX && jour <= f; i++, jour = jour.plus({ days: 1 })) {
    for (const plage of plagesDuJour(h, jour)) {
      const b = bornes(h, jour, plage);
      if (!b) continue;
      const debutUtile = b.debut > d ? b.debut : d;
      const finUtile = b.fin < f ? b.fin : f;
      if (finUtile > debutUtile) total += finUtile.diff(debutUtile, "minutes").minutes;
    }
  }
  return Math.round(total);
}
function minutesParJourOuvre(h) {
  const totaux = [1, 2, 3, 4, 5, 6, 7].map((j) => (h.semaine[j] ?? []).reduce((s, p) => {
    const [hd, md] = p.debut.split(":").map(Number);
    const [hf, mf] = p.fin.split(":").map(Number);
    return s + Math.max(0, hf * 60 + mf - (hd * 60 + md));
  }, 0)).filter((t) => t > 0);
  if (!totaux.length) return 540;
  return Math.round(totaux.reduce((a, b) => a + b, 0) / totaux.length);
}

// src/shared/parametres.ts
var heure = import_zod.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");
var jourIso = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
var plageSchema = import_zod.z.object({ debut: heure, fin: heure });
var horairesSchema = import_zod.z.object({
  fuseau: import_zod.z.string().min(1),
  semaine: import_zod.z.record(import_zod.z.string().regex(/^[1-7]$/, "Jour ISO attendu entre 1 et 7"), import_zod.z.array(plageSchema)),
  feriesClient: import_zod.z.array(jourIso),
  feriesLocaux: import_zod.z.array(jourIso),
  feriesCollaborateur: import_zod.z.boolean()
});
var MODES_AUTOMATISATION = ["auto", "brouillon", "manuel"];
var AUTOMATISATIONS = [
  { cle: "relances", libelle: "Preparation des relances N1, N2 et N3", defaut: "brouillon" },
  { cle: "digest_do", libelle: "Digest de validation pour la DO", defaut: "brouillon" },
  { cle: "daily", libelle: "Reporting quotidien", defaut: "brouillon" },
  { cle: "typage_ia", libelle: "Typage des evenements par l\u2019IA", defaut: "auto" },
  { cle: "synthese_demande", libelle: "Synthese des demandes recues (action attendue, type, priorite)", defaut: "auto" },
  { cle: "echantillon_qualite", libelle: "Tirage de l\u2019echantillon qualite hebdomadaire", defaut: "auto" }
];
var parametresSchema = import_zod.z.object({
  /** Interrupteur general : coupe toute preparation automatique. */
  pauseAutomatisations: import_zod.z.boolean(),
  automatisations: import_zod.z.record(import_zod.z.string(), import_zod.z.object({ mode: import_zod.z.enum(MODES_AUTOMATISATION), actif: import_zod.z.boolean() })),
  /** Horaires ouvres de reference, utilises quand un compte client n'en definit pas. */
  horaires: horairesSchema,
  sla: import_zod.z.object({
    /** Delai cible de premiere reponse par famille, en heures ouvrees. */
    parFamille: import_zod.z.record(import_zod.z.string(), import_zod.z.number().min(0).max(400)),
    /** Delai au-dela duquel une attente DO est signalee, en heures ouvrees. */
    attenteDoHeures: import_zod.z.number().min(1).max(400),
    /** Delais avant relance N1, N2 et N3, en heures ouvrees. */
    relances: import_zod.z.object({ n1: import_zod.z.number().min(1).max(400), n2: import_zod.z.number().min(1).max(400), n3: import_zod.z.number().min(1).max(400) })
  }),
  alertes: import_zod.z.object({
    /** Jours avant echeance declenchant une alerte dans la file. */
    joursAvantEcheance: import_zod.z.array(import_zod.z.number().int().min(0).max(30))
  }),
  qualite: import_zod.z.object({
    /** Part des envois tires au sort chaque semaine pour le controle qualite. */
    tauxEchantillon: import_zod.z.number().min(0).max(1)
  }),
  /** Heure (fuseau Antananarivo) de preparation du reporting quotidien. */
  heureDaily: import_zod.z.number().int().min(0).max(23),
  /** Seuil de confiance du typage automatique : en dessous, la file « A classer ». */
  seuilConfianceTypage: import_zod.z.number().min(0).max(1)
});
function parametresParDefaut(annee = (/* @__PURE__ */ new Date()).getUTCFullYear()) {
  const slaParFamille = {};
  for (const f of FAMILLES) slaParFamille[f.code] = f.slaHeures;
  const automatisations = {};
  for (const a of AUTOMATISATIONS) automatisations[a.cle] = { mode: a.defaut, actif: true };
  return {
    pauseAutomatisations: false,
    automatisations,
    horaires: horairesCompteParDefaut(annee - 1, 4),
    sla: {
      parFamille: slaParFamille,
      attenteDoHeures: 8,
      relances: { n1: 16, n2: 32, n3: 56 }
    },
    alertes: { joursAvantEcheance: [2, 0] },
    qualite: { tauxEchantillon: 0.1 },
    heureDaily: 16,
    seuilConfianceTypage: 0.8
  };
}

// src/server/lib/parametres.ts
var CLE = "parametres";
var cache = null;
function fusionner(enregistres) {
  const defaut = parametresParDefaut();
  if (!enregistres) return defaut;
  const fusion = { ...defaut, ...enregistres };
  fusion.automatisations = { ...defaut.automatisations, ...enregistres.automatisations ?? {} };
  fusion.horaires = { ...defaut.horaires, ...enregistres.horaires ?? {} };
  fusion.sla = {
    ...defaut.sla,
    ...enregistres.sla ?? {},
    parFamille: { ...defaut.sla.parFamille, ...enregistres.sla?.parFamille ?? {} },
    relances: { ...defaut.sla.relances, ...enregistres.sla?.relances ?? {} }
  };
  fusion.alertes = { ...defaut.alertes, ...enregistres.alertes ?? {} };
  fusion.qualite = { ...defaut.qualite, ...enregistres.qualite ?? {} };
  for (const a of AUTOMATISATIONS) fusion.automatisations[a.cle] ??= { mode: a.defaut, actif: true };
  return fusion;
}
async function lireParametres() {
  if (cache && Date.now() - cache.lu < 2e3) return cache.valeur;
  const [ligne] = await db.select().from(schema_exports.parametres).where((0, import_drizzle_orm2.eq)(schema_exports.parametres.cle, CLE));
  const valeur2 = fusionner(ligne?.valeur);
  cache = { valeur: valeur2, lu: Date.now() };
  return valeur2;
}
async function horairesDuCompte(compteId) {
  const p = await lireParametres();
  if (!compteId) return p.horaires;
  const [compte] = await db.select({ horaires: schema_exports.comptesClients.horaires }).from(schema_exports.comptesClients).where((0, import_drizzle_orm2.eq)(schema_exports.comptesClients.id, compteId));
  const propres = compte?.horaires;
  if (!propres) return p.horaires;
  return { ...p.horaires, ...propres };
}

// src/server/modules/demandes/service.ts
var import_drizzle_orm3 = require("drizzle-orm");
function cumuler(compteurs, cle, minutes) {
  const base = compteurs && typeof compteurs === "object" ? { ...compteurs } : {};
  base[cle] = Math.round((base[cle] ?? 0) + minutes);
  return base;
}
function tempsDemandeAvecHoraires(demande, debutStatut, horaires, maintenant = /* @__PURE__ */ new Date()) {
  const enCours = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debutStatut, maintenant);
  const fin = demande.termineeLe ?? maintenant;
  return {
    parStatut: cumuler(demande.minutesParStatut, demande.statut, enCours),
    parActeur: cumuler(demande.minutesParActeur, demande.acteurAttendu, enCours),
    total: minutesOuvrees(horaires, demande.ouverteLe, fin),
    premiereReponse: demande.premiereReponseLe ? minutesOuvrees(horaires, demande.ouverteLe, demande.premiereReponseLe) : null,
    statutCourant: enCours
  };
}

// src/server/modules/export/service.ts
var import_drizzle_orm4 = require("drizzle-orm");
var import_luxon2 = require("luxon");

// src/server/lib/xlsx/ecriture-zip.ts
var TABLE_CRC = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

// src/shared/tirets.ts
var TIRETS_LONGS = /[\u2012\u2013\u2014\u2015]/;
var TIRETS_LONGS_G = /[\u2012\u2013\u2014\u2015]/g;
function retirerTiretsLongs(texte) {
  if (!TIRETS_LONGS.test(texte)) return texte;
  return texte.replace(/(\d)\s*[\u2012\u2013\u2014\u2015]\s*(\d)/g, "$1 \xE0 $2").replace(/^(\s*)[\u2012\u2013\u2014\u2015]\s*/gm, "$1- ").replace(/\s+[\u2012\u2013\u2014\u2015]\s+/g, ", ").replace(TIRETS_LONGS_G, "-");
}

// src/server/modules/export/service.ts
function numeroOngletSemaine(semaineIso, annee) {
  return annee === 2026 ? semaineIso - 26 : semaineIso;
}
function nomOngletSemaine(semaineIso, annee) {
  return `sem ${numeroOngletSemaine(semaineIso, annee)}`;
}
async function construireBlocJour(compteId, jour) {
  const debut = import_luxon2.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon2.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const conditions = [
    (0, import_drizzle_orm4.eq)(schema_exports.demandes.compteId, compteId),
    import_drizzle_orm4.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
    // Toute demande qui a bouge dans la journee, ou qui reste ouverte apres y etre entree.
    import_drizzle_orm4.sql`(
      (${schema_exports.demandes.dernierEvenementLe} >= ${debut} AND ${schema_exports.demandes.dernierEvenementLe} < ${fin})
      OR (${schema_exports.demandes.ouverteLe} < ${fin} AND ${schema_exports.demandes.statut} NOT IN ('termine', 'annule'))
    )`
  ];
  const demandes2 = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm4.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where((0, import_drizzle_orm4.and)(...conditions)).orderBy((0, import_drizzle_orm4.asc)(schema_exports.dossiers.client), (0, import_drizzle_orm4.asc)(schema_exports.demandes.ouverteLe));
  const parDossier = /* @__PURE__ */ new Map();
  for (const l of demandes2) {
    const deja = parDossier.get(l.dossier.id) ?? { dossier: l.dossier, demandes: [] };
    deja.demandes.push(l.demande);
    parDossier.set(l.dossier.id, deja);
  }
  const demandeIds = demandes2.map((l) => l.demande.id);
  const evenements2 = demandeIds.length ? await db.select({ demandeId: schema_exports.evenements.demandeId, resume: schema_exports.evenements.resume, objet: schema_exports.evenements.objet, survenuLe: schema_exports.evenements.survenuLe }).from(schema_exports.evenements).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.inArray)(schema_exports.evenements.demandeId, demandeIds), (0, import_drizzle_orm4.gte)(schema_exports.evenements.survenuLe, debut), (0, import_drizzle_orm4.lt)(schema_exports.evenements.survenuLe, fin))).orderBy((0, import_drizzle_orm4.asc)(schema_exports.evenements.survenuLe)) : [];
  const dernierResume = /* @__PURE__ */ new Map();
  for (const e of evenements2) {
    if (e.demandeId !== null && (e.resume || e.objet)) dernierResume.set(e.demandeId, e.resume || e.objet);
  }
  const lignes = [];
  let numero = 0;
  for (const { dossier, demandes: liste } of parDossier.values()) {
    const porteuse = [...liste].sort(
      (a, b) => (b.dernierEvenementLe?.getTime() ?? b.ouverteLe.getTime()) - (a.dernierEvenementLe?.getTime() ?? a.ouverteLe.getTime())
    )[0];
    const statut = statutReporting(porteuse.statut);
    numero++;
    const faits = liste.map((d) => dernierResume.get(d.id)).filter((x) => Boolean(x)).join(" ");
    const corps = faits || porteuse.objet;
    const description = retirerTiretsLongs(`${numero}. ${nettoyerPhrase(corps)} : ${statut}`);
    const livrables = liste.filter((d) => d.statut === "termine").map((d) => d.objet).join(" ; ");
    const prioriteLendemain = liste.some((d) => d.statut !== "termine" && d.statut !== "annule") ? retirerTiretsLongs(nettoyerPhrase(porteuse.objet)) : "Aucune";
    lignes.push({
      dossierId: dossier.id,
      client: retirerTiretsLongs(dossier.pays ? `${dossier.client} (${dossier.pays})` : dossier.client),
      produit: retirerTiretsLongs(dossier.produit ?? ""),
      description,
      statut,
      livrables: retirerTiretsLongs(livrables),
      prioriteLendemain
    });
  }
  return { jour, lignes };
}
function nettoyerPhrase(texte) {
  return texte.replace(/\s+/g, " ").replace(/\s*\.\s*$/, "").trim();
}
var MOTIFS_REFERENCE = [
  /\bBL\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bAWB\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bPFI\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bbooking\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bcommande\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\b(?:facture|proforma)\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi
];
function retirerReferences(texte) {
  let sortie = texte;
  for (const motif of MOTIFS_REFERENCE) sortie = sortie.replace(motif, (m) => m.split(/[\s:-]/)[0]);
  return sortie.replace(/\s{2,}/g, " ").trim();
}
async function construireColonneSemaine(compteId, jour) {
  const debut = import_luxon2.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon2.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const horsPerimetre = import_drizzle_orm4.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`;
  const [nouveaux] = await db.select({ n: import_drizzle_orm4.sql`count(*)::int` }).from(schema_exports.demandes).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(schema_exports.demandes.compteId, compteId), horsPerimetre, (0, import_drizzle_orm4.eq)(schema_exports.demandes.famille, "T08"), (0, import_drizzle_orm4.gte)(schema_exports.demandes.ouverteLe, debut), (0, import_drizzle_orm4.lt)(schema_exports.demandes.ouverteLe, fin)));
  const [traites] = await db.select({ n: import_drizzle_orm4.sql`count(*)::int` }).from(schema_exports.demandes).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(schema_exports.demandes.compteId, compteId), horsPerimetre, import_drizzle_orm4.sql`${schema_exports.demandes.termineeLe} IS NOT NULL`, (0, import_drizzle_orm4.gte)(schema_exports.demandes.termineeLe, debut), (0, import_drizzle_orm4.lt)(schema_exports.demandes.termineeLe, fin)));
  const parNature = await db.select({ nature: schema_exports.evenements.nature, n: import_drizzle_orm4.sql`count(*)::int` }).from(schema_exports.evenements).innerJoin(schema_exports.demandes, (0, import_drizzle_orm4.eq)(schema_exports.demandes.id, schema_exports.evenements.demandeId)).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(schema_exports.evenements.compteId, compteId), horsPerimetre, (0, import_drizzle_orm4.gte)(schema_exports.evenements.survenuLe, debut), (0, import_drizzle_orm4.lt)(schema_exports.evenements.survenuLe, fin))).groupBy(schema_exports.evenements.nature);
  const compte = (nature) => parNature.find((p) => p.nature === nature)?.n ?? 0;
  const [expeditions] = await db.select({ n: import_drizzle_orm4.sql`count(*)::int` }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm4.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(schema_exports.dossiers.compteId, compteId), (0, import_drizzle_orm4.eq)(schema_exports.echeances.type, "etd"), (0, import_drizzle_orm4.gte)(schema_exports.echeances.echeanceLe, debut), (0, import_drizzle_orm4.lt)(schema_exports.echeances.echeanceLe, fin)));
  const bloc = await construireBlocJour(compteId, jour);
  const bloques = bloc.lignes.filter((l) => l.statut === "Bloque");
  const termines = bloc.lignes.filter((l) => l.statut === "Termine");
  const enCours = bloc.lignes.filter((l) => l.statut === "En cours" || l.statut === "En attente client");
  const synthese = (lignes, maximum = 3) => retirerTiretsLongs(
    retirerReferences(
      lignes.slice(0, maximum).map((l) => `${l.client} : ${l.description.replace(/^\d+\.\s*/, "").replace(/\s*:\s*[^:]*$/, "")}`).join(" ; ")
    )
  );
  return {
    nouveauxLeads: nouveaux?.n ?? 0,
    dossiersTraites: traites?.n ?? 0,
    documentsEmis: compte("envoi_livrable"),
    relancesEnvoyees: compte("relance_emise"),
    validationsObtenues: compte("validation_do"),
    expeditionsParties: expeditions?.n ?? 0,
    faitsMarquants: synthese(termines.length ? termines : enCours),
    pointsVigilance: bloques.length ? synthese(bloques) : "Rien a signaler",
    actionsSemaineSuivante: synthese(enCours),
    appuiDemande: bloques.length ? "Arbitrage demande sur les dossiers bloques" : "Aucun",
    pointsBloquants: bloques.length ? synthese(bloques) : ""
  };
}

// src/server/modules/brouillons/service.ts
async function enregistrerBrouillon(entree, auteur) {
  const [deja] = await db.select().from(schema_exports.brouillons).where((0, import_drizzle_orm5.eq)(schema_exports.brouillons.cleUnicite, entree.cleUnicite));
  if (deja) return { brouillon: deja, cree: false };
  const [brouillon] = await db.insert(schema_exports.brouillons).values({
    compteId: entree.compteId,
    type: entree.type,
    dossierId: entree.dossierId ?? null,
    demandeId: entree.demandeId ?? null,
    titre: retirerTiretsLongs(entree.titre),
    // Dernier filtre avant qu'un texte arrive sous les yeux d'un humain.
    contenu: retirerTiretsLongs(entree.contenu),
    donnees: entree.donnees ?? {},
    sources: entree.sources,
    niveau: entree.niveau ?? null,
    cleUnicite: entree.cleUnicite
  }).returning();
  await journaliser("brouillon_prepare", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "brouillon",
    entiteId: brouillon.id,
    details: { type: entree.type, demandeId: entree.demandeId ?? null, sources: entree.sources.length }
  });
  return { brouillon, cree: true };
}
function langueDe(adresse) {
  const domaine = (adresse ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (/\.(es|mx|ar|co|cl|pe)$/.test(domaine)) return "es";
  if (/\.(com|co\.uk|uk|us|ae|sa|in|sg)$/.test(domaine)) return "en";
  return "fr";
}
var FORMULES = {
  fr: {
    bonjour: "Bonjour,",
    relance: (n) => n === 1 ? "Je me permets de revenir vers vous concernant le point ci-dessous." : n === 2 ? "Sans retour de votre part, je reviens vers vous sur ce point." : "Ce dossier reste bloque faute de retour. Pouvez-vous nous indiquer une date ?",
    attente: (d) => `Ce point est en attente depuis ${d} ouvrees.`,
    fin: "Merci par avance de votre retour.\nBien cordialement,"
  },
  en: {
    bonjour: "Hello,",
    relance: (n) => n === 1 ? "I am following up on the point below." : n === 2 ? "As we have not heard back, I am following up again on this point." : "This file is still on hold without an answer. Could you confirm a date?",
    attente: (d) => `This item has been pending for ${d} of working time.`,
    fin: "Thank you in advance for your reply.\nKind regards,"
  },
  es: {
    bonjour: "Buenos dias,",
    relance: (n) => n === 1 ? "Me permito volver a escribirle sobre el punto siguiente." : n === 2 ? "Al no haber recibido respuesta, insisto sobre este punto." : "Este expediente sigue bloqueado sin respuesta. Podria indicarnos una fecha?",
    attente: (d) => `Este punto lleva ${d} de tiempo laborable en espera.`,
    fin: "Gracias de antemano por su respuesta.\nAtentamente,"
  }
};
var UNITES = {
  fr: { jour: ["jour", "jours"], heure: ["heure", "heures"], et: "et", moinsDUneHeure: "moins d\u2019une heure" },
  en: { jour: ["day", "days"], heure: ["hour", "hours"], et: "and", moinsDUneHeure: "less than an hour" },
  es: { jour: ["dia", "dias"], heure: ["hora", "horas"], et: "y", moinsDUneHeure: "menos de una hora" }
};
function dureeLocalisee(minutes, langue, minutesParJour = 540) {
  const u = UNITES[langue];
  const jours = Math.floor(minutes / minutesParJour);
  const heures = Math.floor((minutes - jours * minutesParJour) / 60);
  const morceaux = [];
  if (jours) morceaux.push(`${jours} ${jours > 1 ? u.jour[1] : u.jour[0]}`);
  if (heures) morceaux.push(`${heures} ${heures > 1 ? u.heure[1] : u.heure[0]}`);
  if (!morceaux.length) return u.moinsDUneHeure;
  return morceaux.join(` ${u.et} `);
}
async function relancesAPreparer(compteId, maintenant = /* @__PURE__ */ new Date()) {
  const parametres2 = await lireParametres();
  const seuils = parametres2.sla.relances;
  const lignes = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers.libelle }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm5.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where(
    (0, import_drizzle_orm5.and)(
      (0, import_drizzle_orm5.eq)(schema_exports.demandes.compteId, compteId),
      import_drizzle_orm5.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
      // Une relance ne concerne que ce qui attend quelqu'un d'autre que le poste.
      (0, import_drizzle_orm5.inArray)(schema_exports.demandes.statut, ["attente_tiers", "attente_do"])
    )
  );
  if (!lignes.length) return [];
  const horaires = await horairesDuCompte(compteId);
  const debuts = await debutsDeStatut(lignes.map((l) => l.demande));
  const sorties = [];
  const eligibles = [];
  for (const { demande, dossier } of lignes) {
    const temps = tempsDemandeAvecHoraires(demande, debuts.get(demande.id) ?? demande.ouverteLe, horaires, maintenant);
    const attente = temps.statutCourant / 60;
    const niveau = attente >= seuils.n3 ? 3 : attente >= seuils.n2 ? 2 : attente >= seuils.n1 ? 1 : 0;
    if (!niveau) continue;
    if (demande.niveauRelance >= niveau) continue;
    eligibles.push({ demande, dossier, niveau, minutesAttente: temps.statutCourant });
  }
  if (!eligibles.length) return [];
  const evenements2 = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm5.inArray)(schema_exports.evenements.demandeId, eligibles.map((e) => e.demande.id))).orderBy((0, import_drizzle_orm5.desc)(schema_exports.evenements.survenuLe));
  const parDemande = /* @__PURE__ */ new Map();
  for (const e of evenements2) {
    if (!e.demandeId) continue;
    const liste = parDemande.get(e.demandeId) ?? [];
    if (liste.length < 4) liste.push(e);
    parDemande.set(e.demandeId, liste);
  }
  for (const { demande, dossier, niveau, minutesAttente } of eligibles) {
    const recents = parDemande.get(demande.id) ?? [];
    const dernierSortant = recents.find((e) => e.sens === "sortant");
    sorties.push({
      demande,
      dossier,
      niveau,
      minutesAttente,
      destinataire: dernierSortant?.destinataires ? dernierSortant.destinataires[0] ?? null : null,
      sources: recents.map((e) => e.id),
      faits: recents.filter((e) => e.resume).slice(0, 3).map((e) => ({ le: e.survenuLe, resume: e.resume })),
      minutesParJour: minutesParJourOuvre(horaires)
    });
  }
  return sorties.sort((a, b) => b.minutesAttente - a.minutesAttente);
}
function redigerRelance(relance) {
  const langue = langueDe(relance.destinataire);
  const f = FORMULES[langue];
  const lignes = [f.bonjour, "", f.relance(relance.niveau), "", `${relance.dossier} : ${relance.demande.objet}`];
  if (relance.faits.length) {
    lignes.push("");
    for (const fait of relance.faits) {
      lignes.push(`  ${import_luxon3.DateTime.fromJSDate(fait.le).toFormat("dd/MM/yyyy")} : ${fait.resume}`);
    }
  }
  lignes.push("", f.attente(dureeLocalisee(relance.minutesAttente, langue, relance.minutesParJour)), "", f.fin);
  return retirerTiretsLongs(lignes.join("\n"));
}
async function preparerRelances(compteId, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const aPreparer = await relancesAPreparer(compteId, maintenant);
  const jour = import_luxon3.DateTime.fromJSDate(maintenant).toISODate();
  let crees = 0;
  for (const relance of aPreparer) {
    const { cree } = await enregistrerBrouillon(
      {
        compteId,
        type: "relance",
        dossierId: relance.demande.dossierId,
        demandeId: relance.demande.id,
        niveau: relance.niveau,
        titre: `Relance N${relance.niveau} : ${relance.demande.objet}`,
        contenu: redigerRelance(relance),
        donnees: { minutesAttente: relance.minutesAttente, destinataire: relance.destinataire, langue: langueDe(relance.destinataire) },
        sources: relance.sources,
        // Une seule relance par demande et par niveau, quel que soit le nombre de passages.
        cleUnicite: `relance:${relance.demande.id}:n${relance.niveau}`
      },
      auteur
    );
    if (cree) crees++;
  }
  return { candidates: aPreparer.length, crees, jour };
}
async function preparerDaily(compteId, jour, auteur) {
  const bloc = await construireBlocJour(compteId, jour);
  if (!bloc.lignes.length) return { cree: false, lignes: 0 };
  const date2 = import_luxon3.DateTime.fromISO(jour).toFormat("dd/MM/yyyy");
  const corps = bloc.lignes.map((l) => `${l.description}
  ${l.client} | ${l.produit}${l.livrables ? `
  Livrables : ${l.livrables}` : ""}${l.prioriteLendemain && l.prioriteLendemain !== "Aucune" ? `
  Demain : ${l.prioriteLendemain}` : ""}`);
  const contenu = [
    `Reporting du ${date2}`,
    "",
    ...corps,
    "",
    `${bloc.lignes.length} dossier(s) suivi(s) ce jour.`,
    "",
    "Ce texte est un brouillon. L'ecriture dans le classeur se fait dans l'ecran Export."
  ].join("\n");
  const sources = await evenementsDuJour(compteId, jour);
  const { cree } = await enregistrerBrouillon(
    {
      compteId,
      type: "daily",
      titre: `Reporting du ${date2}`,
      contenu,
      donnees: { jour, lignes: bloc.lignes },
      sources,
      cleUnicite: `daily:${compteId}:${jour}`
    },
    auteur
  );
  return { cree, lignes: bloc.lignes.length };
}
async function preparerSemaine(compteId, jourDansLaSemaine, auteur) {
  const reference = import_luxon3.DateTime.fromISO(jourDansLaSemaine);
  const onglet = nomOngletSemaine(reference.weekNumber, reference.weekYear);
  const colonnes = [];
  for (let jourSemaine = 1; jourSemaine <= 5; jourSemaine++) {
    const jour = reference.set({ weekday: jourSemaine }).toISODate();
    colonnes.push({
      jour,
      libelle: import_luxon3.DateTime.fromISO(jour).setLocale("fr").toFormat("cccc dd/MM"),
      donnees: await construireColonneSemaine(compteId, jour)
    });
  }
  const total = colonnes.reduce((s, c) => s + c.donnees.dossiersTraites, 0);
  const contenu = [
    `Onglet \xAB ${onglet} \xBB, semaine ${reference.weekNumber}`,
    "",
    ...colonnes.map(
      (c) => [
        c.libelle,
        `  Nouveaux leads : ${c.donnees.nouveauxLeads}`,
        `  Dossiers traites : ${c.donnees.dossiersTraites}`,
        `  Documents emis : ${c.donnees.documentsEmis}`,
        `  Relances envoyees : ${c.donnees.relancesEnvoyees}`,
        `  Validations obtenues : ${c.donnees.validationsObtenues}`,
        `  Expeditions parties : ${c.donnees.expeditionsParties}`,
        c.donnees.faitsMarquants ? `  Faits marquants : ${c.donnees.faitsMarquants}` : null,
        c.donnees.pointsBloquants ? `  Points bloquants : ${c.donnees.pointsBloquants}` : null
      ].filter(Boolean).join("\n")
    ),
    "",
    `${total} dossier(s) traite(s) sur la semaine.`,
    "",
    "Les onglets \xAB sem \xBB ne portent aucune reference de dossier : seules les syntheses y figurent."
  ].join("\n\n");
  const sources = (await Promise.all(colonnes.map((c) => evenementsDuJour(compteId, c.jour)))).flat();
  const { cree } = await enregistrerBrouillon(
    {
      compteId,
      type: "semaine",
      titre: `Onglet ${onglet}, semaine ${reference.weekNumber}`,
      contenu,
      donnees: { onglet, semaine: reference.weekNumber, colonnes },
      sources: [...new Set(sources)],
      cleUnicite: `semaine:${compteId}:${reference.weekYear}-W${String(reference.weekNumber).padStart(2, "0")}`
    },
    auteur
  );
  return { cree, onglet };
}
async function preparerLeMatin(compteId, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const parametres2 = await lireParametres();
  if (parametres2.pauseAutomatisations) return { ignore: true, raison: "automatisations en pause" };
  const bilan = { relances: 0, daily: 0, semaine: 0 };
  if (parametres2.automatisations.relances?.actif !== false) {
    bilan.relances = (await preparerRelances(compteId, auteur, maintenant)).crees;
  }
  if (parametres2.automatisations.daily?.actif !== false) {
    const veille = import_luxon3.DateTime.fromJSDate(maintenant).minus({ days: 1 }).toISODate();
    if ((await preparerDaily(compteId, veille, auteur)).cree) bilan.daily++;
    if (import_luxon3.DateTime.fromJSDate(maintenant).weekday === 1) {
      if ((await preparerSemaine(compteId, veille, auteur)).cree) bilan.semaine++;
    }
  }
  return { ignore: false, ...bilan };
}
async function debutsDeStatut(demandes2) {
  if (!demandes2.length) return /* @__PURE__ */ new Map();
  const lignes = await db.select({ demandeId: schema_exports.transitionsStatut.demandeId, debut: import_drizzle_orm5.sql`max(${schema_exports.transitionsStatut.survenuLe})`.as("debut") }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm5.inArray)(schema_exports.transitionsStatut.demandeId, demandes2.map((d) => d.id))).groupBy(schema_exports.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}
async function evenementsDuJour(compteId, jour) {
  const debut = import_luxon3.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon3.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const lignes = await db.select({ id: schema_exports.evenements.id }).from(schema_exports.evenements).where(
    (0, import_drizzle_orm5.and)(
      (0, import_drizzle_orm5.eq)(schema_exports.evenements.compteId, compteId),
      (0, import_drizzle_orm5.gte)(schema_exports.evenements.survenuLe, debut),
      (0, import_drizzle_orm5.lt)(schema_exports.evenements.survenuLe, fin),
      import_drizzle_orm5.sql`coalesce(${schema_exports.evenements.famille}, '') <> ${FAMILLE_HORS_PERIMETRE}`
    )
  ).limit(200);
  return lignes.map((l) => l.id);
}

// src/shared/dates.ts
var import_luxon4 = require("luxon");
function maintenantTana() {
  const dt = import_luxon4.DateTime.now().setZone(FUSEAU_TANA);
  return { jour: dt.toISODate(), heure: dt.hour, dt };
}

// src/server/taches-periodiques.ts
var CLE_VERROU = 7340242;
async function periodique(nom, periodicite, fn, forcer = false) {
  const [etat] = await db.select().from(schema_exports.cronRuns).where((0, import_drizzle_orm6.eq)(schema_exports.cronRuns.tache, nom));
  const maintenant = /* @__PURE__ */ new Date();
  let cle = null;
  if (!forcer) {
    if ("toutesLesMinutes" in periodicite) {
      if (etat?.dernierPassageLe && maintenant.getTime() - etat.dernierPassageLe.getTime() < periodicite.toutesLesMinutes * 6e4 - 3e4) return;
    } else {
      const { jour, heure: heure2 } = maintenantTana();
      if (heure2 < periodicite.chaqueJourA || etat?.dernierePeriode === jour) return;
      cle = jour;
    }
  }
  const debut = Date.now();
  let statut = "succes";
  let erreur = null;
  let resultat;
  try {
    resultat = await fn();
  } catch (e) {
    statut = "echec";
    erreur = messageErreur(e).slice(0, 1e3);
    journal.error("Tache periodique en echec", { tache: nom, erreur });
  }
  const valeurs = {
    dernierPassageLe: maintenant,
    dernierStatut: statut,
    derniereErreur: erreur,
    dureeMs: Date.now() - debut,
    ...cle ? { dernierePeriode: cle } : {}
  };
  await db.insert(schema_exports.cronRuns).values({ tache: nom, ...valeurs }).onConflictDoUpdate({ target: schema_exports.cronRuns.tache, set: valeurs });
  return resultat;
}
var TACHES = {
  /** Controle de sante de la chaine asynchrone : trace le dernier passage reussi. */
  sante: async () => ({ file: await traiterFile({ limite: 1, budgetMs: 5e3 }) }),
  /**
   * Preparation du matin : relances, daily de la veille et, le lundi, onglet de la semaine.
   * Rien n'est envoye, tout est enregistre en brouillon (phase 5).
   */
  preparation_matin: async () => {
    const comptes = await db.select({ id: schema_exports.comptesClients.id }).from(schema_exports.comptesClients).where((0, import_drizzle_orm6.eq)(schema_exports.comptesClients.actif, true));
    const bilans = {};
    for (const compte of comptes) {
      try {
        bilans[compte.id] = await preparerLeMatin(compte.id, { type: "systeme", utilisateurId: null });
      } catch (e) {
        journal.error("Preparation du matin en echec", { compteId: compte.id, erreur: messageErreur(e) });
        bilans[compte.id] = { erreur: true };
      }
    }
    return bilans;
  }
};
var PERIODICITES = {
  sante: { toutesLesMinutes: 60 },
  preparation_matin: { chaqueJourA: 6 }
};
async function tick(opts = {}) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [CLE_VERROU]);
    if (!rows[0].ok) {
      journal.info("Tick deja en cours, passage ignore");
      return { ignore: true };
    }
    const fin = Date.now() + (opts.budgetMs ?? 4 * 6e4);
    const file = await traiterFile({ budgetMs: Math.max(1e4, fin - Date.now() - 6e4) }).catch((e) => {
      journal.error("Traitement de la file en echec", { erreur: messageErreur(e) });
      return null;
    });
    const taches = [];
    for (const nom of Object.keys(TACHES)) {
      if (Date.now() > fin) break;
      if (await periodique(nom, PERIODICITES[nom], TACHES[nom]) !== void 0) taches.push(nom);
    }
    journal.info("Tick termine", { file, taches });
    return { ignore: false, file, taches };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [CLE_VERROU]).catch(() => void 0);
    client.release();
  }
}
async function executerTache(nom) {
  return periodique(nom, { toutesLesMinutes: 0 }, TACHES[nom], true);
}

// src/server/cron.ts
var DUREE_MAX_PASSAGE_MS = 8 * 6e4;
async function principal() {
  const commande = process.argv[2] ?? "tick";
  setTimeout(() => {
    console.error(JSON.stringify({ niveau: "error", message: "Cron arrete : duree maximale depassee", commande }));
    process.exit(1);
  }, DUREE_MAX_PASSAGE_MS).unref();
  if (commande === "tick") await tick();
  else if (commande in TACHES) await executerTache(commande);
  else {
    console.error(`Commande inconnue : ${commande}. Disponibles : tick, ${Object.keys(TACHES).join(", ")}`);
    process.exitCode = 1;
  }
}
principal().catch((e) => {
  console.error(JSON.stringify({ niveau: "error", message: "Echec du cron", erreur: String(e?.message ?? e) }));
  process.exitCode = 1;
}).finally(() => fermerDb());
//# sourceMappingURL=cron.js.map
