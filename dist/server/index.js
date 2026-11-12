"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc12) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc12 = __getOwnPropDesc(from, key)) || desc12.enumerable });
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

// src/server/config.ts
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
  const racine = import_node_path.default.resolve(__dirname, "..", "..");
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
    stockage: import_node_path.default.resolve(racine, lire("STORAGE_DIR", test ? "storage/test" : "storage")),
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
function integrationsSimulees() {
  const liste = [];
  if (config.ia.fournisseur === "mock") liste.push("IA (AI_PROVIDER, AGENT_API_TOKEN ou ANTHROPIC_API_KEY)");
  if (config.collecte.mode === "mock") liste.push("Collecte des mails du poste (APPS_SCRIPT_SECRET ou IMAP_*)");
  if (config.smtp.mode === "mock") liste.push("Envoi des emails (SMTP_*)");
  if (!config.mcp.jeton) liste.push("Connecteur Claude (AZMG_MCP_TOKEN)");
  return liste;
}
var import_node_path, config;
var init_config = __esm({
  "src/server/config.ts"() {
    "use strict";
    import_node_path = __toESM(require("node:path"));
    config = construire();
  }
});

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
var import_pg_core, id, ref, horodatage, creeLe, majLe, utilisateurs, sessions, reinitialisations, parametres, comptesClients, postes, dossiers, demandes, evenements, transitionsStatut, echeances, pieces, checklists, controlesEnvoi, grillesQualite, controlesQualite, reglesTypage, referentiels, jobsQueue, cronRuns, aiTasks, journalActions, brouillons, imports;
var init_schema = __esm({
  "src/server/db/schema.ts"() {
    "use strict";
    import_pg_core = require("drizzle-orm/pg-core");
    id = () => (0, import_pg_core.bigserial)("id", { mode: "number" }).primaryKey();
    ref = (nom) => (0, import_pg_core.bigint)(nom, { mode: "number" });
    horodatage = (nom) => (0, import_pg_core.timestamp)(nom, { withTimezone: true, mode: "date" });
    creeLe = () => horodatage("created_at").notNull().defaultNow();
    majLe = () => horodatage("updated_at").notNull().defaultNow();
    utilisateurs = (0, import_pg_core.pgTable)("utilisateurs", {
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
    sessions = (0, import_pg_core.pgTable)(
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
    reinitialisations = (0, import_pg_core.pgTable)("reinitialisations", {
      id: id(),
      utilisateurId: ref("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
      jetonHash: (0, import_pg_core.text)("jeton_hash").notNull().unique(),
      expireLe: horodatage("expire_le").notNull(),
      utiliseLe: horodatage("utilise_le"),
      creeLe: creeLe()
    });
    parametres = (0, import_pg_core.pgTable)("parametres", {
      cle: (0, import_pg_core.text)("cle").primaryKey(),
      valeur: (0, import_pg_core.jsonb)("valeur").notNull(),
      modifiePar: ref("modifie_par"),
      majLe: majLe()
    });
    comptesClients = (0, import_pg_core.pgTable)("comptes_clients", {
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
    postes = (0, import_pg_core.pgTable)(
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
    dossiers = (0, import_pg_core.pgTable)(
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
    demandes = (0, import_pg_core.pgTable)(
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
    evenements = (0, import_pg_core.pgTable)(
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
    transitionsStatut = (0, import_pg_core.pgTable)(
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
    echeances = (0, import_pg_core.pgTable)(
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
    pieces = (0, import_pg_core.pgTable)(
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
    checklists = (0, import_pg_core.pgTable)("checklists", {
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
    controlesEnvoi = (0, import_pg_core.pgTable)(
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
    grillesQualite = (0, import_pg_core.pgTable)("grilles_qualite", {
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
    controlesQualite = (0, import_pg_core.pgTable)(
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
    reglesTypage = (0, import_pg_core.pgTable)(
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
    referentiels = (0, import_pg_core.pgTable)(
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
    jobsQueue = (0, import_pg_core.pgTable)(
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
    cronRuns = (0, import_pg_core.pgTable)("cron_runs", {
      tache: (0, import_pg_core.text)("tache").primaryKey(),
      dernierPassageLe: horodatage("dernier_passage_le"),
      dernierStatut: (0, import_pg_core.text)("dernier_statut"),
      derniereErreur: (0, import_pg_core.text)("derniere_erreur"),
      dureeMs: (0, import_pg_core.integer)("duree_ms"),
      dernierePeriode: (0, import_pg_core.text)("derniere_periode")
    });
    aiTasks = (0, import_pg_core.pgTable)(
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
    journalActions = (0, import_pg_core.pgTable)(
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
    brouillons = (0, import_pg_core.pgTable)(
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
    imports = (0, import_pg_core.pgTable)("imports", {
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
  }
});

// src/server/db/client.ts
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
var import_pg, import_node_postgres, import_migrator, pool, instance, db;
var init_client = __esm({
  "src/server/db/client.ts"() {
    "use strict";
    import_pg = require("pg");
    import_node_postgres = require("drizzle-orm/node-postgres");
    import_migrator = require("drizzle-orm/node-postgres/migrator");
    init_schema();
    init_config();
    pool = null;
    instance = null;
    db = new Proxy({}, {
      get(_cible, prop) {
        return getDb()[prop];
      }
    });
  }
});

// src/server/lib/journal.ts
function masquer(texte2) {
  return texte2.replace(EMAIL, "[email]").replace(TELEPHONE, "[telephone]");
}
function ecrire(niveau, message, details) {
  const seuil = process.env.LOG_LEVEL || (config.test ? "warn" : "info");
  if (ordre[niveau] < ordre[seuil]) return;
  const ligne = masquer(JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), niveau, message, ...details ?? {} }));
  if (niveau === "error" || niveau === "warn") console.error(ligne);
  else process.stdout.write(ligne + "\n");
}
function messageErreur(e) {
  return e instanceof Error ? e.message : String(e);
}
var EMAIL, TELEPHONE, ordre, journal;
var init_journal = __esm({
  "src/server/lib/journal.ts"() {
    "use strict";
    init_config();
    EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    TELEPHONE = /(?<![\d-])(\+\d{2,3}|00\d{2,3}|0)[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{3}[\s.]?\d{2}(?!\d)/g;
    ordre = { debug: 10, info: 20, warn: 30, error: 40 };
    journal = {
      debug: (m, d) => ecrire("debug", m, d),
      info: (m, d) => ecrire("info", m, d),
      warn: (m, d) => ecrire("warn", m, d),
      error: (m, d) => ecrire("error", m, d)
    };
  }
});

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
var init_evenements = __esm({
  "src/server/lib/evenements.ts"() {
    "use strict";
    init_client();
  }
});

// src/server/lib/http.ts
function valider(schema, donnees) {
  const r = schema.safeParse(donnees);
  if (!r.success) {
    throw new ErreurHttp(
      400,
      "Donn\xE9es invalides",
      r.error.issues.map((i) => ({ champ: i.path.join("."), message: i.message }))
    );
  }
  return r.data;
}
function idParam(req, nom = "id") {
  const v = Number(String(req.params[nom]));
  if (!Number.isInteger(v) || v <= 0) throw new ErreurHttp(400, "Identifiant invalide");
  return v;
}
function gestionErreurs(err, _req, res, _next) {
  if (err instanceof ErreurHttp) {
    res.status(err.statut).json({ erreur: err.message, details: err.details });
    return;
  }
  const e = err;
  if (e?.type === "entity.too.large" || e?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ erreur: "Fichier ou requ\xEAte trop volumineux" });
    return;
  }
  if (e?.status && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ erreur: "Requ\xEAte invalide" });
    return;
  }
  console.error(JSON.stringify({ niveau: "error", message: "Erreur serveur", erreur: (e?.message ?? String(err)).slice(0, 500) }));
  res.status(500).json({ erreur: "Erreur interne du serveur" });
}
var ErreurHttp;
var init_http = __esm({
  "src/server/lib/http.ts"() {
    "use strict";
    ErreurHttp = class extends Error {
      constructor(statut, message, details) {
        super(message);
        this.statut = statut;
        this.details = details;
      }
      statut;
      details;
    };
  }
});

// src/server/lib/securite.ts
function jetonAleatoire(octets = 24) {
  return import_node_crypto.default.randomBytes(octets).toString("base64url");
}
function sha256(donnee) {
  return import_node_crypto.default.createHash("sha256").update(donnee).digest("hex");
}
function egaliteConstante(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && import_node_crypto.default.timingSafeEqual(ba, bb);
}
var import_node_crypto;
var init_securite = __esm({
  "src/server/lib/securite.ts"() {
    "use strict";
    import_node_crypto = __toESM(require("node:crypto"));
    init_config();
  }
});

// src/shared/constantes.ts
function famille(code) {
  return FAMILLES.find((f) => f.code === code);
}
function estHorsPerimetre(code) {
  return code === FAMILLE_HORS_PERIMETRE;
}
function definitionNature(code) {
  return DEFINITIONS_NATURES.find((n) => n.code === code);
}
function definitionStatut(code) {
  return DEFINITIONS_STATUTS.find((s) => s.code === code);
}
function libelleStatut(code) {
  return definitionStatut(code)?.libelle ?? code;
}
function statutReporting(code) {
  return definitionStatut(code)?.reporting ?? "En cours";
}
function estFerme(statut) {
  return STATUTS_FERMES.includes(statut);
}
var ROLES, FAMILLES, FAMILLES_PAR_METIER, CODES_FAMILLES, FAMILLE_HORS_PERIMETRE, FAMILLES_PILOTAGE, SENS, NATURES, DEFINITIONS_NATURES, INTERLOCUTEURS, LIBELLES_INTERLOCUTEURS, STATUTS, ACTEURS, STATUTS_REPORTING, DEFINITIONS_STATUTS, STATUTS_OUVERTS, STATUTS_FERMES, SOURCES, PRIORITES, POIDS_PRIORITES, TYPES_ECHEANCE, LIBELLES_ECHEANCES, STATUTS_DOSSIER;
var init_constantes = __esm({
  "src/shared/constantes.ts"() {
    "use strict";
    ROLES = ["admin", "manager", "collaborateur", "client_lecture"];
    FAMILLES = [
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
    FAMILLES_PAR_METIER = {
      export: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T12", "T13", "T14"],
      designer: ["D01", "D02", "D03", "T07", "T09", "T13"]
    };
    CODES_FAMILLES = FAMILLES.map((f) => f.code);
    FAMILLE_HORS_PERIMETRE = "T00";
    FAMILLES_PILOTAGE = FAMILLES.filter((f) => !f.horsPerimetre);
    SENS = ["entrant", "sortant", "interne"];
    NATURES = [
      "demande_entrante",
      "consigne_do",
      "envoi_livrable",
      "demande_validation_do",
      "validation_do",
      "refus_do",
      "relance_emise",
      "relance_recue",
      "reponse_tiers",
      "information"
    ];
    DEFINITIONS_NATURES = [
      { code: "demande_entrante", libelle: "Demande entrante", sens: ["entrant"], effet: "cree une demande au statut Nouveau" },
      { code: "consigne_do", libelle: "Consigne de la DO", sens: ["entrant"], effet: "cree ou reoriente une demande" },
      { code: "envoi_livrable", libelle: "Envoi de livrable", sens: ["sortant"], effet: "passe en attente du destinataire" },
      { code: "demande_validation_do", libelle: "Demande de validation a la DO", sens: ["sortant"], effet: "passe en attente DO et lance le chrono de validation" },
      { code: "validation_do", libelle: "Validation de la DO", sens: ["entrant"], effet: "repasse la demande en cours" },
      { code: "refus_do", libelle: "Refus de la DO", sens: ["entrant"], effet: "repasse la demande en cours avec correction a faire" },
      { code: "relance_emise", libelle: "Relance emise", sens: ["sortant"], effet: "incremente le niveau de relance (N1, N2, N3)" },
      { code: "relance_recue", libelle: "Relance recue", sens: ["entrant"], effet: "signale un delai depasse cote poste" },
      { code: "reponse_tiers", libelle: "Reponse du tiers", sens: ["entrant"], effet: "repasse la demande en cours" },
      { code: "information", libelle: "Information, accuse, notification", sens: null, effet: "aucun changement, seulement trace" }
    ];
    INTERLOCUTEURS = [
      "client",
      "prospect",
      "transitaire",
      "transporteur",
      "qualite",
      "fournisseur",
      "autorite",
      "do",
      "stagiaire",
      "interne_azmg"
    ];
    LIBELLES_INTERLOCUTEURS = {
      client: "client",
      prospect: "prospect",
      transitaire: "transitaire",
      transporteur: "transporteur",
      qualite: "Qualite",
      fournisseur: "fournisseur",
      autorite: "autorite ou chambre",
      do: "donneuse d\u2019ordre",
      stagiaire: "stagiaire",
      interne_azmg: "interne AZMG"
    };
    STATUTS = ["nouveau", "en_cours", "attente_tiers", "attente_do", "bloque", "termine", "annule"];
    ACTEURS = ["poste", "do", "client", "tiers", "aucun"];
    STATUTS_REPORTING = ["Termine", "En attente client", "En cours", "Bloque", "Annule"];
    DEFINITIONS_STATUTS = [
      { code: "nouveau", libelle: "Nouveau", reporting: "En cours", acteur: "poste", fermee: false },
      { code: "en_cours", libelle: "En cours", reporting: "En cours", acteur: "poste", fermee: false },
      { code: "attente_tiers", libelle: "En attente client / tiers", reporting: "En attente client", acteur: "client", fermee: false },
      { code: "attente_do", libelle: "En attente DO", reporting: "En cours", mention: "validation DO attendue", acteur: "do", fermee: false },
      { code: "bloque", libelle: "Bloque", reporting: "Bloque", acteur: "poste", fermee: false },
      { code: "termine", libelle: "Termine", reporting: "Termine", acteur: "aucun", fermee: true },
      { code: "annule", libelle: "Annule", reporting: "Annule", acteur: "aucun", fermee: true }
    ];
    STATUTS_OUVERTS = DEFINITIONS_STATUTS.filter((s) => !s.fermee).map((s) => s.code);
    STATUTS_FERMES = DEFINITIONS_STATUTS.filter((s) => s.fermee).map((s) => s.code);
    SOURCES = ["mail", "whatsapp", "vocal", "saisie", "import"];
    PRIORITES = ["basse", "normale", "haute", "critique"];
    POIDS_PRIORITES = { critique: 0, haute: 1, normale: 2, basse: 3 };
    TYPES_ECHEANCE = ["cut_off", "etd", "eta", "validite_offre", "expiration_document", "creneau_entrepot"];
    LIBELLES_ECHEANCES = {
      cut_off: "cut-off",
      etd: "ETD (depart prevu)",
      eta: "ETA (arrivee prevue)",
      validite_offre: "validite d\u2019offre",
      expiration_document: "expiration de document",
      creneau_entrepot: "creneau d\u2019entrepot"
    };
    STATUTS_DOSSIER = ["ouvert", "en_attente", "clos", "annule"];
  }
});

// src/shared/heures-ouvrees.ts
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
function ajouterMinutesOuvrees(h, depart, minutes) {
  if (minutes <= 0) return depart;
  let reste = minutes;
  const d = import_luxon.DateTime.fromJSDate(depart).setZone(h.fuseau);
  let jour = d.startOf("day");
  for (let i = 0; i < JOURS_MAX; i++, jour = jour.plus({ days: 1 })) {
    for (const plage of plagesDuJour(h, jour)) {
      const b = bornes(h, jour, plage);
      if (!b) continue;
      if (b.fin <= d) continue;
      const debutUtile = b.debut > d ? b.debut : d;
      const disponible = b.fin.diff(debutUtile, "minutes").minutes;
      if (disponible >= reste) return debutUtile.plus({ minutes: reste }).toJSDate();
      reste -= disponible;
    }
  }
  return jour.toJSDate();
}
function ajouterHeuresOuvrees(h, depart, heures) {
  return ajouterMinutesOuvrees(h, depart, Math.round(heures * 60));
}
function formaterDuree(minutes, minutesParJour = 540) {
  if (minutes <= 0) return "0 min";
  const jours = Math.floor(minutes / minutesParJour);
  const resteJour = minutes - jours * minutesParJour;
  const heures = Math.floor(resteJour / 60);
  const min = Math.round(resteJour - heures * 60);
  const morceaux = [];
  if (jours) morceaux.push(`${jours} j`);
  if (heures) morceaux.push(`${heures} h`);
  if (min && !jours) morceaux.push(`${min} min`);
  return morceaux.join(" ") || "0 min";
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
var import_luxon, FUSEAU_TANA, FUSEAU_CLIENT_DEFAUT, HORAIRES_PAR_DEFAUT, JOURS_MAX;
var init_heures_ouvrees = __esm({
  "src/shared/heures-ouvrees.ts"() {
    "use strict";
    import_luxon = require("luxon");
    FUSEAU_TANA = "Indian/Antananarivo";
    FUSEAU_CLIENT_DEFAUT = "Europe/Madrid";
    HORAIRES_PAR_DEFAUT = {
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
    JOURS_MAX = 3660;
  }
});

// src/shared/parametres.ts
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
var import_zod3, heure, jourIso, plageSchema, horairesSchema, MODES_AUTOMATISATION, AUTOMATISATIONS, parametresSchema;
var init_parametres = __esm({
  "src/shared/parametres.ts"() {
    "use strict";
    import_zod3 = require("zod");
    init_constantes();
    init_heures_ouvrees();
    heure = import_zod3.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");
    jourIso = import_zod3.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
    plageSchema = import_zod3.z.object({ debut: heure, fin: heure });
    horairesSchema = import_zod3.z.object({
      fuseau: import_zod3.z.string().min(1),
      semaine: import_zod3.z.record(import_zod3.z.string().regex(/^[1-7]$/, "Jour ISO attendu entre 1 et 7"), import_zod3.z.array(plageSchema)),
      feriesClient: import_zod3.z.array(jourIso),
      feriesLocaux: import_zod3.z.array(jourIso),
      feriesCollaborateur: import_zod3.z.boolean()
    });
    MODES_AUTOMATISATION = ["auto", "brouillon", "manuel"];
    AUTOMATISATIONS = [
      { cle: "relances", libelle: "Preparation des relances N1, N2 et N3", defaut: "brouillon" },
      { cle: "digest_do", libelle: "Digest de validation pour la DO", defaut: "brouillon" },
      { cle: "daily", libelle: "Reporting quotidien", defaut: "brouillon" },
      { cle: "typage_ia", libelle: "Typage des evenements par l\u2019IA", defaut: "auto" },
      { cle: "echantillon_qualite", libelle: "Tirage de l\u2019echantillon qualite hebdomadaire", defaut: "auto" }
    ];
    parametresSchema = import_zod3.z.object({
      /** Interrupteur general : coupe toute preparation automatique. */
      pauseAutomatisations: import_zod3.z.boolean(),
      automatisations: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.object({ mode: import_zod3.z.enum(MODES_AUTOMATISATION), actif: import_zod3.z.boolean() })),
      /** Horaires ouvres de reference, utilises quand un compte client n'en definit pas. */
      horaires: horairesSchema,
      sla: import_zod3.z.object({
        /** Delai cible de premiere reponse par famille, en heures ouvrees. */
        parFamille: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number().min(0).max(400)),
        /** Delai au-dela duquel une attente DO est signalee, en heures ouvrees. */
        attenteDoHeures: import_zod3.z.number().min(1).max(400),
        /** Delais avant relance N1, N2 et N3, en heures ouvrees. */
        relances: import_zod3.z.object({ n1: import_zod3.z.number().min(1).max(400), n2: import_zod3.z.number().min(1).max(400), n3: import_zod3.z.number().min(1).max(400) })
      }),
      alertes: import_zod3.z.object({
        /** Jours avant echeance declenchant une alerte dans la file. */
        joursAvantEcheance: import_zod3.z.array(import_zod3.z.number().int().min(0).max(30))
      }),
      qualite: import_zod3.z.object({
        /** Part des envois tires au sort chaque semaine pour le controle qualite. */
        tauxEchantillon: import_zod3.z.number().min(0).max(1)
      }),
      /** Heure (fuseau Antananarivo) de preparation du reporting quotidien. */
      heureDaily: import_zod3.z.number().int().min(0).max(23),
      /** Seuil de confiance du typage automatique : en dessous, la file « A classer ». */
      seuilConfianceTypage: import_zod3.z.number().min(0).max(1)
    });
  }
});

// src/server/lib/parametres.ts
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
  const [ligne] = await db.select().from(schema_exports.parametres).where((0, import_drizzle_orm4.eq)(schema_exports.parametres.cle, CLE));
  const valeur2 = fusionner(ligne?.valeur);
  cache = { valeur: valeur2, lu: Date.now() };
  return valeur2;
}
async function enregistrerParametres(nouveaux, utilisateurId) {
  const valides = fusionner(parametresSchema.parse(nouveaux));
  await db.insert(schema_exports.parametres).values({ cle: CLE, valeur: valides, modifiePar: utilisateurId }).onConflictDoUpdate({ target: schema_exports.parametres.cle, set: { valeur: valides, modifiePar: utilisateurId, majLe: /* @__PURE__ */ new Date() } });
  cache = null;
  return valides;
}
async function horairesDuCompte(compteId) {
  const p = await lireParametres();
  if (!compteId) return p.horaires;
  const [compte] = await db.select({ horaires: schema_exports.comptesClients.horaires }).from(schema_exports.comptesClients).where((0, import_drizzle_orm4.eq)(schema_exports.comptesClients.id, compteId));
  const propres = compte?.horaires;
  if (!propres) return p.horaires;
  return { ...p.horaires, ...propres };
}
var import_drizzle_orm4, CLE, cache;
var init_parametres2 = __esm({
  "src/server/lib/parametres.ts"() {
    "use strict";
    import_drizzle_orm4 = require("drizzle-orm");
    init_client();
    init_parametres();
    CLE = "parametres";
    cache = null;
  }
});

// src/shared/tirets.ts
function retirerTiretsLongs(texte2) {
  if (!TIRETS_LONGS.test(texte2)) return texte2;
  return texte2.replace(/(\d)\s*[\u2012\u2013\u2014\u2015]\s*(\d)/g, "$1 \xE0 $2").replace(/^(\s*)[\u2012\u2013\u2014\u2015]\s*/gm, "$1- ").replace(/\s+[\u2012\u2013\u2014\u2015]\s+/g, ", ").replace(TIRETS_LONGS_G, "-");
}
function nettoyerProfondement(valeur2) {
  if (typeof valeur2 === "string") return retirerTiretsLongs(valeur2);
  if (Array.isArray(valeur2)) return valeur2.map((v) => nettoyerProfondement(v));
  if (valeur2 && typeof valeur2 === "object") {
    const sortie = {};
    for (const [cle, v] of Object.entries(valeur2)) sortie[cle] = nettoyerProfondement(v);
    return sortie;
  }
  return valeur2;
}
var TIRETS_LONGS, TIRETS_LONGS_G;
var init_tirets = __esm({
  "src/shared/tirets.ts"() {
    "use strict";
    TIRETS_LONGS = /[\u2012\u2013\u2014\u2015]/;
    TIRETS_LONGS_G = /[\u2012\u2013\u2014\u2015]/g;
  }
});

// src/server/ai/service.ts
function enregistrerSimulateur(type, fn) {
  simulateurs.set(type, fn);
}
async function demanderIa(demande) {
  const fournisseur = config.ia.fournisseur;
  if (fournisseur === "mock") {
    const simulateur = simulateurs.get(demande.type);
    if (!simulateur) return { sortie: null, statut: "echec", fournisseur, tacheId: null };
    return { sortie: nettoyerProfondement(simulateur(demande.entree)), statut: "traite", fournisseur, tacheId: null };
  }
  const empreinte = sha256(JSON.stringify({ type: demande.type, version: demande.versionPrompt, entree: demande.entree }));
  const [deja] = await db.select().from(schema_exports.aiTasks).where((0, import_drizzle_orm11.and)((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.empreinteEntree, empreinte), (0, import_drizzle_orm11.eq)(schema_exports.aiTasks.statut, "traite"))).limit(1);
  if (deja?.sortie) return { sortie: nettoyerProfondement(deja.sortie), statut: "traite", fournisseur, tacheId: deja.id };
  if (fournisseur === "api") {
    try {
      const sortie = await appelerApi(demande);
      return { sortie: nettoyerProfondement(sortie), statut: "traite", fournisseur, tacheId: null };
    } catch (e) {
      journal.warn("Appel IA en echec, bascule en file", { type: demande.type, erreur: messageErreur(e) });
    }
  }
  const [tache] = await db.insert(schema_exports.aiTasks).values({
    type: demande.type,
    versionPrompt: demande.versionPrompt,
    entree: demande.entree,
    empreinteEntree: empreinte,
    contexte: { ...demande.contexte ?? {}, prompt: demande.prompt, schema: demande.schema },
    statut: "en_attente",
    priorite: demande.priorite ?? 50,
    fournisseur
  }).returning();
  return { sortie: null, statut: "en_attente", fournisseur, tacheId: tache.id };
}
async function appelerApi(demande) {
  if (!config.ia.cleApi) throw new Error("ANTHROPIC_API_KEY absente");
  const modele = config.ia.modeleRapide || config.ia.modeleIntelligent;
  if (!modele) throw new Error("Aucun modele configure (ANTHROPIC_MODEL_FAST ou ANTHROPIC_MODEL_SMART)");
  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.ia.cleApi,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modele,
      max_tokens: 1024,
      system: demande.prompt,
      messages: [{ role: "user", content: JSON.stringify(demande.entree) }]
    }),
    signal: AbortSignal.timeout(config.ia.timeoutMs)
  });
  if (!reponse.ok) throw new Error(`API Anthropic : ${reponse.status}`);
  const corps = await reponse.json();
  const texte2 = corps.content?.find((c) => c.type === "text")?.text ?? "";
  const json = /\{[\s\S]*\}/.exec(texte2)?.[0];
  if (!json) throw new Error("Reponse de l\u2019API sans objet JSON");
  return JSON.parse(json);
}
async function tachesEnAttente(limite = 50) {
  const maintenant = /* @__PURE__ */ new Date();
  const taches = await db.select().from(schema_exports.aiTasks).where(
    (0, import_drizzle_orm11.and)(
      (0, import_drizzle_orm11.or)((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.statut, "en_attente"), (0, import_drizzle_orm11.eq)(schema_exports.aiTasks.statut, "echec")),
      (0, import_drizzle_orm11.or)(import_drizzle_orm11.sql`${schema_exports.aiTasks.verrouilleJusqua} IS NULL`, (0, import_drizzle_orm11.lt)(schema_exports.aiTasks.verrouilleJusqua, maintenant)),
      (0, import_drizzle_orm11.lt)(schema_exports.aiTasks.essais, schema_exports.aiTasks.essaisMax)
    )
  ).orderBy((0, import_drizzle_orm11.asc)(schema_exports.aiTasks.priorite), (0, import_drizzle_orm11.asc)(schema_exports.aiTasks.creeLe)).limit(Math.min(Math.max(limite, 1), 200));
  if (taches.length) {
    const verrou = new Date(maintenant.getTime() + DUREE_VERROU_MS);
    for (const t of taches) {
      await db.update(schema_exports.aiTasks).set({ verrouilleJusqua: verrou, majLe: maintenant }).where((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.id, t.id));
    }
  }
  return taches.map((t) => {
    const contexte = t.contexte ?? {};
    return {
      id: t.id,
      type: t.type,
      version_prompt: t.versionPrompt,
      prompt: contexte.prompt ?? "",
      schema_sortie: contexte.schema ?? {},
      entree: t.entree,
      essais: t.essais
    };
  });
}
async function enregistrerResultat(id2, sortie, erreur2) {
  const [tache] = await db.select().from(schema_exports.aiTasks).where((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.id, id2));
  if (!tache) throw new Error("Tache IA introuvable");
  const essais = tache.essais + 1;
  if (sortie) {
    await db.update(schema_exports.aiTasks).set({ sortie: nettoyerProfondement(sortie), statut: "traite", essais, erreur: null, verrouilleJusqua: null, termineLe: /* @__PURE__ */ new Date(), majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.id, id2));
    return { statut: "traite", essais };
  }
  const statut = essais >= tache.essaisMax ? "abandonne" : "echec";
  await db.update(schema_exports.aiTasks).set({ statut, essais, erreur: (erreur2 ?? "sortie invalide").slice(0, 1e3), verrouilleJusqua: null, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm11.eq)(schema_exports.aiTasks.id, id2));
  return { statut, essais };
}
async function etatFileIa() {
  const lignes = await db.select({ statut: schema_exports.aiTasks.statut, nombre: import_drizzle_orm11.sql`count(*)::int`, plusAncienne: import_drizzle_orm11.sql`min(${schema_exports.aiTasks.creeLe})` }).from(schema_exports.aiTasks).groupBy(schema_exports.aiTasks.statut);
  const enAttente = lignes.find((l) => l.statut === "en_attente");
  return {
    fournisseur: config.ia.fournisseur,
    parStatut: Object.fromEntries(lignes.map((l) => [l.statut, l.nombre])),
    enAttente: enAttente?.nombre ?? 0,
    plusAncienneEnAttente: enAttente?.plusAncienne ?? null
  };
}
var import_drizzle_orm11, simulateurs, DUREE_VERROU_MS;
var init_service = __esm({
  "src/server/ai/service.ts"() {
    "use strict";
    import_drizzle_orm11 = require("drizzle-orm");
    init_client();
    init_config();
    init_journal();
    init_securite();
    init_tirets();
    simulateurs = /* @__PURE__ */ new Map();
    DUREE_VERROU_MS = 15 * 6e4;
  }
});

// src/server/ai/prompts/typer-evenement.ts
function promptTyperEvenement() {
  const familles = FAMILLES.map((f) => `  ${f.code} : ${f.libelle}`).join("\n");
  const natures = DEFINITIONS_NATURES.map((n) => `  ${n.code} : ${n.libelle}, ${n.effet}`).join("\n");
  const interlocuteurs = INTERLOCUTEURS.map((c) => `  ${c} : ${LIBELLES_INTERLOCUTEURS[c]}`).join("\n");
  return [
    "Tu classes un message recu ou envoye par une assistante export, pour une GPAO de suivi d'activite.",
    "",
    "Reponds par un seul objet JSON conforme au schema fourni. Rien avant, rien apres.",
    "",
    "FAMILLES :",
    familles,
    "",
    "NATURES :",
    natures,
    "",
    "INTERLOCUTEURS :",
    interlocuteurs,
    "",
    "REGLES, sans exception :",
    "  1. N'invente rien. Si le message ne permet pas de trancher, baisse la confiance au lieu de deviner.",
    "     Sous le seuil, un humain classera : c\u2019est le comportement voulu, pas un echec.",
    "  2. Chaque champ propose doit s\u2019appuyer sur un extrait du message, que tu rends dans",
    "     justificatifs (quatre au maximum, courts).",
    "  3. Un message de marketing, de design, une notification automatique ou un spam se classe en",
    "     T00 avec une confiance elevee. Ne lui cherche pas une autre famille : il doit sortir du",
    "     pilotage.",
    "  4. Ne reprends jamais une appreciation du client sur la personne qui tient le poste, ni en",
    "     justificatif ni ailleurs. Tu decris ce dont parle le message, pas la qualite du travail.",
    "  5. Aucun tiret long dans ta reponse : ni cadratin, ni demi-cadratin. Virgule, deux-points,",
    "     parentheses ou point.",
    "  6. Le sens est donne quand il est connu. S\u2019il ne l\u2019est pas, deduis-le : un message de",
    "     l'assistante vers l'exterieur est sortant, un message recu est entrant, une note est interne.",
    "",
    "ENTREE : un objet JSON avec objet, corps, expediteur, destinataires et sens eventuel."
  ].join("\n");
}
var VERSION_TYPER_EVENEMENT, SCHEMA_TYPER_EVENEMENT;
var init_typer_evenement = __esm({
  "src/server/ai/prompts/typer-evenement.ts"() {
    "use strict";
    init_constantes();
    VERSION_TYPER_EVENEMENT = "typer_evenement@1";
    SCHEMA_TYPER_EVENEMENT = {
      type: "object",
      properties: {
        famille: { type: "string", description: "Code de famille, par exemple T01" },
        nature: { type: "string", enum: DEFINITIONS_NATURES.map((n) => n.code) },
        sens: { type: "string", enum: [...SENS] },
        interlocuteur: { type: ["string", "null"], enum: [...INTERLOCUTEURS, null] },
        confiance: { type: "number", minimum: 0, maximum: 1 },
        justificatifs: { type: "array", items: { type: "string" }, maxItems: 4 }
      },
      required: ["famille", "nature", "confiance", "justificatifs"]
    };
  }
});

// src/shared/typage.ts
function adresseNue(brut) {
  if (!brut) return null;
  const m = /<([^>]+)>/.exec(brut);
  const candidat = (m ? m[1] : brut).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidat) ? candidat : null;
}
function estUneDe(brut, liste) {
  const adresse2 = adresseNue(brut);
  if (!adresse2 || !liste?.length) return false;
  return liste.some((a) => adresseNue(a) === adresse2);
}
function normaliserTypage(texte2) {
  return texte2.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@.]+/g, " ").replace(/\.(?![a-z0-9])/g, " ").replace(/(?<![a-z0-9])\./g, " ").replace(/\s+/g, " ").trim();
}
function domaineDe(adresse2) {
  if (!adresse2) return null;
  const m = /@([a-z0-9.-]+\.[a-z]{2,})/i.exec(adresse2.trim());
  if (m) return m[1].toLowerCase();
  const nu = adresse2.trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(nu) ? nu : null;
}
function contientExpression(texteNormalise, expression) {
  const cible = normaliserTypage(expression);
  if (!cible) return false;
  const motif = cible.split(" ").map((mot) => {
    const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return mot.length >= 4 && /[a-z]$/.test(mot) ? `${echappe}[sx]?` : echappe;
  }).join(" ");
  return new RegExp(`(^| )${motif}( |$)`).test(texteNormalise);
}
function texteDuMessage(message) {
  const objet = normaliserTypage(message.objet ?? "");
  const corps = normaliserTypage(message.corps ?? "");
  return `${objet} ${objet} ${corps}`.trim();
}
var DOMAINES_INTERNES_PAR_DEFAUT;
var init_typage = __esm({
  "src/shared/typage.ts"() {
    "use strict";
    DOMAINES_INTERNES_PAR_DEFAUT = ["azmg-solutions.com"];
  }
});

// src/server/modules/typage/regles.ts
function evaluerRegle(regle, message, texte2, domaine) {
  if (regle.actif === false) return null;
  if (regle.sens && message.sens && regle.sens !== message.sens) return null;
  if (regle.sens && !message.sens) return null;
  let signaux = 0;
  if (regle.domaine) {
    if (!domaine || !domaine.endsWith(regle.domaine.toLowerCase())) return null;
    signaux++;
  }
  if (regle.motsExclus?.length && regle.motsExclus.some((m) => contientExpression(texte2, m))) return null;
  if (regle.motsObligatoires?.length) {
    if (!regle.motsObligatoires.every((m) => contientExpression(texte2, m))) return null;
    signaux += regle.motsObligatoires.length;
  }
  if (regle.motsCles?.length) {
    const trouves = regle.motsCles.filter((m) => contientExpression(texte2, m)).length;
    if (!trouves) return null;
    signaux += trouves;
  }
  return signaux > 0 ? signaux : null;
}
function appliquerRegles(message, regles = REGLES_INITIALES) {
  const texte2 = texteDuMessage(message);
  if (!texte2) return null;
  const domaine = domaineDe(message.expediteur);
  const correspondances = regles.map((regle) => ({ regle, signaux: evaluerRegle(regle, message, texte2, domaine) })).filter((c) => c.signaux !== null).sort((a, b) => a.regle.priorite - b.regle.priorite || b.signaux - a.signaux);
  if (!correspondances.length) return null;
  const typage = {
    famille: null,
    nature: null,
    interlocuteur: null,
    sens: message.sens ?? null,
    confiance: 0,
    justificatifs: [],
    origine: "regle",
    regleId: null
  };
  const appliquees = [];
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
  completerParDefaut(typage, message);
  typage.confiance = confianceRegles(typage, appliquees);
  return { typage, regle: principale.regle, signaux: principale.signaux };
}
function deduireInterlocuteur(typage, message) {
  if (message.adresseDo) {
    const deLaDo = estUneDe(message.expediteur, [message.adresseDo]);
    const versLaDo = message.destinataires?.some((d) => estUneDe(d, [message.adresseDo])) ?? false;
    if (deLaDo || versLaDo) {
      typage.interlocuteur = "do";
      typage.justificatifs.push(deLaDo ? "message recu de l\u2019adresse de la donneuse d\u2019ordre" : "message adresse a la donneuse d\u2019ordre");
      return;
    }
  }
  const domaine = domaineDe(message.expediteur);
  const internes = message.domainesInternes ?? DOMAINES_INTERNES_PAR_DEFAUT;
  if (domaine && internes.some((d) => domaine.endsWith(d))) {
    typage.interlocuteur = "interne_azmg";
    typage.justificatifs.push("expediteur sur un domaine interne AZMG");
  }
}
function completerParDefaut(typage, message) {
  deduireInterlocuteur(typage, message);
  if (!typage.famille && typage.nature && ["validation_do", "refus_do", "demande_validation_do"].includes(typage.nature)) {
    typage.famille = "T13";
    typage.justificatifs.push("decision attendue de la DO, sans autre famille identifiee");
  }
  if (!typage.nature && message.sens) {
    if (message.sens === "sortant" && typage.interlocuteur === "do") {
      typage.nature = "demande_validation_do";
      typage.justificatifs.push("envoi a la donneuse d\u2019ordre, decision attendue");
    } else {
      typage.nature = message.sens === "sortant" ? "envoi_livrable" : "information";
      typage.justificatifs.push(`nature deduite du sens \xAB ${message.sens} \xBB`);
    }
  }
}
function confianceRegles(typage, appliquees) {
  const signaux = appliquees.reduce((s, a) => s + a.signaux, 0);
  const parDefaut = typage.justificatifs.filter((j) => j.startsWith("nature deduite") || j.startsWith("decision attendue")).length;
  let base = 0.4;
  if (typage.famille) base += 0.25;
  if (typage.nature) base += 0.2;
  if (typage.interlocuteur) base += 0.05;
  base -= parDefaut * 0.12;
  const bonus = Math.min(0.15, Math.max(0, signaux - 1) * 0.05);
  if (typage.famille === "T00") return Math.min(0.95, 0.85 + bonus);
  return Math.round(Math.min(0.95, base + bonus) * 100) / 100;
}
var REGLES_INITIALES;
var init_regles = __esm({
  "src/server/modules/typage/regles.ts"() {
    "use strict";
    init_typage();
    REGLES_INITIALES = [
      // --- Hors perimetre (T00) : sort du pilotage avant toute autre regle -------
      {
        libelle: "Message promotionnel ou newsletter",
        motsCles: ["newsletter", "se desinscrire", "desinscription", "unsubscribe", "promotion", "offre speciale", "webinar", "webinaire", "ne plus recevoir"],
        famille: "T00",
        nature: "information",
        priorite: 10
      },
      {
        libelle: "Notification automatique de systeme",
        motsCles: ["no reply", "noreply", "ne pas repondre", "notification automatique", "message automatique", "mot de passe", "votre compte", "mise a jour de securite"],
        famille: "T00",
        nature: "information",
        priorite: 11
      },
      // --- Familles du poste de designer (D01 a D03) -----------------------------
      // Ce travail etait classe T00 tant qu'un seul poste etait pilote : il etait hors du perimetre
      // de l'assistante export, donc hors de tout. Il a desormais ses familles et son poste.
      {
        libelle: "Publication sur les reseaux sociaux",
        motsCles: ["publication linkedin", "post linkedin", "brouillon linkedin", "post instagram", "community manager", "page linkedin", "calendrier editorial"],
        famille: "D01",
        priorite: 12
      },
      {
        libelle: "Visuel ou support de communication",
        motsCles: ["maquette", "visuel", "charte graphique", "logo", "banniere", "brochure", "kakemono", "plv", "affiche"],
        motsExclus: ["etiquette", "bat", "packaging"],
        famille: "D02",
        priorite: 13
      },
      {
        libelle: "Catalogue, fiche produit ou contenu marketing",
        motsCles: ["catalogue produit", "fiche produit", "contenu marketing", "campagne marketing", "newsletter client", "plaquette"],
        motsExclus: ["se desinscrire", "unsubscribe"],
        famille: "D03",
        priorite: 14
      },
      // --- Signaux tres specifiques --------------------------------------------
      {
        libelle: "Paiement, SWIFT ou solde",
        motsCles: ["swift", "virement", "solde", "reglement", "paiement", "impaye", "echeance de paiement", "avis de credit"],
        famille: "T04",
        interlocuteur: "client",
        priorite: 20
      },
      {
        libelle: "Cut-off, booking ou cotation fret",
        motsCles: ["cut off", "cutoff", "booking", "cotation", "fret", "freight", "taux de fret", "lcl", "fcl", "etd", "eta"],
        famille: "T01",
        interlocuteur: "transitaire",
        priorite: 21
      },
      {
        libelle: "Legalisation et enregistrement reglementaire",
        motsCles: ["legalisation", "legalise", "enregistrement du produit", "fsc", "gmp", "certificat de vente libre", "coc", "chambre de commerce", "apostille", "autorisation de mise sur le marche"],
        famille: "T05",
        interlocuteur: "autorite",
        priorite: 22
      },
      {
        libelle: "Tracking et transport express",
        motsCles: ["tracking", "numero de suivi", "dhl", "fedex", "ups", "surestarie", "demurrage", "detention", "colis"],
        famille: "T14",
        interlocuteur: "transporteur",
        priorite: 23
      },
      // --- Familles metier ------------------------------------------------------
      {
        libelle: "Documents d\u2019expedition",
        motsCles: ["bl", "bill of lading", "awb", "lettre de transport", "packing list", "shipping mark", "connaissement", "enlevement", "empotage", "chargement"],
        famille: "T02",
        priorite: 30
      },
      {
        libelle: "Proforma, facture et domiciliation",
        motsCles: ["proforma", "pro forma", "facture", "invoice", "pfi", "domiciliation", "pre domiciliation", "avoir"],
        famille: "T03",
        priorite: 31
      },
      {
        libelle: "Relance de paiement ou de piece manquante",
        motsCles: ["relance", "rappel", "piece manquante", "document manquant", "sans reponse", "toujours en attente"],
        famille: "T04",
        priorite: 32
      },
      {
        libelle: "Tableau de situation",
        motsCles: ["tableau de situation", "point de situation", "etat des commandes", "recapitulatif des dossiers", "situation par pays"],
        famille: "T06",
        interlocuteur: "do",
        priorite: 33
      },
      {
        libelle: "Qualite : COA, BAT, etiquettes et echantillons",
        motsCles: ["coa", "certificat d analyse", "bat", "bon a tirer", "etiquette", "echantillon", "packaging", "notice produit"],
        famille: "T07",
        interlocuteur: "qualite",
        priorite: 34
      },
      {
        libelle: "Lead, catalogue et offre commerciale",
        motsCles: ["nouveau client", "prospect", "catalogue", "liste de prix", "moq", "clientify", "demande de partenariat", "nouvelle demande commerciale"],
        famille: "T08",
        interlocuteur: "prospect",
        priorite: 35
      },
      {
        libelle: "Reporting quotidien",
        motsCles: ["rapport quotidien", "daily", "compte rendu du jour", "reporting du jour", "suivi quotidien"],
        famille: "T09",
        interlocuteur: "do",
        priorite: 36
      },
      {
        libelle: "Stagiaire : onboarding et evaluation",
        motsCles: ["stagiaire", "stage", "onboarding", "evaluation de stage", "convention de stage", "tutorat"],
        famille: "T10",
        interlocuteur: "stagiaire",
        priorite: 37
      },
      {
        libelle: "Salon professionnel",
        motsCles: ["salon", "badge", "exposant", "stand", "vitafoods", "cphi", "rendez vous sur le salon"],
        famille: "T11",
        priorite: 38
      },
      {
        libelle: "Lettre d\u2019invitation et courrier type",
        motsCles: ["lettre d invitation", "invitation letter", "courrier type", "attestation", "lettre officielle", "visa"],
        famille: "T12",
        priorite: 39
      },
      {
        libelle: "Transfert a la DO pour decision",
        motsCles: ["pour decision", "je te laisse trancher", "je vous laisse decider", "a arbitrer", "besoin de ton arbitrage", "que decide t on"],
        famille: "T13",
        interlocuteur: "do",
        priorite: 40
      },
      // --- Natures --------------------------------------------------------------
      {
        libelle: "Demande de validation a la DO",
        motsCles: [
          "merci de valider",
          "pouvez vous valider",
          "peux tu valider",
          "pour validation",
          "ton accord",
          "votre accord",
          "je te soumets",
          "je vous soumets",
          "pour approbation",
          "je te laisse trancher",
          "je vous laisse decider",
          "besoin de ton arbitrage",
          "je ne peux pas decider"
        ],
        sens: "sortant",
        nature: "demande_validation_do",
        interlocuteur: "do",
        priorite: 50
      },
      {
        libelle: "Validation de la DO",
        motsCles: ["je valide", "c est valide", "d accord pour", "ok pour", "tu peux y aller", "vous pouvez proceder", "bon pour accord"],
        sens: "entrant",
        nature: "validation_do",
        interlocuteur: "do",
        priorite: 51
      },
      {
        libelle: "Refus de la DO",
        motsCles: ["je ne valide pas", "ne pas envoyer", "on ne fait pas", "refuse", "a revoir", "ne convient pas"],
        sens: "entrant",
        nature: "refus_do",
        interlocuteur: "do",
        priorite: 52
      },
      {
        libelle: "Consigne de la DO",
        motsCles: ["merci de preparer", "peux tu preparer", "il faut faire", "je te demande de", "tu dois", "prepare", "lance la procedure", "occupe toi de"],
        sens: "entrant",
        nature: "consigne_do",
        interlocuteur: "do",
        priorite: 53
      },
      {
        libelle: "Envoi de livrable",
        motsCles: ["veuillez trouver ci joint", "ci joint", "en piece jointe", "je vous transmets", "je t envoie", "voici le document", "please find attached"],
        sens: "sortant",
        nature: "envoi_livrable",
        priorite: 54
      },
      {
        libelle: "Relance emise",
        motsCles: ["relance", "je me permets de revenir", "sans retour de votre part", "pour rappel", "je reviens vers vous"],
        sens: "sortant",
        nature: "relance_emise",
        priorite: 55
      },
      {
        libelle: "Reponse du tiers",
        motsCles: ["suite a votre demande", "en reponse a", "voici notre offre", "notre proposition", "comme convenu"],
        sens: "entrant",
        nature: "reponse_tiers",
        priorite: 57
      },
      {
        libelle: "Information explicitement annoncee",
        motsCles: ["pour information", "pour info", "a titre informatif", "je vous informe", "je t informe"],
        nature: "information",
        priorite: 45
      },
      {
        libelle: "Relance recue",
        motsCles: ["toujours sans reponse", "nous attendons toujours", "sans retour de votre part", "nous relancons", "ou en est", "ou en sont"],
        sens: "entrant",
        nature: "relance_recue",
        priorite: 46
      },
      {
        libelle: "Demande entrante",
        motsCles: [
          "pourriez vous",
          "pouvez vous nous",
          "pouvez vous me",
          "merci de nous faire parvenir",
          "nous souhaitons recevoir",
          "souhaitons recevoir",
          "auriez vous",
          "serait il possible",
          "je vous demande",
          "nous aurions besoin",
          "nous avons besoin",
          "merci de me renvoyer",
          "pourriez vous me",
          "demande de"
        ],
        sens: "entrant",
        nature: "demande_entrante",
        priorite: 48
      },
      {
        libelle: "Reponse d\u2019un tiers qui joint une piece",
        motsCles: ["veuillez trouver ci joint", "ci joint", "en piece jointe", "je vous transmets", "voici", "nous confirmons", "please find attached"],
        sens: "entrant",
        nature: "reponse_tiers",
        priorite: 57
      },
      {
        libelle: "Accuse de reception ou information",
        motsCles: ["bien recu", "bien note", "merci pour votre message", "accuse de reception", "pour information", "pour info"],
        nature: "information",
        priorite: 58
      },
      // --- Interlocuteurs -------------------------------------------------------
      {
        libelle: "Interlocuteur transitaire",
        motsCles: ["transitaire", "forwarder", "agence maritime", "consignataire", "commissionnaire de transport"],
        interlocuteur: "transitaire",
        priorite: 60
      },
      {
        libelle: "Interlocuteur fournisseur",
        motsCles: ["fournisseur", "notre usine", "production", "approvisionnement", "bon de commande fournisseur"],
        interlocuteur: "fournisseur",
        priorite: 61
      },
      {
        libelle: "Interlocuteur Qualite",
        motsCles: ["service qualite", "assurance qualite", "responsable qualite", "controle qualite"],
        interlocuteur: "qualite",
        priorite: 62
      }
    ];
  }
});

// src/server/modules/typage/service.ts
var service_exports = {};
__export(service_exports, {
  accepterRegle: () => accepterRegle,
  initialiserRegles: () => initialiserRegles,
  proposerRegle: () => proposerRegle,
  refuserRegle: () => refuserRegle,
  reglesActives: () => reglesActives,
  reglesProposees: () => reglesProposees,
  sortieTypageSchema: () => sortieTypageSchema,
  sql: () => import_drizzle_orm12.sql,
  typerMessage: () => typerMessage
});
async function reglesActives(compteId) {
  const lignes = await db.select().from(schema_exports.reglesTypage).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.actif, true), (0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.proposee, false))).orderBy((0, import_drizzle_orm12.asc)(schema_exports.reglesTypage.priorite));
  const enBase = lignes.filter((l) => !l.compteId || !compteId || l.compteId === compteId).map((l) => ({
    id: l.id,
    libelle: l.libelle,
    domaine: l.domaine,
    motsCles: l.motsCles ?? [],
    famille: l.famille,
    nature: l.nature,
    interlocuteur: l.interlocuteur,
    priorite: l.priorite,
    actif: l.actif
  }));
  return enBase.length ? enBase : REGLES_INITIALES;
}
async function initialiserRegles() {
  let ajoutees = 0;
  for (const regle of REGLES_INITIALES) {
    const [existe] = await db.select({ id: schema_exports.reglesTypage.id }).from(schema_exports.reglesTypage).where((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.libelle, regle.libelle));
    if (existe) continue;
    await db.insert(schema_exports.reglesTypage).values({
      libelle: regle.libelle,
      domaine: regle.domaine ?? null,
      motsCles: regle.motsCles ?? [],
      famille: regle.famille ?? null,
      nature: regle.nature ?? null,
      interlocuteur: regle.interlocuteur ?? null,
      priorite: regle.priorite,
      actif: true,
      proposee: false
    });
    ajoutees++;
  }
  return { ajoutees };
}
async function typerMessage(message, opts = {}) {
  const parametres2 = await lireParametres();
  const seuil = parametres2.seuilConfianceTypage;
  const parRegles = appliquerRegles(message, await reglesActives(opts.compteId));
  if (parRegles && (parRegles.typage.confiance >= seuil || estHorsPerimetre(parRegles.typage.famille))) {
    return { typage: parRegles.typage, applicable: true, tacheIaId: null };
  }
  if (opts.sansIa || parametres2.pauseAutomatisations || parametres2.automatisations.typage_ia?.actif === false) {
    return { typage: parRegles?.typage ?? typageVide(message), applicable: false, tacheIaId: null };
  }
  const resultat = await demanderIa({
    type: "typer_evenement",
    versionPrompt: VERSION_TYPER_EVENEMENT,
    prompt: promptTyperEvenement(),
    schema: SCHEMA_TYPER_EVENEMENT,
    entree: {
      objet: message.objet ?? "",
      corps: (message.corps ?? "").slice(0, 4e3),
      expediteur: message.expediteur ?? "",
      destinataires: message.destinataires ?? [],
      sens: message.sens ?? null
    },
    contexte: { compteId: opts.compteId ?? null },
    priorite: 30
  });
  if (resultat.statut === "traite" && resultat.sortie) {
    const valide = sortieTypageSchema.safeParse(resultat.sortie);
    if (valide.success) {
      const typage = {
        famille: valide.data.famille,
        nature: valide.data.nature,
        interlocuteur: valide.data.interlocuteur ?? parRegles?.typage.interlocuteur ?? null,
        sens: valide.data.sens ?? message.sens ?? null,
        confiance: valide.data.confiance,
        justificatifs: valide.data.justificatifs,
        origine: "ia"
      };
      return { typage, applicable: typage.confiance >= seuil, tacheIaId: null };
    }
  }
  return { typage: parRegles?.typage ?? typageVide(message), applicable: false, tacheIaId: resultat.tacheId };
}
function typageVide(message) {
  return {
    famille: null,
    nature: null,
    interlocuteur: null,
    sens: message.sens ?? null,
    confiance: 0,
    justificatifs: [],
    origine: "defaut"
  };
}
async function proposerRegle(evenementId, correction, auteur) {
  const [evenement] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm12.eq)(schema_exports.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, "Evenement introuvable");
  const motsObjet = normaliserTypage(evenement.objet ?? "").split(" ").filter((m) => m.length >= 4 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m));
  const motsCles = [...new Set(motsObjet)].slice(0, 4);
  const domaineBrut = domaineDe(evenement.expediteur);
  const domaine = domaineBrut && !domaineBrut.includes("azmg-solutions") ? domaineBrut : null;
  if (!motsCles.length && !domaine) return null;
  const libelle = `Propose depuis \xAB ${(evenement.objet ?? "un evenement").slice(0, 60)} \xBB`;
  const [existe] = await db.select({ id: schema_exports.reglesTypage.id }).from(schema_exports.reglesTypage).where((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.libelle, libelle));
  if (existe) return null;
  const [regle] = await db.insert(schema_exports.reglesTypage).values({
    compteId: evenement.compteId,
    libelle,
    domaine,
    motsCles,
    famille: correction.famille ?? null,
    nature: correction.nature ?? null,
    interlocuteur: correction.interlocuteur ?? null,
    // Priorite basse : une regle proposee ne doit pas primer sur le referentiel.
    priorite: 80,
    actif: true,
    proposee: true,
    creeParId: auteur.utilisateurId
  }).returning();
  await journaliser("regle_proposee", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "regle_typage",
    entiteId: regle.id,
    details: { evenementId, motsCles, famille: correction.famille ?? null, nature: correction.nature ?? null }
  });
  return { regleId: regle.id, motsCles, domaine };
}
async function accepterRegle(regleId, auteur) {
  const [maj] = await db.update(schema_exports.reglesTypage).set({ proposee: false, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.id, regleId)).returning();
  if (!maj) throw new ErreurHttp(404, "Regle introuvable");
  await journaliser("regle_acceptee", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "regle_typage", entiteId: regleId });
  return maj;
}
async function refuserRegle(regleId, auteur) {
  const [maj] = await db.update(schema_exports.reglesTypage).set({ actif: false, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.id, regleId)).returning();
  if (!maj) throw new ErreurHttp(404, "Regle introuvable");
  await journaliser("regle_refusee", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "regle_typage", entiteId: regleId });
  return maj;
}
async function reglesProposees(limite = 50) {
  return db.select().from(schema_exports.reglesTypage).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.proposee, true), (0, import_drizzle_orm12.eq)(schema_exports.reglesTypage.actif, true))).orderBy((0, import_drizzle_orm12.desc)(schema_exports.reglesTypage.creeLe)).limit(limite);
}
var import_drizzle_orm12, import_zod6, sortieTypageSchema, MOTS_VIDES;
var init_service2 = __esm({
  "src/server/modules/typage/service.ts"() {
    "use strict";
    import_drizzle_orm12 = require("drizzle-orm");
    import_zod6 = require("zod");
    init_client();
    init_http();
    init_evenements();
    init_parametres2();
    init_service();
    init_typer_evenement();
    init_regles();
    init_typage();
    init_constantes();
    sortieTypageSchema = import_zod6.z.object({
      famille: import_zod6.z.enum(CODES_FAMILLES),
      nature: import_zod6.z.enum(NATURES),
      sens: import_zod6.z.enum(SENS).optional(),
      interlocuteur: import_zod6.z.enum(INTERLOCUTEURS).nullish(),
      confiance: import_zod6.z.number().min(0).max(1),
      justificatifs: import_zod6.z.array(import_zod6.z.string().max(300)).max(4).default([])
    });
    enregistrerSimulateur("typer_evenement", (entree) => {
      const message = entree;
      const parRegles = appliquerRegles(message, REGLES_INITIALES);
      if (!parRegles?.typage.famille || !parRegles.typage.nature) {
        return { famille: "T00", nature: "information", confiance: 0.1, justificatifs: ["aucune regle ne tranche"] };
      }
      return {
        famille: parRegles.typage.famille,
        nature: parRegles.typage.nature,
        sens: parRegles.typage.sens ?? void 0,
        interlocuteur: parRegles.typage.interlocuteur,
        confiance: parRegles.typage.confiance,
        justificatifs: parRegles.typage.justificatifs.slice(0, 4)
      };
    });
    MOTS_VIDES = /* @__PURE__ */ new Set([
      "le",
      "la",
      "les",
      "un",
      "une",
      "des",
      "du",
      "de",
      "et",
      "ou",
      "a",
      "au",
      "aux",
      "en",
      "pour",
      "par",
      "sur",
      "dans",
      "avec",
      "sans",
      "ce",
      "cet",
      "cette",
      "nous",
      "vous",
      "je",
      "tu",
      "il",
      "elle",
      "est",
      "sont",
      "ete",
      "avoir",
      "etre",
      "que",
      "qui",
      "quoi",
      "dont",
      "votre",
      "notre",
      "vos",
      "nos",
      "son",
      "sa",
      "ses",
      "leur",
      "bonjour",
      "merci",
      "cordialement",
      "re",
      "fw",
      "tr",
      "objet",
      "madame",
      "monsieur",
      "bien",
      "tres",
      "plus",
      "pas",
      "ne",
      "se",
      "si",
      "mais",
      "donc",
      // Mots de contexte, trop frequents dans les echanges du poste pour distinguer quoi que ce soit.
      "dossier",
      "dossiers",
      "point",
      "points",
      "suite",
      "echange",
      "echanges",
      "message",
      "messages",
      "concernant",
      "sujet",
      "nouvelle",
      "nouveau",
      "nouvelles",
      "nouveaux",
      "urgent",
      "important",
      "information",
      "informations",
      "retour",
      "reponse",
      "question",
      "questions",
      "elements",
      "element"
    ]);
  }
});

// src/server/app.ts
var import_express16 = __toESM(require("express"));
var import_compression = __toESM(require("compression"));
var import_helmet = __toESM(require("helmet"));
var import_node_path5 = __toESM(require("node:path"));
var import_node_fs2 = __toESM(require("node:fs"));
init_config();

// src/server/lib/file.ts
var import_drizzle_orm = require("drizzle-orm");
var import_node_os = __toESM(require("node:os"));
init_client();
init_journal();
init_evenements();
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
init_journal();
enregistrerGestionnaire("ping", async (payload) => {
  journal.info("Tache ping traitee", { payload });
});

// src/server/app.ts
init_client();
init_http();

// src/server/modules/auth/middleware.ts
var import_cookie = require("cookie");

// src/server/modules/auth/service.ts
var import_node_crypto2 = __toESM(require("node:crypto"));
var import_hash_wasm = require("hash-wasm");
var import_drizzle_orm2 = require("drizzle-orm");
init_client();
init_securite();
var DUREE_SESSION_MS = 12 * 36e5;
async function hacherMotDePasse(motDePasse) {
  return (0, import_hash_wasm.argon2id)({
    password: motDePasse,
    salt: import_node_crypto2.default.randomBytes(16),
    parallelism: 1,
    iterations: 3,
    memorySize: 19456,
    hashLength: 32,
    outputType: "encoded"
  });
}
async function verifierMotDePasse(motDePasse, hache) {
  try {
    return await (0, import_hash_wasm.argon2Verify)({ password: motDePasse, hash: hache });
  } catch {
    return false;
  }
}
async function creerUtilisateur(u) {
  const [ligne] = await db.insert(schema_exports.utilisateurs).values({ email: u.email.trim().toLowerCase(), nom: u.nom, role: u.role, motDePasseHash: await hacherMotDePasse(u.motDePasse) }).returning();
  return ligne;
}
var empreinteFactice = null;
async function authentifier(email, motDePasse) {
  const [u] = await db.select().from(schema_exports.utilisateurs).where((0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) {
    empreinteFactice ??= await hacherMotDePasse("mot-de-passe-factice");
    await verifierMotDePasse(motDePasse, empreinteFactice);
    return null;
  }
  if (!await verifierMotDePasse(motDePasse, u.motDePasseHash)) return null;
  await db.update(schema_exports.utilisateurs).set({ derniereConnexionLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.id, u.id));
  return u;
}
async function ouvrirSession(utilisateurId) {
  const jeton = jetonAleatoire(32);
  const csrf = jetonAleatoire(24);
  await db.delete(schema_exports.sessions).where((0, import_drizzle_orm2.lt)(schema_exports.sessions.expireLe, /* @__PURE__ */ new Date()));
  await db.insert(schema_exports.sessions).values({ id: sha256(jeton), utilisateurId, jetonCsrf: csrf, expireLe: new Date(Date.now() + DUREE_SESSION_MS) });
  return { jeton, csrf };
}
async function lireSession(jeton) {
  if (!jeton) return null;
  const [ligne] = await db.select({ session: schema_exports.sessions, utilisateur: schema_exports.utilisateurs }).from(schema_exports.sessions).innerJoin(schema_exports.utilisateurs, (0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.id, schema_exports.sessions.utilisateurId)).where((0, import_drizzle_orm2.and)((0, import_drizzle_orm2.eq)(schema_exports.sessions.id, sha256(jeton)), (0, import_drizzle_orm2.gt)(schema_exports.sessions.expireLe, /* @__PURE__ */ new Date()), (0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.actif, true)));
  if (!ligne) return null;
  if (ligne.session.expireLe.getTime() - Date.now() < DUREE_SESSION_MS / 2) {
    await db.update(schema_exports.sessions).set({ expireLe: new Date(Date.now() + DUREE_SESSION_MS) }).where((0, import_drizzle_orm2.eq)(schema_exports.sessions.id, ligne.session.id));
  }
  return {
    utilisateur: { id: ligne.utilisateur.id, email: ligne.utilisateur.email, nom: ligne.utilisateur.nom, role: ligne.utilisateur.role },
    csrf: ligne.session.jetonCsrf
  };
}
async function fermerSession(jeton) {
  if (jeton) await db.delete(schema_exports.sessions).where((0, import_drizzle_orm2.eq)(schema_exports.sessions.id, sha256(jeton)));
}
async function demanderReinitialisation(email) {
  const [u] = await db.select().from(schema_exports.utilisateurs).where((0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) return null;
  const jeton = jetonAleatoire(32);
  await db.insert(schema_exports.reinitialisations).values({ utilisateurId: u.id, jetonHash: sha256(jeton), expireLe: new Date(Date.now() + 36e5) });
  return jeton;
}
async function reinitialiserMotDePasse(jeton, motDePasse) {
  const [r] = await db.select().from(schema_exports.reinitialisations).where(
    (0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.reinitialisations.jetonHash, sha256(jeton)),
      (0, import_drizzle_orm2.isNull)(schema_exports.reinitialisations.utiliseLe),
      (0, import_drizzle_orm2.gt)(schema_exports.reinitialisations.expireLe, /* @__PURE__ */ new Date())
    )
  );
  if (!r) return false;
  await db.update(schema_exports.utilisateurs).set({ motDePasseHash: await hacherMotDePasse(motDePasse), majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.utilisateurs.id, r.utilisateurId));
  await db.update(schema_exports.reinitialisations).set({ utiliseLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.reinitialisations.id, r.id));
  await db.delete(schema_exports.sessions).where((0, import_drizzle_orm2.eq)(schema_exports.sessions.utilisateurId, r.utilisateurId));
  return true;
}

// src/server/modules/auth/middleware.ts
init_http();
init_securite();
var COOKIE_SESSION = "azmg_gpao_session";
var COOKIE_CSRF = "azmg_gpao_csrf";
function lireCookies(req) {
  return (0, import_cookie.parse)(req.headers.cookie ?? "");
}
async function chargerSession(req, _res, next) {
  try {
    const s = await lireSession(lireCookies(req)[COOKIE_SESSION]);
    if (s) {
      req.utilisateur = s.utilisateur;
      req.csrfAttendu = s.csrf;
    }
    next();
  } catch (e) {
    next(e);
  }
}
function exigerConnexion(req, _res, next) {
  if (!req.utilisateur) return next(new ErreurHttp(401, "Authentification requise"));
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const jeton = String(req.headers["x-csrf-token"] ?? "");
    if (!req.csrfAttendu || !jeton || !egaliteConstante(jeton, req.csrfAttendu)) {
      return next(new ErreurHttp(403, "Jeton CSRF invalide"));
    }
  }
  next();
}
function exigerRole(...roles) {
  return (req, _res, next) => {
    if (!req.utilisateur) return next(new ErreurHttp(401, "Authentification requise"));
    if (!roles.includes(req.utilisateur.role)) return next(new ErreurHttp(403, "Acces refuse pour votre role"));
    next();
  };
}
var exigerEcriture = exigerRole("admin", "manager", "collaborateur");
var exigerPilotage = exigerRole("admin", "manager");

// src/server/modules/auth/routes.ts
var import_express = require("express");
var import_express_rate_limit = __toESM(require("express-rate-limit"));
var import_zod2 = require("zod");
var import_drizzle_orm3 = require("drizzle-orm");
init_client();
init_config();
init_http();
init_evenements();
init_journal();

// src/shared/validation.ts
var import_zod = require("zod");
init_constantes();
var motDePasseSchema = import_zod.z.string().min(10, "Le mot de passe doit contenir au moins 10 caracteres").max(200);
var emailSchema = import_zod.z.string().trim().toLowerCase().email("Adresse email invalide");
var familleSchema = import_zod.z.string().trim().min(2).max(10);
var familleConnueSchema = import_zod.z.enum(CODES_FAMILLES);
var instant = import_zod.z.union([import_zod.z.string().datetime({ offset: true }), import_zod.z.string().datetime(), import_zod.z.date()]).transform((v) => new Date(v));
var instantOptionnel = instant.nullable().optional();
var connexionSchema = import_zod.z.object({ email: emailSchema, motDePasse: import_zod.z.string().min(1, "Mot de passe requis") });
var creationUtilisateurSchema = import_zod.z.object({
  email: emailSchema,
  nom: import_zod.z.string().trim().min(2, "Nom trop court").max(120),
  role: import_zod.z.enum(ROLES),
  motDePasse: motDePasseSchema
});
var modificationUtilisateurSchema = import_zod.z.object({
  nom: import_zod.z.string().trim().min(2).max(120).optional(),
  role: import_zod.z.enum(ROLES).optional(),
  actif: import_zod.z.boolean().optional()
});
var compteSchema = import_zod.z.object({
  nom: import_zod.z.string().trim().min(2).max(160),
  code: import_zod.z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "Code attendu en minuscules, chiffres et tirets").optional(),
  pays: import_zod.z.string().trim().max(80).nullish(),
  ville: import_zod.z.string().trim().max(80).nullish(),
  fuseau: import_zod.z.string().trim().min(3).max(64).optional(),
  donneurOrdreNom: import_zod.z.string().trim().max(120).nullish(),
  donneurOrdreEmail: import_zod.z.union([emailSchema, import_zod.z.literal("")]).nullish(),
  /** Adresses du client a ne pas suivre : leurs messages ne sont pas collectes. */
  adressesIgnorees: import_zod.z.array(emailSchema).max(20).optional(),
  managerId: import_zod.z.number().int().positive().nullish()
});
var modificationCompteSchema = compteSchema.partial().extend({ actif: import_zod.z.boolean().optional(), horaires: import_zod.z.unknown().optional() });
var posteSchema = import_zod.z.object({
  compteId: import_zod.z.number().int().positive(),
  intitule: import_zod.z.string().trim().min(2).max(160),
  collaborateurId: import_zod.z.number().int().positive().nullish(),
  metier: import_zod.z.enum(["export", "designer"]).optional(),
  /** Adresses depuis lesquelles ce poste ecrit, souvent des adresses du client. */
  adresses: import_zod.z.array(emailSchema).max(10).optional(),
  /** Familles du perimetre. Vide : toutes les familles hors T00. */
  familles: import_zod.z.array(import_zod.z.string().trim().regex(/^[A-Z]\d{2}$/)).max(40).optional()
});
var modificationPosteSchema = import_zod.z.object({
  intitule: import_zod.z.string().trim().min(2).max(160).optional(),
  collaborateurId: import_zod.z.number().int().positive().nullish(),
  metier: import_zod.z.enum(["export", "designer"]).optional(),
  adresses: import_zod.z.array(emailSchema).max(10).optional(),
  familles: import_zod.z.array(import_zod.z.string().trim().regex(/^[A-Z]\d{2}$/)).max(40).optional(),
  actif: import_zod.z.boolean().optional()
});
var dossierSchema = import_zod.z.object({
  compteId: import_zod.z.number().int().positive(),
  posteId: import_zod.z.number().int().positive().nullish(),
  client: import_zod.z.string().trim().min(1, "Client obligatoire").max(160),
  pays: import_zod.z.string().trim().max(80).nullish(),
  produit: import_zod.z.string().trim().max(200).nullish(),
  operation: import_zod.z.string().trim().max(200).nullish(),
  libelle: import_zod.z.string().trim().max(300).optional(),
  statut: import_zod.z.enum(STATUTS_DOSSIER).optional(),
  references: import_zod.z.record(import_zod.z.string(), import_zod.z.unknown()).optional(),
  notes: import_zod.z.string().trim().max(5e3).nullish()
});
var modificationDossierSchema = dossierSchema.partial().omit({ compteId: true }).extend({ resume: import_zod.z.string().trim().max(500).nullish() });
var demandeSchema = import_zod.z.object({
  dossierId: import_zod.z.number().int().positive(),
  famille: familleSchema,
  objet: import_zod.z.string().trim().min(2, "Objet trop court").max(300),
  origine: import_zod.z.enum(SOURCES).optional(),
  priorite: import_zod.z.enum(PRIORITES).optional(),
  statut: import_zod.z.enum(STATUTS).optional(),
  echeanceLe: instantOptionnel,
  notes: import_zod.z.string().trim().max(5e3).nullish()
});
var changementStatutSchema = import_zod.z.object({
  statut: import_zod.z.enum(STATUTS),
  motif: import_zod.z.string().trim().max(300).nullish(),
  acteurAttendu: import_zod.z.enum(ACTEURS).optional()
});
var modificationDemandeSchema = import_zod.z.object({
  objet: import_zod.z.string().trim().min(2).max(300).optional(),
  famille: familleSchema.optional(),
  priorite: import_zod.z.enum(PRIORITES).optional(),
  echeanceLe: instantOptionnel,
  notes: import_zod.z.string().trim().max(5e3).nullish(),
  posteId: import_zod.z.number().int().positive().nullish()
});
var filtresFileSchema = import_zod.z.object({
  compteId: import_zod.z.coerce.number().int().positive().optional(),
  posteId: import_zod.z.coerce.number().int().positive().optional(),
  famille: import_zod.z.string().trim().optional(),
  acteur: import_zod.z.enum(ACTEURS).optional(),
  statut: import_zod.z.enum(STATUTS).optional(),
  risque: import_zod.z.enum(["0", "1", "true", "false"]).optional(),
  limite: import_zod.z.coerce.number().int().min(1).max(1e3).optional()
});
var evenementSchema = import_zod.z.object({
  demandeId: import_zod.z.number().int().positive().nullish(),
  dossierId: import_zod.z.number().int().positive().nullish(),
  sens: import_zod.z.enum(SENS),
  nature: import_zod.z.enum(NATURES),
  famille: familleSchema.nullish(),
  interlocuteur: import_zod.z.enum(INTERLOCUTEURS).nullish(),
  source: import_zod.z.enum(SOURCES),
  survenuLe: instant.optional(),
  objet: import_zod.z.string().trim().max(300).nullish(),
  resume: import_zod.z.string().trim().max(1e3).nullish(),
  contenu: import_zod.z.string().trim().max(5e4).nullish(),
  filId: import_zod.z.string().trim().max(200).nullish(),
  messageId: import_zod.z.string().trim().max(400).nullish(),
  expediteur: import_zod.z.string().trim().max(320).nullish(),
  destinataires: import_zod.z.array(import_zod.z.string().trim().max(320)).max(50).optional(),
  priorite: import_zod.z.enum(PRIORITES).optional(),
  echeanceLe: instantOptionnel
}).refine((v) => Boolean(v.demandeId || v.dossierId), { message: "Rattachez l\u2019evenement a une demande ou a un dossier" });
var correctionTypageSchema = import_zod.z.object({
  famille: familleSchema.optional(),
  nature: import_zod.z.enum(NATURES).optional(),
  interlocuteur: import_zod.z.enum(INTERLOCUTEURS).nullish(),
  sens: import_zod.z.enum(SENS).optional()
}).refine((v) => Object.values(v).some((x) => x !== void 0), { message: "Indiquez au moins une correction" });
var saisieRapideSchema = import_zod.z.object({
  compteId: import_zod.z.number().int().positive(),
  /** Dossier existant, ou description d'un dossier a creer a la volee. */
  dossierId: import_zod.z.number().int().positive().nullish(),
  nouveauDossier: dossierSchema.omit({ compteId: true }).partial({ client: true }).optional(),
  /** Demande existante a faire avancer, sinon une demande est ouverte si la nature le prevoit. */
  demandeId: import_zod.z.number().int().positive().nullish(),
  famille: familleSchema,
  objet: import_zod.z.string().trim().min(2, "Objet trop court").max(300),
  sens: import_zod.z.enum(SENS).default("entrant"),
  nature: import_zod.z.enum(NATURES).default("demande_entrante"),
  interlocuteur: import_zod.z.enum(INTERLOCUTEURS).nullish(),
  source: import_zod.z.enum(SOURCES).default("saisie"),
  survenuLe: instant.optional(),
  resume: import_zod.z.string().trim().max(1e3).nullish(),
  contenu: import_zod.z.string().trim().max(5e4).nullish(),
  priorite: import_zod.z.enum(PRIORITES).optional(),
  echeanceLe: instantOptionnel
}).refine((v) => Boolean(v.dossierId || v.demandeId || v.nouveauDossier?.client), {
  message: "Choisissez un dossier existant ou renseignez le client du nouveau dossier"
});
var echeanceSchema = import_zod.z.object({
  dossierId: import_zod.z.number().int().positive(),
  demandeId: import_zod.z.number().int().positive().nullish(),
  type: import_zod.z.enum(TYPES_ECHEANCE),
  libelle: import_zod.z.string().trim().max(200).nullish(),
  echeanceLe: instant,
  phraseSource: import_zod.z.string().trim().max(1e3).nullish()
});
var modificationEcheanceSchema = import_zod.z.object({
  libelle: import_zod.z.string().trim().max(200).nullish(),
  echeanceLe: instant.optional(),
  honoree: import_zod.z.boolean().optional(),
  annulee: import_zod.z.boolean().optional()
});

// src/server/modules/auth/routes.ts
function poserCookies(res, jeton, csrf) {
  const commun = { sameSite: "lax", secure: config.production, path: "/", maxAge: DUREE_SESSION_MS };
  res.cookie(COOKIE_SESSION, jeton, { ...commun, httpOnly: true });
  res.cookie(COOKIE_CSRF, csrf, { ...commun, httpOnly: false });
}
var limiteConnexion = (0, import_express_rate_limit.default)({
  windowMs: 15 * 6e4,
  limit: config.test ? 1e3 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: "Trop de tentatives, reessayez dans 15 minutes" }
});
var routesAuth = (0, import_express.Router)();
routesAuth.post("/connexion", limiteConnexion, async (req, res) => {
  const { email, motDePasse } = valider(connexionSchema, req.body);
  const u = await authentifier(email, motDePasse);
  if (!u) throw new ErreurHttp(401, "Email ou mot de passe incorrect");
  const { jeton, csrf } = await ouvrirSession(u.id);
  poserCookies(res, jeton, csrf);
  await journaliser("connexion", { utilisateurId: u.id, entite: "utilisateur", entiteId: u.id });
  res.json({ utilisateur: { id: u.id, email: u.email, nom: u.nom, role: u.role }, csrf });
});
routesAuth.post("/deconnexion", async (req, res) => {
  await fermerSession(lireCookies(req)[COOKIE_SESSION]);
  res.clearCookie(COOKIE_SESSION, { path: "/" });
  res.clearCookie(COOKIE_CSRF, { path: "/" });
  res.json({ ok: true });
});
routesAuth.get("/moi", (req, res) => {
  if (!req.utilisateur) throw new ErreurHttp(401, "Non connecte");
  res.json({ utilisateur: req.utilisateur, csrf: req.csrfAttendu });
});
routesAuth.post("/mot-de-passe-oublie", limiteConnexion, async (req, res) => {
  const { email } = valider(import_zod2.z.object({ email: emailSchema }), req.body);
  const jeton = await demanderReinitialisation(email);
  if (jeton && config.smtp.mode === "mock") {
    journal.info("Lien de reinitialisation prepare (envoi des emails en mode simule)", { lien: `${config.url}/reinitialiser?jeton=${jeton}` });
  }
  res.json({ ok: true, message: "Si un compte existe pour cette adresse, un lien de reinitialisation vient d\u2019etre prepare." });
});
routesAuth.post("/reinitialiser", limiteConnexion, async (req, res) => {
  const { jeton, motDePasse } = valider(import_zod2.z.object({ jeton: import_zod2.z.string().min(10), motDePasse: motDePasseSchema }), req.body);
  if (!await reinitialiserMotDePasse(jeton, motDePasse)) throw new ErreurHttp(400, "Lien invalide ou expire");
  res.json({ ok: true });
});
routesAuth.post("/changer-mot-de-passe", exigerConnexion, async (req, res) => {
  const { actuel, nouveau } = valider(import_zod2.z.object({ actuel: import_zod2.z.string(), nouveau: motDePasseSchema }), req.body);
  const [u] = await db.select().from(schema_exports.utilisateurs).where((0, import_drizzle_orm3.eq)(schema_exports.utilisateurs.id, req.utilisateur.id));
  if (!u || !await verifierMotDePasse(actuel, u.motDePasseHash)) throw new ErreurHttp(400, "Mot de passe actuel incorrect");
  await db.update(schema_exports.utilisateurs).set({ motDePasseHash: await hacherMotDePasse(nouveau), majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(schema_exports.utilisateurs.id, u.id));
  res.json({ ok: true });
});
var routesUtilisateurs = (0, import_express.Router)();
routesUtilisateurs.use(exigerConnexion);
routesUtilisateurs.get("/", exigerRole("admin", "manager"), async (_req, res) => {
  const liste = await db.select({
    id: schema_exports.utilisateurs.id,
    email: schema_exports.utilisateurs.email,
    nom: schema_exports.utilisateurs.nom,
    role: schema_exports.utilisateurs.role,
    actif: schema_exports.utilisateurs.actif,
    derniereConnexionLe: schema_exports.utilisateurs.derniereConnexionLe
  }).from(schema_exports.utilisateurs).orderBy((0, import_drizzle_orm3.asc)(schema_exports.utilisateurs.nom));
  res.json(liste);
});
routesUtilisateurs.post("/", exigerRole("admin"), async (req, res) => {
  const d = valider(creationUtilisateurSchema, req.body);
  const [existe] = await db.select({ id: schema_exports.utilisateurs.id }).from(schema_exports.utilisateurs).where((0, import_drizzle_orm3.eq)(schema_exports.utilisateurs.email, d.email));
  if (existe) throw new ErreurHttp(409, "Un compte existe deja pour cet email");
  const u = await creerUtilisateur(d);
  await journaliser("utilisateur_cree", { utilisateurId: req.utilisateur.id, entite: "utilisateur", entiteId: u.id, details: { role: d.role } });
  res.status(201).json({ id: u.id });
});
routesUtilisateurs.patch("/:id", exigerRole("admin"), async (req, res) => {
  const id2 = idParam(req);
  const d = valider(modificationUtilisateurSchema, req.body);
  if (id2 === req.utilisateur.id && (d.actif === false || d.role && d.role !== "admin")) {
    throw new ErreurHttp(400, "Vous ne pouvez pas retirer vos propres droits d\u2019administrateur");
  }
  const [maj] = await db.update(schema_exports.utilisateurs).set({ ...d, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(schema_exports.utilisateurs.id, id2)).returning();
  if (!maj) throw new ErreurHttp(404, "Utilisateur introuvable");
  if (d.actif === false) await db.delete(schema_exports.sessions).where((0, import_drizzle_orm3.eq)(schema_exports.sessions.utilisateurId, id2));
  await journaliser("utilisateur_modifie", { utilisateurId: req.utilisateur.id, entite: "utilisateur", entiteId: id2, details: d });
  res.json({ ok: true });
});

// src/server/modules/pilotage/routes.ts
var import_express2 = require("express");
var import_zod4 = require("zod");
var import_drizzle_orm7 = require("drizzle-orm");
init_client();
init_http();
init_config();
init_parametres2();

// src/server/lib/perimetre.ts
var import_drizzle_orm5 = require("drizzle-orm");
init_client();
init_http();
async function perimetreDe(u) {
  if (u.role === "admin") {
    const postes3 = await db.select({ id: schema_exports.postes.id, compteId: schema_exports.postes.compteId }).from(schema_exports.postes).where((0, import_drizzle_orm5.eq)(schema_exports.postes.collaborateurId, u.id));
    return { comptes: null, postes: postes3.map((p) => p.id), postesParCompte: postes3, lectureSeule: false };
  }
  const postes2 = await db.select({ id: schema_exports.postes.id, compteId: schema_exports.postes.compteId }).from(schema_exports.postes).where((0, import_drizzle_orm5.eq)(schema_exports.postes.collaborateurId, u.id));
  const comptesGeres = await db.select({ id: schema_exports.comptesClients.id }).from(schema_exports.comptesClients).where((0, import_drizzle_orm5.eq)(schema_exports.comptesClients.managerId, u.id));
  const comptes = [.../* @__PURE__ */ new Set([...postes2.map((p) => p.compteId), ...comptesGeres.map((c) => c.id)])];
  return { comptes, postes: postes2.map((p) => p.id), postesParCompte: postes2, lectureSeule: u.role === "client_lecture" };
}
function exigerCompte(perimetre, compteId) {
  if (perimetre.comptes === null) return;
  if (!perimetre.comptes.includes(compteId)) throw new ErreurHttp(403, "Ce compte client n'est pas dans votre perimetre");
}
function posteSurCompte(perimetre, compteId) {
  return perimetre.postesParCompte.find((p) => p.compteId === compteId)?.id ?? null;
}
function compteParDefaut(perimetre) {
  if (perimetre.comptes && perimetre.comptes.length === 1) return perimetre.comptes[0];
  return null;
}

// src/server/modules/comptes/service.ts
var import_drizzle_orm6 = require("drizzle-orm");
init_client();
init_http();
init_evenements();

// src/shared/texte.ts
function normaliser(texte2) {
  return texte2.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function cleDossier(client, produit, operation) {
  return [client, produit, operation].map(normaliser).filter(Boolean).join("|");
}

// src/server/modules/comptes/service.ts
init_constantes();
async function creerCompte(entree, auteur) {
  const code = (entree.code?.trim() || normaliser(entree.nom).replace(/ /g, "-")).slice(0, 60);
  if (!code) throw new ErreurHttp(400, "Le code du compte est obligatoire");
  const [existe] = await db.select({ id: schema_exports.comptesClients.id }).from(schema_exports.comptesClients).where((0, import_drizzle_orm6.eq)(schema_exports.comptesClients.code, code));
  if (existe) throw new ErreurHttp(409, `Un compte client existe deja avec le code \xAB ${code} \xBB`);
  const [compte] = await db.insert(schema_exports.comptesClients).values({
    nom: entree.nom.trim(),
    code,
    pays: entree.pays ?? null,
    ville: entree.ville ?? null,
    fuseau: entree.fuseau ?? "Europe/Madrid",
    donneurOrdreNom: entree.donneurOrdreNom ?? null,
    donneurOrdreEmail: entree.donneurOrdreEmail ?? null,
    adressesIgnorees: entree.adressesIgnorees ?? [],
    managerId: entree.managerId ?? null,
    horaires: entree.horaires ?? null
  }).returning();
  await journaliser("compte_cree", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "compte", entiteId: compte.id, details: { code } });
  return compte;
}
async function modifierCompte(id2, modifs, auteur) {
  const valeurs = { majLe: /* @__PURE__ */ new Date() };
  for (const champ of ["nom", "pays", "ville", "fuseau", "donneurOrdreNom", "donneurOrdreEmail", "adressesIgnorees", "managerId", "horaires", "actif"]) {
    if (modifs[champ] !== void 0) valeurs[champ] = modifs[champ];
  }
  const [maj] = await db.update(schema_exports.comptesClients).set(valeurs).where((0, import_drizzle_orm6.eq)(schema_exports.comptesClients.id, id2)).returning();
  if (!maj) throw new ErreurHttp(404, "Compte client introuvable");
  await journaliser("compte_modifie", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "compte", entiteId: id2, details: { champs: Object.keys(valeurs) } });
  return maj;
}
async function listerComptes(comptes) {
  const lignes = await db.select({
    id: schema_exports.comptesClients.id,
    nom: schema_exports.comptesClients.nom,
    code: schema_exports.comptesClients.code,
    pays: schema_exports.comptesClients.pays,
    ville: schema_exports.comptesClients.ville,
    fuseau: schema_exports.comptesClients.fuseau,
    donneurOrdreNom: schema_exports.comptesClients.donneurOrdreNom,
    donneurOrdreEmail: schema_exports.comptesClients.donneurOrdreEmail,
    adressesIgnorees: schema_exports.comptesClients.adressesIgnorees,
    managerId: schema_exports.comptesClients.managerId,
    actif: schema_exports.comptesClients.actif,
    dossiersOuverts: import_drizzle_orm6.sql`(
        SELECT count(*)::int FROM dossiers d WHERE d.compte_id = ${schema_exports.comptesClients.id} AND d.statut = 'ouvert'
      )`.as("dossiers_ouverts"),
    demandesOuvertes: import_drizzle_orm6.sql`(
        SELECT count(*)::int FROM demandes de
        WHERE de.compte_id = ${schema_exports.comptesClients.id} AND de.statut NOT IN ('termine', 'annule') AND de.famille <> ${FAMILLE_HORS_PERIMETRE}
      )`.as("demandes_ouvertes")
  }).from(schema_exports.comptesClients).orderBy((0, import_drizzle_orm6.asc)(schema_exports.comptesClients.nom));
  return comptes === null ? lignes : lignes.filter((l) => comptes.includes(l.id));
}
async function creerPoste(entree, auteur) {
  const metier = entree.metier ?? "export";
  const [poste] = await db.insert(schema_exports.postes).values({
    compteId: entree.compteId,
    intitule: entree.intitule.trim(),
    collaborateurId: entree.collaborateurId ?? null,
    metier,
    adresses: entree.adresses ?? [],
    // Le perimetre est pre-rempli d'apres le metier, puis ajustable dans Parametres.
    familles: entree.familles ?? [...FAMILLES_PAR_METIER[metier]]
  }).returning();
  await journaliser("poste_cree", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "poste", entiteId: poste.id, details: { compteId: entree.compteId } });
  return poste;
}
async function modifierPoste(id2, modifs, auteur) {
  const valeurs = { majLe: /* @__PURE__ */ new Date() };
  for (const champ of ["intitule", "collaborateurId", "metier", "adresses", "familles", "actif"]) {
    if (modifs[champ] !== void 0) valeurs[champ] = modifs[champ];
  }
  const [maj] = await db.update(schema_exports.postes).set(valeurs).where((0, import_drizzle_orm6.eq)(schema_exports.postes.id, id2)).returning();
  if (!maj) throw new ErreurHttp(404, "Poste introuvable");
  await journaliser("poste_modifie", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "poste", entiteId: id2, details: { champs: Object.keys(valeurs) } });
  return maj;
}
async function listerPostes(comptes) {
  const lignes = await db.select({
    id: schema_exports.postes.id,
    compteId: schema_exports.postes.compteId,
    compte: schema_exports.comptesClients.nom,
    intitule: schema_exports.postes.intitule,
    collaborateurId: schema_exports.postes.collaborateurId,
    collaborateur: schema_exports.utilisateurs.nom,
    metier: schema_exports.postes.metier,
    adresses: schema_exports.postes.adresses,
    familles: schema_exports.postes.familles,
    actif: schema_exports.postes.actif
  }).from(schema_exports.postes).innerJoin(schema_exports.comptesClients, (0, import_drizzle_orm6.eq)(schema_exports.comptesClients.id, schema_exports.postes.compteId)).leftJoin(schema_exports.utilisateurs, (0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.id, schema_exports.postes.collaborateurId)).orderBy((0, import_drizzle_orm6.asc)(schema_exports.comptesClients.nom), (0, import_drizzle_orm6.asc)(schema_exports.postes.intitule));
  return comptes === null ? lignes : lignes.filter((l) => comptes.includes(l.compteId));
}

// src/server/modules/pilotage/routes.ts
init_parametres();

// src/server/lib/auteur.ts
function auteurDe(req) {
  return { utilisateurId: req.utilisateur?.id ?? null, type: "humain" };
}
function auteurClaude(utilisateurId) {
  return { utilisateurId, type: "claude" };
}

// src/server/modules/pilotage/routes.ts
init_constantes();
var routesComptes = (0, import_express2.Router)();
routesComptes.use(exigerConnexion);
routesComptes.get("/", async (req, res) => {
  const p = await perimetreDe(req.utilisateur);
  res.json(await listerComptes(p.comptes));
});
routesComptes.post("/", exigerRole("admin"), async (req, res) => {
  const d = valider(compteSchema, req.body);
  const compte = await creerCompte({ ...d, donneurOrdreEmail: d.donneurOrdreEmail || null }, auteurDe(req));
  res.status(201).json(compte);
});
routesComptes.patch("/:id", exigerRole("admin", "manager"), async (req, res) => {
  const id2 = idParam(req);
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, id2);
  const d = valider(modificationCompteSchema, req.body);
  res.json(await modifierCompte(id2, d, auteurDe(req)));
});
var routesPostes = (0, import_express2.Router)();
routesPostes.use(exigerConnexion);
routesPostes.get("/", async (req, res) => {
  const p = await perimetreDe(req.utilisateur);
  res.json(await listerPostes(p.comptes));
});
routesPostes.post("/", exigerRole("admin", "manager"), async (req, res) => {
  const d = valider(posteSchema, req.body);
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, d.compteId);
  res.status(201).json(await creerPoste(d, auteurDe(req)));
});
routesPostes.patch("/:id", exigerRole("admin", "manager"), async (req, res) => {
  const id2 = idParam(req);
  const [poste] = await db.select({ compteId: schema_exports.postes.compteId }).from(schema_exports.postes).where((0, import_drizzle_orm7.eq)(schema_exports.postes.id, id2));
  if (!poste) throw new ErreurHttp(404, "Poste introuvable");
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, poste.compteId);
  res.json(await modifierPoste(id2, valider(modificationPosteSchema, req.body), auteurDe(req)));
});
var routesParametres = (0, import_express2.Router)();
routesParametres.use(exigerConnexion);
routesParametres.get("/", async (req, res) => {
  const p = await perimetreDe(req.utilisateur);
  res.json({
    parametres: await lireParametres(),
    integrationsSimulees: integrationsSimulees(),
    perimetre: { comptes: p.comptes, postes: p.postes, lectureSeule: p.lectureSeule }
  });
});
routesParametres.put("/", exigerRole("admin"), async (req, res) => {
  const valides = valider(parametresSchema, req.body);
  res.json({ parametres: await enregistrerParametres(valides, req.utilisateur.id) });
});
var routesReferentiels = (0, import_express2.Router)();
routesReferentiels.use(exigerConnexion);
routesReferentiels.get("/", async (_req, res) => {
  const lignes = await db.select().from(schema_exports.referentiels).where((0, import_drizzle_orm7.eq)(schema_exports.referentiels.actif, true)).orderBy((0, import_drizzle_orm7.asc)(schema_exports.referentiels.type), (0, import_drizzle_orm7.asc)(schema_exports.referentiels.ordre));
  if (lignes.length) {
    const parType = {};
    for (const l of lignes) (parType[l.type] ??= []).push(l);
    return res.json(parType);
  }
  res.json({
    famille: FAMILLES.map((f, i) => ({ type: "famille", code: f.code, libelle: f.libelle, attributs: f, ordre: i, actif: true })),
    nature: DEFINITIONS_NATURES.map((n, i) => ({ type: "nature", code: n.code, libelle: n.libelle, attributs: n, ordre: i, actif: true })),
    statut: DEFINITIONS_STATUTS.map((s, i) => ({ type: "statut", code: s.code, libelle: s.libelle, attributs: s, ordre: i, actif: true })),
    interlocuteur: INTERLOCUTEURS.map((c, i) => ({ type: "interlocuteur", code: c, libelle: LIBELLES_INTERLOCUTEURS[c], attributs: {}, ordre: i, actif: true }))
  });
});
routesReferentiels.patch("/:id", exigerRole("admin"), async (req, res) => {
  const id2 = idParam(req);
  const d = valider(
    import_zod4.z.object({ libelle: import_zod4.z.string().trim().min(1).max(200).optional(), attributs: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.unknown()).optional(), actif: import_zod4.z.boolean().optional(), ordre: import_zod4.z.number().int().optional() }),
    req.body
  );
  const [maj] = await db.update(schema_exports.referentiels).set({ ...d, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm7.eq)(schema_exports.referentiels.id, id2)).returning();
  if (!maj) throw new ErreurHttp(404, "Entree de referentiel introuvable");
  res.json(maj);
});
routesReferentiels.post("/", exigerRole("admin"), async (req, res) => {
  const d = valider(
    import_zod4.z.object({
      type: import_zod4.z.enum(["famille", "nature", "statut", "interlocuteur", "source", "echeance"]),
      code: import_zod4.z.string().trim().min(1).max(40),
      libelle: import_zod4.z.string().trim().min(1).max(200),
      attributs: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.unknown()).optional(),
      ordre: import_zod4.z.number().int().optional()
    }),
    req.body
  );
  const [ligne] = await db.insert(schema_exports.referentiels).values({ ...d, attributs: d.attributs ?? {}, ordre: d.ordre ?? 100 }).onConflictDoNothing().returning();
  if (!ligne) throw new ErreurHttp(409, "Ce code existe deja pour ce type de referentiel");
  res.status(201).json(ligne);
});

// src/server/modules/dossiers/routes.ts
var import_express3 = require("express");
var import_zod5 = require("zod");
var import_drizzle_orm10 = require("drizzle-orm");
init_client();
init_http();
init_evenements();

// src/server/modules/dossiers/service.ts
var import_drizzle_orm8 = require("drizzle-orm");
init_client();
init_http();
init_evenements();
init_constantes();
function libelleParDefaut(e) {
  const tete = e.pays ? `${e.client} (${e.pays})` : e.client;
  return [tete, e.produit, e.operation].map((m) => m?.trim()).filter(Boolean).join(" / ");
}
async function trouverOuCreerDossier(entree, auteur) {
  const client = entree.client.trim();
  if (!client) throw new ErreurHttp(400, "Le client du dossier est obligatoire");
  const cle = cleDossier(client, entree.produit ?? "", entree.operation ?? "");
  if (!cle) throw new ErreurHttp(400, "Le dossier doit porter au moins un client identifiable");
  const [existant] = await db.select().from(schema_exports.dossiers).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(schema_exports.dossiers.compteId, entree.compteId), (0, import_drizzle_orm8.eq)(schema_exports.dossiers.cleRapprochement, cle)));
  if (existant) {
    const complements = {};
    if (!existant.pays && entree.pays) complements.pays = entree.pays;
    if (!existant.produit && entree.produit) complements.produit = entree.produit;
    if (!existant.operation && entree.operation) complements.operation = entree.operation;
    if (!existant.posteId && entree.posteId) complements.posteId = entree.posteId;
    if (entree.references && Object.keys(entree.references).length) {
      complements.references = { ...existant.references, ...entree.references };
    }
    if (!Object.keys(complements).length) return { dossier: existant, cree: false };
    const [maj] = await db.update(schema_exports.dossiers).set({ ...complements, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm8.eq)(schema_exports.dossiers.id, existant.id)).returning();
    return { dossier: maj, cree: false };
  }
  const [dossier] = await db.insert(schema_exports.dossiers).values({
    compteId: entree.compteId,
    posteId: entree.posteId ?? null,
    client,
    pays: entree.pays ?? null,
    produit: entree.produit ?? null,
    operation: entree.operation ?? null,
    cleRapprochement: cle,
    libelle: entree.libelle?.trim() || libelleParDefaut({ ...entree, client }),
    statut: entree.statut ?? "ouvert",
    references: entree.references ?? {},
    notes: entree.notes ?? null
  }).returning();
  await journaliser("dossier_cree", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "dossier",
    entiteId: dossier.id,
    details: { client, produit: entree.produit ?? null, operation: entree.operation ?? null }
  });
  return { dossier, cree: true };
}
async function dossiersParClientProduit(compteId, client, produit) {
  const prefixe = cleDossier(client, produit ?? "", "");
  if (!prefixe) return [];
  return db.select().from(schema_exports.dossiers).where(
    (0, import_drizzle_orm8.and)(
      (0, import_drizzle_orm8.eq)(schema_exports.dossiers.compteId, compteId),
      // Le prefixe exact, ou le prefixe suivi du separateur d'operation.
      (0, import_drizzle_orm8.or)((0, import_drizzle_orm8.eq)(schema_exports.dossiers.cleRapprochement, prefixe), import_drizzle_orm8.sql`${schema_exports.dossiers.cleRapprochement} LIKE ${`${prefixe}|%`}`)
    )
  );
}
async function lireDossier(id2) {
  const [dossier] = await db.select().from(schema_exports.dossiers).where((0, import_drizzle_orm8.eq)(schema_exports.dossiers.id, id2));
  if (!dossier) throw new ErreurHttp(404, "Dossier introuvable");
  return dossier;
}
async function modifierDossier(id2, modifs, auteur) {
  const dossier = await lireDossier(id2);
  const valeurs = { majLe: /* @__PURE__ */ new Date() };
  for (const champ of ["pays", "produit", "operation", "libelle", "statut", "notes", "resume", "posteId"]) {
    if (modifs[champ] !== void 0) valeurs[champ] = modifs[champ];
  }
  if (modifs.client) {
    valeurs.client = modifs.client.trim();
    valeurs.cleRapprochement = cleDossier(
      String(valeurs.client),
      modifs.produit ?? dossier.produit ?? "",
      modifs.operation ?? dossier.operation ?? ""
    );
  } else if (modifs.produit !== void 0 || modifs.operation !== void 0) {
    valeurs.cleRapprochement = cleDossier(dossier.client, modifs.produit ?? dossier.produit ?? "", modifs.operation ?? dossier.operation ?? "");
  }
  if (modifs.references) valeurs.references = { ...dossier.references, ...modifs.references };
  if (modifs.statut === "clos" || modifs.statut === "annule") valeurs.clotureLe = /* @__PURE__ */ new Date();
  if (modifs.statut === "ouvert") valeurs.clotureLe = null;
  if (valeurs.cleRapprochement && valeurs.cleRapprochement !== dossier.cleRapprochement) {
    const [collision] = await db.select({ id: schema_exports.dossiers.id, libelle: schema_exports.dossiers.libelle }).from(schema_exports.dossiers).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(schema_exports.dossiers.compteId, dossier.compteId), (0, import_drizzle_orm8.eq)(schema_exports.dossiers.cleRapprochement, String(valeurs.cleRapprochement))));
    if (collision && collision.id !== id2) {
      throw new ErreurHttp(409, `Un dossier identique existe deja sur ce compte : \xAB ${collision.libelle} \xBB`);
    }
  }
  const [maj] = await db.update(schema_exports.dossiers).set(valeurs).where((0, import_drizzle_orm8.eq)(schema_exports.dossiers.id, id2)).returning();
  await journaliser("dossier_modifie", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "dossier",
    entiteId: id2,
    details: { champs: Object.keys(valeurs).filter((c) => c !== "majLe") }
  });
  return maj;
}
async function chercherDossiers(terme, opts = {}) {
  const motif = `%${terme.trim()}%`;
  const normalise = normaliser(terme);
  const conditions = [];
  if (opts.compteId) conditions.push((0, import_drizzle_orm8.eq)(schema_exports.dossiers.compteId, opts.compteId));
  if (terme.trim()) {
    const recherche = (0, import_drizzle_orm8.or)(
      (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.libelle, motif),
      (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.client, motif),
      (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.produit, motif),
      (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.operation, motif),
      (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.pays, motif),
      normalise ? (0, import_drizzle_orm8.ilike)(schema_exports.dossiers.cleRapprochement, `%${normalise}%`) : void 0
    );
    if (recherche) conditions.push(recherche);
  }
  return db.select({
    id: schema_exports.dossiers.id,
    libelle: schema_exports.dossiers.libelle,
    client: schema_exports.dossiers.client,
    pays: schema_exports.dossiers.pays,
    produit: schema_exports.dossiers.produit,
    operation: schema_exports.dossiers.operation,
    statut: schema_exports.dossiers.statut,
    resume: schema_exports.dossiers.resume,
    majLe: schema_exports.dossiers.majLe,
    demandesOuvertes: import_drizzle_orm8.sql`(
        SELECT count(*)::int FROM demandes d
        WHERE d.dossier_id = ${schema_exports.dossiers.id} AND d.statut NOT IN ('termine', 'annule') AND d.famille <> ${FAMILLE_HORS_PERIMETRE}
      )`.as("demandes_ouvertes")
  }).from(schema_exports.dossiers).where(conditions.length ? (0, import_drizzle_orm8.and)(...conditions) : void 0).orderBy((0, import_drizzle_orm8.desc)(schema_exports.dossiers.majLe)).limit(Math.min(opts.limite ?? 20, 100));
}
async function chronologieDossier(dossierId) {
  const evenements2 = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(schema_exports.evenements.dossierId, dossierId), import_drizzle_orm8.sql`coalesce(${schema_exports.evenements.famille}, '') <> ${FAMILLE_HORS_PERIMETRE}`)).orderBy((0, import_drizzle_orm8.desc)(schema_exports.evenements.survenuLe)).limit(500);
  const transitions = await db.select({ t: schema_exports.transitionsStatut, objet: schema_exports.demandes.objet }).from(schema_exports.transitionsStatut).innerJoin(schema_exports.demandes, (0, import_drizzle_orm8.eq)(schema_exports.demandes.id, schema_exports.transitionsStatut.demandeId)).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(schema_exports.demandes.dossierId, dossierId), import_drizzle_orm8.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`)).orderBy((0, import_drizzle_orm8.desc)(schema_exports.transitionsStatut.survenuLe)).limit(500);
  const echeances2 = await db.select().from(schema_exports.echeances).where((0, import_drizzle_orm8.eq)(schema_exports.echeances.dossierId, dossierId)).limit(200);
  const pieces2 = await db.select().from(schema_exports.pieces).where((0, import_drizzle_orm8.eq)(schema_exports.pieces.dossierId, dossierId)).limit(200);
  const lignes = [
    ...evenements2.map((e) => ({
      type: "evenement",
      survenuLe: e.survenuLe,
      titre: e.objet ?? e.resume ?? "Evenement",
      detail: e.resume,
      demandeId: e.demandeId,
      meta: { sens: e.sens, nature: e.nature, interlocuteur: e.interlocuteur, source: e.source, famille: e.famille, confiance: e.confianceTypage }
    })),
    ...transitions.map((l) => ({
      type: "transition",
      survenuLe: l.t.survenuLe,
      titre: l.t.statutAvant ? `${l.objet} : ${libelleStatut(l.t.statutAvant)} vers ${libelleStatut(l.t.statutApres)}` : `${l.objet} : ouverture en ${libelleStatut(l.t.statutApres)}`,
      detail: l.t.motif,
      demandeId: l.t.demandeId,
      meta: { statutAvant: l.t.statutAvant, statutApres: l.t.statutApres, minutesOuvrees: l.t.minutesOuvrees, auteurType: l.t.auteurType }
    })),
    ...echeances2.map((e) => ({
      type: "echeance",
      survenuLe: e.echeanceLe,
      titre: `${LIBELLES_ECHEANCES[e.type] ?? e.type}${e.libelle ? ` : ${e.libelle}` : ""}`,
      detail: e.phraseSource,
      demandeId: e.demandeId,
      meta: { honoreeLe: e.honoreeLe, annulee: e.annulee }
    })),
    ...pieces2.map((p) => ({
      type: "piece",
      survenuLe: p.creeLe,
      titre: `${p.type}${p.reference ? ` ${p.reference}` : ""}`,
      detail: p.nomFichier,
      demandeId: p.demandeId,
      meta: { archive: p.archive }
    }))
  ];
  return lignes.sort((a, b) => b.survenuLe.getTime() - a.survenuLe.getTime());
}

// src/server/modules/demandes/service.ts
var import_drizzle_orm9 = require("drizzle-orm");
init_client();
init_http();
init_evenements();
init_parametres2();
init_constantes();
init_heures_ouvrees();
var AUTEUR_SYSTEME = { utilisateurId: null, type: "systeme" };
async function calculerSla(compteId, famille2, depart) {
  const p = await lireParametres();
  const heures = p.sla.parFamille[famille2] ?? famille(famille2)?.slaHeures ?? null;
  if (!heures || heures <= 0) return { heures: null, echeance: null };
  const horaires = await horairesDuCompte(compteId);
  return { heures, echeance: ajouterHeuresOuvrees(horaires, depart, heures) };
}
async function creerDemande(entree, auteur) {
  if (estHorsPerimetre(entree.famille)) {
    throw new ErreurHttp(400, `La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : elle ne cree pas de demande`);
  }
  const [dossier] = await db.select({ id: schema_exports.dossiers.id, compteId: schema_exports.dossiers.compteId, posteId: schema_exports.dossiers.posteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm9.eq)(schema_exports.dossiers.id, entree.dossierId));
  if (!dossier) throw new ErreurHttp(404, "Dossier introuvable");
  const statut = entree.statut ?? "nouveau";
  const def = definitionStatut(statut);
  if (!def) throw new ErreurHttp(400, `Statut inconnu : ${statut}`);
  const ouverteLe = entree.ouverteLe ?? /* @__PURE__ */ new Date();
  const sla = await calculerSla(dossier.compteId, entree.famille, ouverteLe);
  const [demande] = await db.insert(schema_exports.demandes).values({
    dossierId: dossier.id,
    compteId: dossier.compteId,
    posteId: dossier.posteId,
    famille: entree.famille,
    objet: entree.objet.trim(),
    origine: entree.origine ?? "saisie",
    statut,
    acteurAttendu: def.acteur,
    priorite: entree.priorite ?? "normale",
    echeanceLe: entree.echeanceLe ?? null,
    slaHeures: sla.heures,
    slaEcheanceLe: sla.echeance,
    ouverteLe,
    dernierEvenementLe: ouverteLe,
    notes: entree.notes ?? null,
    creeParId: auteur.utilisateurId
  }).returning();
  await db.insert(schema_exports.transitionsStatut).values({
    demandeId: demande.id,
    statutAvant: null,
    statutApres: statut,
    acteurAvant: null,
    acteurApres: def.acteur,
    survenuLe: ouverteLe,
    minutesOuvrees: 0,
    motif: "ouverture de la demande",
    auteurId: auteur.utilisateurId,
    auteurType: auteur.type
  });
  await journaliser("demande_creee", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "demande",
    entiteId: demande.id,
    details: { dossierId: dossier.id, famille: entree.famille, statut }
  });
  return demande;
}
async function debutStatutCourant(demande) {
  const [derniere] = await db.select({ survenuLe: schema_exports.transitionsStatut.survenuLe }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm9.eq)(schema_exports.transitionsStatut.demandeId, demande.id)).orderBy((0, import_drizzle_orm9.desc)(schema_exports.transitionsStatut.survenuLe), (0, import_drizzle_orm9.desc)(schema_exports.transitionsStatut.id)).limit(1);
  return derniere?.survenuLe ?? demande.ouverteLe;
}
function cumuler(compteurs, cle, minutes) {
  const base = compteurs && typeof compteurs === "object" ? { ...compteurs } : {};
  base[cle] = Math.round((base[cle] ?? 0) + minutes);
  return base;
}
async function changerStatut(demandeId, nouveau, auteur, opts = {}) {
  const def = definitionStatut(nouveau);
  if (!def) throw new ErreurHttp(400, `Statut inconnu : ${nouveau}`);
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm9.eq)(schema_exports.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  const acteurApres = opts.acteurAttendu ?? def.acteur;
  if (!ACTEURS.includes(acteurApres)) throw new ErreurHttp(400, `Acteur inconnu : ${acteurApres}`);
  if (demande.statut === nouveau && demande.acteurAttendu === acteurApres && !opts.premiereReponse) return demande;
  const survenuLe = opts.survenuLe ?? /* @__PURE__ */ new Date();
  const debut = await debutStatutCourant(demande);
  const horaires = await horairesDuCompte(demande.compteId);
  const minutes = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debut, survenuLe);
  await db.insert(schema_exports.transitionsStatut).values({
    demandeId: demande.id,
    statutAvant: demande.statut,
    statutApres: nouveau,
    acteurAvant: demande.acteurAttendu,
    acteurApres,
    survenuLe,
    minutesOuvrees: minutes,
    motif: opts.motif ?? null,
    evenementId: opts.evenementId ?? null,
    auteurId: auteur.utilisateurId,
    auteurType: auteur.type
  });
  const [maj] = await db.update(schema_exports.demandes).set({
    statut: nouveau,
    acteurAttendu: acteurApres,
    minutesParStatut: cumuler(demande.minutesParStatut, demande.statut, minutes),
    minutesParActeur: cumuler(demande.minutesParActeur, demande.acteurAttendu, minutes),
    premiereReponseLe: demande.premiereReponseLe ?? (opts.premiereReponse ? survenuLe : null),
    termineeLe: def.fermee ? survenuLe : null,
    dernierEvenementLe: survenuLe,
    majLe: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm9.eq)(schema_exports.demandes.id, demande.id)).returning();
  await journaliser("statut_change", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "demande",
    entiteId: demande.id,
    details: { de: demande.statut, vers: nouveau, acteur: acteurApres, minutesOuvrees: minutes, motif: opts.motif ?? null }
  });
  return maj;
}
async function enregistrerRelance(demandeId, auteur, survenuLe = /* @__PURE__ */ new Date()) {
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm9.eq)(schema_exports.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  const niveau = Math.min(3, demande.niveauRelance + 1);
  const [maj] = await db.update(schema_exports.demandes).set({ niveauRelance: niveau, derniereRelanceLe: survenuLe, dernierEvenementLe: survenuLe, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm9.eq)(schema_exports.demandes.id, demandeId)).returning();
  await journaliser("relance_enregistree", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "demande",
    entiteId: demandeId,
    details: { niveau }
  });
  return maj;
}
async function tempsDemande(demande, maintenant = /* @__PURE__ */ new Date()) {
  const horaires = await horairesDuCompte(demande.compteId);
  const debut = await debutStatutCourant(demande);
  const enCours = estFerme(demande.statut) ? 0 : minutesOuvrees(horaires, debut, maintenant);
  const parStatut = cumuler(demande.minutesParStatut, demande.statut, enCours);
  const parActeur = cumuler(demande.minutesParActeur, demande.acteurAttendu, enCours);
  const fin = demande.termineeLe ?? maintenant;
  return {
    parStatut,
    parActeur,
    total: minutesOuvrees(horaires, demande.ouverteLe, fin),
    premiereReponse: demande.premiereReponseLe ? minutesOuvrees(horaires, demande.ouverteLe, demande.premiereReponseLe) : null,
    statutCourant: enCours
  };
}
async function tempsDesDemandes(demandes2, maintenant = /* @__PURE__ */ new Date()) {
  const sortie = /* @__PURE__ */ new Map();
  if (!demandes2.length) return sortie;
  const debuts = await db.select({
    demandeId: schema_exports.transitionsStatut.demandeId,
    debut: import_drizzle_orm9.sql`max(${schema_exports.transitionsStatut.survenuLe})`.as("debut")
  }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm9.inArray)(schema_exports.transitionsStatut.demandeId, demandes2.map((d) => d.id))).groupBy(schema_exports.transitionsStatut.demandeId);
  const parDemande = new Map(debuts.map((d) => [d.demandeId, new Date(d.debut)]));
  const horairesParCompte2 = /* @__PURE__ */ new Map();
  for (const compteId of new Set(demandes2.map((d) => d.compteId))) {
    horairesParCompte2.set(compteId, await horairesDuCompte(compteId));
  }
  for (const d of demandes2) {
    const debut = parDemande.get(d.id) ?? d.ouverteLe;
    sortie.set(d.id, tempsDemandeAvecHoraires(d, debut, horairesParCompte2.get(d.compteId), maintenant));
  }
  return sortie;
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
function conditionPerimetre() {
  return import_drizzle_orm9.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`;
}
async function fileDuJour(filtres = {}, maintenant = /* @__PURE__ */ new Date()) {
  const conditions = [conditionPerimetre()];
  conditions.push((0, import_drizzle_orm9.inArray)(schema_exports.demandes.statut, filtres.statuts ?? STATUTS_OUVERTS));
  if (filtres.compteId) conditions.push((0, import_drizzle_orm9.eq)(schema_exports.demandes.compteId, filtres.compteId));
  if (filtres.posteId) conditions.push((0, import_drizzle_orm9.eq)(schema_exports.demandes.posteId, filtres.posteId));
  if (filtres.familles?.length) conditions.push((0, import_drizzle_orm9.inArray)(schema_exports.demandes.famille, filtres.familles));
  if (filtres.acteurs?.length) conditions.push((0, import_drizzle_orm9.inArray)(schema_exports.demandes.acteurAttendu, filtres.acteurs));
  const lignes = await db.select({
    demande: schema_exports.demandes,
    dossierLibelle: schema_exports.dossiers.libelle,
    client: schema_exports.dossiers.client,
    debutStatut: import_drizzle_orm9.sql`coalesce((
        SELECT max(t.survenu_le) FROM transitions_statut t WHERE t.demande_id = ${schema_exports.demandes.id}
      ), ${schema_exports.demandes.ouverteLe})`.as("debut_statut"),
    prochaineEcheance: import_drizzle_orm9.sql`(
        SELECT min(e.echeance_le) FROM echeances e
        WHERE e.dossier_id = ${schema_exports.demandes.dossierId} AND e.annulee = false AND e.honoree_le IS NULL AND e.echeance_le >= ${maintenant}
      )`.as("prochaine_echeance")
  }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm9.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where((0, import_drizzle_orm9.and)(...conditions)).orderBy((0, import_drizzle_orm9.asc)(schema_exports.demandes.echeanceLe), (0, import_drizzle_orm9.asc)(schema_exports.demandes.ouverteLe)).limit(Math.min(filtres.limite ?? 300, 1e3));
  const horairesParCompte2 = /* @__PURE__ */ new Map();
  for (const compteId of new Set(lignes.map((l) => l.demande.compteId))) {
    horairesParCompte2.set(compteId, await horairesDuCompte(compteId));
  }
  const resultat = lignes.map((l) => {
    const d = l.demande;
    const horaires = horairesParCompte2.get(d.compteId);
    const temps = tempsDemandeAvecHoraires(d, new Date(l.debutStatut), horaires, maintenant);
    const echeance = l.prochaineEcheance ? new Date(l.prochaineEcheance) : null;
    return {
      id: d.id,
      dossierId: d.dossierId,
      dossier: l.dossierLibelle,
      client: l.client,
      famille: d.famille,
      objet: d.objet,
      statut: d.statut,
      acteurAttendu: d.acteurAttendu,
      priorite: d.priorite,
      echeanceLe: d.echeanceLe,
      slaEcheanceLe: d.slaEcheanceLe,
      niveauRelance: d.niveauRelance,
      ouverteLe: d.ouverteLe,
      dernierEvenementLe: d.dernierEvenementLe,
      ageMinutes: temps.total,
      attenteMinutes: temps.statutCourant,
      slaDepasse: Boolean(d.slaEcheanceLe && d.slaEcheanceLe <= maintenant),
      joursAvantEcheance: echeance ? Math.floor((echeance.getTime() - maintenant.getTime()) / 864e5) : null
    };
  });
  const p = await lireParametres();
  const seuilAlerte = Math.max(...p.alertes.joursAvantEcheance, 0);
  const filtre = filtres.risqueSeulement ? resultat.filter((l) => l.slaDepasse || l.joursAvantEcheance !== null && l.joursAvantEcheance <= seuilAlerte) : resultat;
  return filtre.sort((a, b) => {
    if (a.slaDepasse !== b.slaDepasse) return a.slaDepasse ? -1 : 1;
    const ea = a.joursAvantEcheance ?? 9999;
    const eb = b.joursAvantEcheance ?? 9999;
    if (ea !== eb) return ea - eb;
    const pa = POIDS_PRIORITES[a.priorite];
    const pb = POIDS_PRIORITES[b.priorite];
    if (pa !== pb) return pa - pb;
    return b.ageMinutes - a.ageMinutes;
  });
}
async function demandesDuDossier(dossierId, ouvertesSeulement = false) {
  const conditions = [(0, import_drizzle_orm9.eq)(schema_exports.demandes.dossierId, dossierId), conditionPerimetre()];
  if (ouvertesSeulement) conditions.push((0, import_drizzle_orm9.inArray)(schema_exports.demandes.statut, STATUTS_OUVERTS));
  return db.select().from(schema_exports.demandes).where((0, import_drizzle_orm9.and)(...conditions)).orderBy((0, import_drizzle_orm9.desc)(schema_exports.demandes.ouverteLe));
}

// src/server/modules/dossiers/routes.ts
init_constantes();
var routesDossiers = (0, import_express3.Router)();
routesDossiers.use(exigerConnexion);
routesDossiers.get("/", async (req, res) => {
  const q = valider(
    import_zod5.z.object({ q: import_zod5.z.string().trim().max(200).optional(), compteId: import_zod5.z.coerce.number().int().positive().optional(), limite: import_zod5.z.coerce.number().int().min(1).max(100).optional() }),
    req.query
  );
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  const lignes = await chercherDossiers(q.q ?? "", { compteId: q.compteId, limite: q.limite });
  if (p.comptes === null) return res.json(lignes);
  const autorises = new Set(p.comptes);
  const ids = lignes.map((l) => l.id);
  if (!ids.length) return res.json([]);
  const comptes = await db.select({ id: schema_exports.dossiers.id, compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm10.inArray)(schema_exports.dossiers.id, ids));
  const parId = new Map(comptes.map((c) => [c.id, c.compteId]));
  res.json(lignes.filter((l) => autorises.has(parId.get(l.id) ?? -1)));
});
routesDossiers.post("/", exigerEcriture, async (req, res) => {
  const d = valider(dossierSchema, req.body);
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, d.compteId);
  const { dossier, cree } = await trouverOuCreerDossier(d, auteurDe(req));
  res.status(cree ? 201 : 200).json({ dossier, cree });
});
routesDossiers.get("/:id", async (req, res) => {
  const id2 = idParam(req);
  const dossier = await lireDossier(id2);
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, dossier.compteId);
  const demandes2 = await demandesDuDossier(id2);
  const temps = await tempsDesDemandes(demandes2);
  const avecTemps = demandes2.map((d) => ({ ...d, temps: temps.get(d.id) }));
  const echeancesDossier = await db.select().from(schema_exports.echeances).where((0, import_drizzle_orm10.and)((0, import_drizzle_orm10.eq)(schema_exports.echeances.dossierId, id2), (0, import_drizzle_orm10.eq)(schema_exports.echeances.annulee, false))).orderBy((0, import_drizzle_orm10.asc)(schema_exports.echeances.echeanceLe));
  const piecesDossier = await db.select().from(schema_exports.pieces).where((0, import_drizzle_orm10.eq)(schema_exports.pieces.dossierId, id2)).orderBy((0, import_drizzle_orm10.desc)(schema_exports.pieces.creeLe));
  res.json({ dossier, demandes: avecTemps, echeances: echeancesDossier, pieces: piecesDossier });
});
routesDossiers.get("/:id/chronologie", async (req, res) => {
  const id2 = idParam(req);
  const dossier = await lireDossier(id2);
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  res.json(await chronologieDossier(id2));
});
routesDossiers.patch("/:id", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const dossier = await lireDossier(id2);
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  res.json(await modifierDossier(id2, valider(modificationDossierSchema, req.body), auteurDe(req)));
});
var routesEcheances = (0, import_express3.Router)();
routesEcheances.use(exigerConnexion);
routesEcheances.get("/", async (req, res) => {
  const q = valider(
    import_zod5.z.object({ jours: import_zod5.z.coerce.number().int().min(0).max(365).optional(), compteId: import_zod5.z.coerce.number().int().positive().optional() }),
    req.query
  );
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  const horizon = new Date(Date.now() + (q.jours ?? 30) * 864e5);
  const conditions = [(0, import_drizzle_orm10.eq)(schema_exports.echeances.annulee, false), (0, import_drizzle_orm10.gte)(schema_exports.echeances.echeanceLe, new Date(Date.now() - 7 * 864e5))];
  if (q.compteId) conditions.push((0, import_drizzle_orm10.eq)(schema_exports.dossiers.compteId, q.compteId));
  const lignes = await db.select({
    echeance: schema_exports.echeances,
    dossierId: schema_exports.dossiers.id,
    dossier: schema_exports.dossiers.libelle,
    client: schema_exports.dossiers.client,
    compteId: schema_exports.dossiers.compteId
  }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm10.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where((0, import_drizzle_orm10.and)(...conditions, (0, import_drizzle_orm10.lte)(schema_exports.echeances.echeanceLe, horizon))).orderBy((0, import_drizzle_orm10.asc)(schema_exports.echeances.echeanceLe)).limit(300);
  res.json(p.comptes === null ? lignes : lignes.filter((l) => p.comptes.includes(l.compteId)));
});
routesEcheances.post("/", exigerEcriture, async (req, res) => {
  const d = valider(echeanceSchema, req.body);
  const dossier = await lireDossier(d.dossierId);
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema_exports.demandes.dossierId, famille: schema_exports.demandes.famille }).from(schema_exports.demandes).where((0, import_drizzle_orm10.eq)(schema_exports.demandes.id, d.demandeId));
    if (!demande || demande.dossierId !== d.dossierId) throw new ErreurHttp(400, "La demande indiquee n\u2019appartient pas a ce dossier");
    if (demande.famille === FAMILLE_HORS_PERIMETRE) throw new ErreurHttp(400, "Une demande hors perimetre ne porte pas d\u2019echeance");
  }
  const [echeance] = await db.insert(schema_exports.echeances).values({ ...d, creeParId: req.utilisateur.id }).returning();
  await journaliser("echeance_creee", { utilisateurId: req.utilisateur.id, entite: "echeance", entiteId: echeance.id, details: { type: d.type, dossierId: d.dossierId } });
  res.status(201).json(echeance);
});
routesEcheances.patch("/:id", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const d = valider(modificationEcheanceSchema, req.body);
  const [existe] = await db.select({ echeance: schema_exports.echeances, compteId: schema_exports.dossiers.compteId }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm10.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where((0, import_drizzle_orm10.eq)(schema_exports.echeances.id, id2));
  if (!existe) throw new ErreurHttp(404, "Echeance introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), existe.compteId);
  const valeurs = { majLe: /* @__PURE__ */ new Date() };
  if (d.libelle !== void 0) valeurs.libelle = d.libelle;
  if (d.echeanceLe !== void 0) valeurs.echeanceLe = d.echeanceLe;
  if (d.annulee !== void 0) valeurs.annulee = d.annulee;
  if (d.honoree !== void 0) valeurs.honoreeLe = d.honoree ? /* @__PURE__ */ new Date() : null;
  const [maj] = await db.update(schema_exports.echeances).set(valeurs).where((0, import_drizzle_orm10.eq)(schema_exports.echeances.id, id2)).returning();
  res.json(maj);
});

// src/server/modules/demandes/routes.ts
var import_express4 = require("express");
var import_zod7 = require("zod");
var import_drizzle_orm14 = require("drizzle-orm");
init_client();
init_http();
init_evenements();
init_parametres2();

// src/server/modules/evenements/service.ts
var import_drizzle_orm13 = require("drizzle-orm");
init_client();
init_http();
init_evenements();
init_constantes();
function effetNature(nature, interlocuteur) {
  switch (nature) {
    case "demande_entrante":
      return { creation: true, statut: "nouveau" };
    case "consigne_do":
      return { creation: true, statut: "en_cours", acteur: "poste" };
    case "envoi_livrable":
      return { creation: false, statut: "attente_tiers", acteur: interlocuteur === "client" ? "client" : "tiers", premiereReponse: true };
    case "demande_validation_do":
      return { creation: false, statut: "attente_do", acteur: "do", premiereReponse: true };
    case "validation_do":
      return { creation: false, statut: "en_cours", acteur: "poste" };
    case "refus_do":
      return { creation: false, statut: "en_cours", acteur: "poste" };
    case "relance_emise":
      return { creation: false, relance: true };
    case "relance_recue":
      return { creation: false, statut: "en_cours", acteur: "poste" };
    case "reponse_tiers":
      return { creation: false, statut: "en_cours", acteur: "poste" };
    case "information":
      return { creation: false };
  }
}
function verifierSens(nature, sens) {
  const def = definitionNature(nature);
  if (!def) throw new ErreurHttp(400, `Nature inconnue : ${nature}`);
  if (def.sens && !def.sens.includes(sens)) {
    throw new ErreurHttp(400, `La nature \xAB ${def.libelle} \xBB n'est pas compatible avec le sens \xAB ${sens} \xBB`);
  }
}
async function ajouterEvenement(entree, auteur, opts = {}) {
  if (opts.typerAutomatiquement && (!entree.famille || !entree.nature)) {
    entree = await completerParTypage(entree);
  }
  verifierSens(entree.nature, entree.sens);
  if (!entree.demandeId && !entree.dossierId) throw new ErreurHttp(400, "Un evenement doit etre rattache a une demande ou a un dossier");
  if (entree.messageId) {
    const [deja] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm13.eq)(schema_exports.evenements.messageId, entree.messageId));
    if (deja) {
      const demande2 = deja.demandeId ? await lireDemande(deja.demandeId) : null;
      return { evenement: deja, demande: demande2, demandeCreee: false, statutApplique: null, horsPerimetre: estHorsPerimetre(deja.famille) };
    }
  }
  let demande = entree.demandeId ? await lireDemande(entree.demandeId) : null;
  const dossierId = demande?.dossierId ?? entree.dossierId ?? null;
  if (!dossierId) throw new ErreurHttp(400, "Dossier introuvable pour cet evenement");
  const [dossier] = await db.select({ id: schema_exports.dossiers.id, compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm13.eq)(schema_exports.dossiers.id, dossierId));
  if (!dossier) throw new ErreurHttp(404, "Dossier introuvable");
  const survenuLe = entree.survenuLe ?? /* @__PURE__ */ new Date();
  const horsPerimetre = estHorsPerimetre(entree.famille);
  const effet = horsPerimetre ? { creation: false } : effetNature(entree.nature, entree.interlocuteur);
  let demandeCreee = false;
  if (!demande && effet.creation) {
    const famille2 = entree.famille;
    if (!famille2) throw new ErreurHttp(400, "La famille est obligatoire pour ouvrir une demande");
    demande = await creerDemande(
      {
        dossierId: dossier.id,
        famille: famille2,
        objet: entree.objet?.trim() || entree.resume?.trim() || "Demande sans objet",
        origine: entree.source,
        statut: effet.statut ?? "nouveau",
        priorite: entree.priorite,
        echeanceLe: entree.echeanceLe ?? null,
        ouverteLe: survenuLe
      },
      auteur
    );
    demandeCreee = true;
  }
  const [evenement] = await db.insert(schema_exports.evenements).values({
    demandeId: demande?.id ?? null,
    dossierId: dossier.id,
    compteId: dossier.compteId,
    sens: entree.sens,
    famille: entree.famille ?? demande?.famille ?? null,
    nature: entree.nature,
    interlocuteur: entree.interlocuteur ?? null,
    source: entree.source,
    filId: entree.filId ?? null,
    messageId: entree.messageId ?? null,
    expediteur: entree.expediteur ?? null,
    destinataires: entree.destinataires ?? [],
    survenuLe,
    objet: entree.objet ?? null,
    resume: entree.resume ?? null,
    contenu: entree.contenu ?? null,
    confianceTypage: entree.confianceTypage ?? null,
    justificatifs: entree.justificatifs ?? [],
    creeParId: auteur.utilisateurId
  }).returning();
  let statutApplique = null;
  if (demande && !horsPerimetre) {
    if (effet.relance) {
      demande = await enregistrerRelance(demande.id, auteur, survenuLe);
    }
    if (effet.statut && !demandeCreee) {
      const avant = demande.statut;
      demande = await changerStatut(demande.id, effet.statut, auteur, {
        motif: definitionNature(entree.nature)?.libelle ?? entree.nature,
        acteurAttendu: effet.acteur,
        evenementId: evenement.id,
        survenuLe,
        premiereReponse: effet.premiereReponse
      });
      statutApplique = demande.statut === avant ? null : demande.statut;
    } else if (demandeCreee) {
      statutApplique = demande.statut;
    }
    if (!effet.statut && !effet.relance) {
      await db.update(schema_exports.demandes).set({ dernierEvenementLe: survenuLe, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm13.eq)(schema_exports.demandes.id, demande.id));
    }
  }
  await journaliser("evenement_ajoute", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "evenement",
    entiteId: evenement.id,
    details: { dossierId: dossier.id, demandeId: demande?.id ?? null, nature: entree.nature, sens: entree.sens, source: entree.source, horsPerimetre }
  });
  return { evenement, demande, demandeCreee, statutApplique, horsPerimetre };
}
async function completerParTypage(entree) {
  const { typerMessage: typerMessage2 } = await Promise.resolve().then(() => (init_service2(), service_exports));
  const compteId = entree.dossierId ? (await db.select({ compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm13.eq)(schema_exports.dossiers.id, entree.dossierId)))[0]?.compteId : void 0;
  const resultat = await typerMessage2(
    { objet: entree.objet, corps: entree.contenu ?? entree.resume, expediteur: entree.expediteur, destinataires: entree.destinataires, sens: entree.sens },
    { compteId }
  );
  if (!resultat.applicable) {
    return { ...entree, confianceTypage: resultat.typage.confiance, justificatifs: resultat.typage.justificatifs };
  }
  return {
    ...entree,
    famille: entree.famille ?? resultat.typage.famille ?? null,
    nature: entree.nature ?? resultat.typage.nature ?? entree.nature,
    interlocuteur: entree.interlocuteur ?? resultat.typage.interlocuteur ?? null,
    confianceTypage: resultat.typage.confiance,
    justificatifs: resultat.typage.justificatifs
  };
}
async function lireDemande(id2) {
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm13.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  return demande;
}
async function evenementsDeLaDemande(demandeId, limite = 100) {
  return db.select().from(schema_exports.evenements).where((0, import_drizzle_orm13.eq)(schema_exports.evenements.demandeId, demandeId)).orderBy((0, import_drizzle_orm13.desc)(schema_exports.evenements.survenuLe)).limit(Math.min(limite, 500));
}
async function aClasser(seuil, limite = 50) {
  return db.select({ evenement: schema_exports.evenements, dossier: schema_exports.dossiers.libelle }).from(schema_exports.evenements).leftJoin(schema_exports.dossiers, (0, import_drizzle_orm13.eq)(schema_exports.dossiers.id, schema_exports.evenements.dossierId)).where(
    (0, import_drizzle_orm13.and)(
      import_drizzle_orm13.sql`coalesce(${schema_exports.evenements.famille}, '') <> 'T00'`,
      import_drizzle_orm13.sql`${schema_exports.evenements.corrigeLe} IS NULL`,
      import_drizzle_orm13.sql`(${schema_exports.evenements.famille} IS NULL OR (${schema_exports.evenements.confianceTypage} IS NOT NULL AND ${schema_exports.evenements.confianceTypage} < ${seuil}))`
    )
  ).orderBy((0, import_drizzle_orm13.desc)(schema_exports.evenements.survenuLe)).limit(Math.min(limite, 200));
}
async function corrigerTypage(evenementId, modifs, auteur) {
  const [evenement] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm13.eq)(schema_exports.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, "Evenement introuvable");
  if (modifs.nature && modifs.sens) verifierSens(modifs.nature, modifs.sens);
  const [maj] = await db.update(schema_exports.evenements).set({
    famille: modifs.famille ?? evenement.famille,
    nature: modifs.nature ?? evenement.nature,
    interlocuteur: modifs.interlocuteur !== void 0 ? modifs.interlocuteur : evenement.interlocuteur,
    sens: modifs.sens ?? evenement.sens,
    // Le typage devient humain : la confiance automatique n'a plus de sens.
    confianceTypage: null,
    corrigeParId: auteur.utilisateurId,
    corrigeLe: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm13.eq)(schema_exports.evenements.id, evenementId)).returning();
  await journaliser("typage_corrige", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "evenement",
    entiteId: evenementId,
    details: { avant: { famille: evenement.famille, nature: evenement.nature, interlocuteur: evenement.interlocuteur }, apres: modifs }
  });
  const { proposerRegle: proposerRegle2 } = await Promise.resolve().then(() => (init_service2(), service_exports));
  await proposerRegle2(evenementId, modifs, auteur).catch(() => null);
  return maj;
}

// src/server/modules/demandes/routes.ts
init_constantes();
var routesDemandes = (0, import_express4.Router)();
routesDemandes.use(exigerConnexion);
routesDemandes.get("/file", async (req, res) => {
  const q = valider(filtresFileSchema, req.query);
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  const posteId = q.posteId ?? (!q.compteId && req.utilisateur.role === "collaborateur" && p.postes.length === 1 ? p.postes[0] : void 0);
  if (q.posteId) {
    const [poste] = await db.select({ compteId: schema_exports.postes.compteId }).from(schema_exports.postes).where((0, import_drizzle_orm14.eq)(schema_exports.postes.id, q.posteId));
    if (!poste) throw new ErreurHttp(404, "Poste introuvable");
    exigerCompte(p, poste.compteId);
  }
  const lignes = await fileDuJour({
    compteId: q.compteId ?? (!posteId ? compteParDefaut(p) ?? void 0 : void 0),
    posteId,
    familles: q.famille ? [q.famille] : void 0,
    acteurs: q.acteur ? [q.acteur] : void 0,
    statuts: q.statut ? [q.statut] : void 0,
    risqueSeulement: q.risque === "1" || q.risque === "true",
    limite: q.limite
  });
  const visibles = p.comptes === null ? lignes : await filtrerParPerimetre(lignes, p.comptes);
  res.json(visibles);
});
async function filtrerParPerimetre(lignes, comptes) {
  if (!lignes.length) return [];
  if (!comptes.length) return [];
  const rattachements = await db.select({ id: schema_exports.demandes.id, compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm14.and)((0, import_drizzle_orm14.inArray)(schema_exports.demandes.id, lignes.map((l) => l.id)), (0, import_drizzle_orm14.inArray)(schema_exports.demandes.compteId, comptes)));
  const autorises = new Set(rattachements.map((r) => r.id));
  return lignes.filter((l) => autorises.has(l.id));
}
routesDemandes.get("/:id", async (req, res) => {
  const id2 = idParam(req);
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  if (estHorsPerimetre(demande.famille)) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  const dossier = await lireDossier(demande.dossierId);
  const transitions = await db.select().from(schema_exports.transitionsStatut).where((0, import_drizzle_orm14.eq)(schema_exports.transitionsStatut.demandeId, id2)).orderBy(schema_exports.transitionsStatut.survenuLe);
  res.json({
    demande,
    dossier,
    temps: await tempsDemande(demande),
    transitions,
    evenements: await evenementsDeLaDemande(id2)
  });
});
routesDemandes.post("/", exigerEcriture, async (req, res) => {
  const d = valider(demandeSchema, req.body);
  const dossier = await lireDossier(d.dossierId);
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  const demande = await creerDemande(d, auteurDe(req));
  res.status(201).json(demande);
});
routesDemandes.patch("/:id", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const d = valider(modificationDemandeSchema, req.body);
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  if (d.famille && estHorsPerimetre(d.famille)) {
    throw new ErreurHttp(400, `Une demande ne peut pas passer en famille ${FAMILLE_HORS_PERIMETRE} : supprimez-la ou reclassez l\u2019evenement`);
  }
  const valeurs = { majLe: /* @__PURE__ */ new Date() };
  for (const champ of ["objet", "famille", "priorite", "echeanceLe", "notes", "posteId"]) {
    if (d[champ] !== void 0) valeurs[champ] = d[champ];
  }
  if (d.famille && d.famille !== demande.famille) {
    const sla = await calculerSla(demande.compteId, d.famille, demande.ouverteLe);
    valeurs.slaHeures = sla.heures;
    valeurs.slaEcheanceLe = sla.echeance;
  }
  const [maj] = await db.update(schema_exports.demandes).set(valeurs).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, id2)).returning();
  await journaliser("demande_modifiee", { utilisateurId: req.utilisateur.id, entite: "demande", entiteId: id2, details: { champs: Object.keys(valeurs) } });
  res.json(maj);
});
routesDemandes.post("/:id/statut", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const d = valider(changementStatutSchema, req.body);
  const [demande] = await db.select({ compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  const maj = await changerStatut(id2, d.statut, auteurDe(req), { motif: d.motif ?? null, acteurAttendu: d.acteurAttendu });
  res.json({ demande: maj, temps: await tempsDemande(maj) });
});
routesDemandes.post("/:id/relance", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const [demande] = await db.select({ compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  res.json(await enregistrerRelance(id2, auteurDe(req)));
});
var routesSaisie = (0, import_express4.Router)();
routesSaisie.use(exigerConnexion);
routesSaisie.post("/rapide", exigerEcriture, async (req, res) => {
  const d = valider(saisieRapideSchema, req.body);
  const p = await perimetreDe(req.utilisateur);
  exigerCompte(p, d.compteId);
  const auteur = auteurDe(req);
  if (estHorsPerimetre(d.famille)) {
    throw new ErreurHttp(400, `La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : rien n'est enregistre dans le pilotage`);
  }
  let dossierId = d.dossierId ?? null;
  let dossierCree = false;
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema_exports.demandes.dossierId, compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, "Demande introuvable");
    exigerCompte(p, demande.compteId);
    dossierId = demande.dossierId;
  } else if (!dossierId) {
    const n = d.nouveauDossier;
    const { dossier, cree } = await trouverOuCreerDossier(
      {
        compteId: d.compteId,
        posteId: n.posteId ?? posteSurCompte(p, d.compteId),
        client: n.client,
        pays: n.pays ?? null,
        produit: n.produit ?? null,
        operation: n.operation ?? null,
        libelle: n.libelle,
        references: n.references
      },
      auteur
    );
    dossierId = dossier.id;
    dossierCree = cree;
  } else {
    const dossier = await lireDossier(dossierId);
    exigerCompte(p, dossier.compteId);
  }
  const resultat = await ajouterEvenement(
    {
      demandeId: d.demandeId ?? null,
      dossierId,
      sens: d.sens,
      nature: d.nature,
      famille: d.famille,
      interlocuteur: d.interlocuteur ?? null,
      source: d.source,
      survenuLe: d.survenuLe,
      objet: d.objet,
      resume: d.resume ?? null,
      contenu: d.contenu ?? null,
      priorite: d.priorite,
      echeanceLe: d.echeanceLe ?? null
    },
    auteur
  );
  res.status(201).json({
    dossierId,
    dossierCree,
    demande: resultat.demande,
    demandeCreee: resultat.demandeCreee,
    evenementId: resultat.evenement.id,
    statutApplique: resultat.statutApplique
  });
});
routesSaisie.post("/note", exigerEcriture, async (req, res) => {
  const d = valider(
    import_zod7.z.object({
      dossierId: import_zod7.z.number().int().positive().nullish(),
      demandeId: import_zod7.z.number().int().positive().nullish(),
      texte: import_zod7.z.string().trim().min(1, "La note est vide").max(5e3)
    }).refine((v) => Boolean(v.dossierId || v.demandeId), { message: "Rattachez la note a un dossier ou a une demande" }),
    req.body
  );
  const auteur = auteurDe(req);
  let dossierId = d.dossierId ?? null;
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema_exports.demandes.dossierId, compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm14.eq)(schema_exports.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, "Demande introuvable");
    exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
    dossierId = demande.dossierId;
  } else {
    const dossier = await lireDossier(dossierId);
    exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  }
  const resultat = await ajouterEvenement(
    { demandeId: d.demandeId ?? null, dossierId, sens: "interne", nature: "information", source: "saisie", objet: "Note interne", resume: d.texte },
    auteur
  );
  res.status(201).json({ evenementId: resultat.evenement.id });
});
routesDemandes.get("/dossier/:id/liste", async (req, res) => {
  const id2 = idParam(req);
  const dossier = await lireDossier(id2);
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  const demandes2 = await demandesDuDossier(id2);
  const temps = await tempsDesDemandes(demandes2);
  res.json(demandes2.map((d) => ({ ...d, temps: temps.get(d.id) })));
});

// src/server/modules/evenements/routes.ts
var import_express5 = require("express");
var import_drizzle_orm15 = require("drizzle-orm");
init_client();
init_http();
init_parametres2();
var routesEvenements = (0, import_express5.Router)();
routesEvenements.use(exigerConnexion);
routesEvenements.post("/", exigerEcriture, async (req, res) => {
  const d = valider(evenementSchema, req.body);
  const p = await perimetreDe(req.utilisateur);
  if (d.demandeId) {
    const [demande] = await db.select({ compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm15.eq)(schema_exports.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, "Demande introuvable");
    exigerCompte(p, demande.compteId);
  } else {
    const dossier = await lireDossier(d.dossierId);
    exigerCompte(p, dossier.compteId);
  }
  const resultat = await ajouterEvenement(d, auteurDe(req), { typerAutomatiquement: true });
  res.status(201).json({
    evenement: resultat.evenement,
    demande: resultat.demande,
    demandeCreee: resultat.demandeCreee,
    statutApplique: resultat.statutApplique,
    horsPerimetre: resultat.horsPerimetre
  });
});
routesEvenements.get("/a-classer", async (req, res) => {
  const p = await perimetreDe(req.utilisateur);
  const parametres2 = await lireParametres();
  const lignes = await aClasser(parametres2.seuilConfianceTypage);
  res.json(p.comptes === null ? lignes : lignes.filter((l) => p.comptes.includes(l.evenement.compteId)));
});
routesEvenements.post("/:id/typage", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const [evenement] = await db.select({ compteId: schema_exports.evenements.compteId }).from(schema_exports.evenements).where((0, import_drizzle_orm15.eq)(schema_exports.evenements.id, id2));
  if (!evenement) throw new ErreurHttp(404, "Evenement introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), evenement.compteId);
  res.json(await corrigerTypage(id2, valider(correctionTypageSchema, req.body), auteurDe(req)));
});

// src/server/modules/import/routes.ts
var import_express6 = require("express");
var import_multer = __toESM(require("multer"));
var import_zod8 = require("zod");
var import_drizzle_orm17 = require("drizzle-orm");
init_client();
init_config();
init_http();

// src/server/modules/import/service.ts
var import_luxon2 = require("luxon");
var import_drizzle_orm16 = require("drizzle-orm");
init_client();
init_http();
init_evenements();
init_securite();

// src/server/lib/xlsx/zip.ts
var import_node_zlib = __toESM(require("node:zlib"));
var SIGNATURE_FIN_CENTRAL = 101010256;
var SIGNATURE_CENTRAL = 33639248;
var SIGNATURE_LOCAL = 67324752;
var SIGNATURE_FIN_CENTRAL_ZIP64 = 101075792;
var TAILLE_MAX_COMMENTAIRE = 65535;
function trouverFinCentral(buffer) {
  const debut = Math.max(0, buffer.length - TAILLE_MAX_COMMENTAIRE - 22);
  for (let i = buffer.length - 22; i >= debut; i--) {
    if (buffer.readUInt32LE(i) === SIGNATURE_FIN_CENTRAL) return i;
  }
  throw new Error("Archive invalide : en-tete de fin de repertoire central introuvable (le fichier n'est pas un classeur xlsx)");
}
function lireZip(buffer) {
  const finCentral = trouverFinCentral(buffer);
  let nombre = buffer.readUInt16LE(finCentral + 10);
  let offsetCentral = buffer.readUInt32LE(finCentral + 16);
  if (nombre === 65535 || offsetCentral === 4294967295) {
    const locateur = finCentral - 20;
    if (locateur < 0 || buffer.readUInt32LE(locateur) !== 117853008) throw new Error("Archive ZIP64 invalide");
    const offsetFinZip64 = Number(buffer.readBigUInt64LE(locateur + 8));
    if (buffer.readUInt32LE(offsetFinZip64) !== SIGNATURE_FIN_CENTRAL_ZIP64) throw new Error("Archive ZIP64 invalide");
    nombre = Number(buffer.readBigUInt64LE(offsetFinZip64 + 32));
    offsetCentral = Number(buffer.readBigUInt64LE(offsetFinZip64 + 48));
  }
  const entrees = /* @__PURE__ */ new Map();
  let position = offsetCentral;
  for (let i = 0; i < nombre; i++) {
    if (buffer.readUInt32LE(position) !== SIGNATURE_CENTRAL) throw new Error(`Archive invalide : entree ${i + 1} illisible`);
    const drapeaux = buffer.readUInt16LE(position + 8);
    const methode = buffer.readUInt16LE(position + 10);
    const dateHeureDos = buffer.readUInt16LE(position + 12);
    const dateDos = buffer.readUInt16LE(position + 14);
    const crc322 = buffer.readUInt32LE(position + 16);
    const tailleCompressee = buffer.readUInt32LE(position + 20);
    const tailleOriginale = buffer.readUInt32LE(position + 24);
    const longueurNom = buffer.readUInt16LE(position + 28);
    const longueurExtra = buffer.readUInt16LE(position + 30);
    const longueurCommentaire = buffer.readUInt16LE(position + 32);
    const offsetLocal = buffer.readUInt32LE(position + 42);
    const nom = buffer.subarray(position + 46, position + 46 + longueurNom).toString("utf8");
    if (buffer.readUInt32LE(offsetLocal) !== SIGNATURE_LOCAL) throw new Error(`Archive invalide : en-tete local de \xAB ${nom} \xBB illisible`);
    const longueurNomLocal = buffer.readUInt16LE(offsetLocal + 26);
    const longueurExtraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const debutDonnees = offsetLocal + 30 + longueurNomLocal + longueurExtraLocal;
    const brut = buffer.subarray(debutDonnees, debutDonnees + tailleCompressee);
    let contenu;
    if (methode === 0) contenu = Buffer.from(brut);
    else if (methode === 8) contenu = import_node_zlib.default.inflateRawSync(brut);
    else throw new Error(`Methode de compression ${methode} non geree pour \xAB ${nom} \xBB`);
    entrees.set(nom, { nom, contenu, methode, crc32: crc322, tailleCompressee, tailleOriginale, dateHeureDos, dateDos, drapeaux });
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return entrees;
}

// src/server/lib/xlsx/lecture.ts
function decoderRef(ref2) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref2);
  if (!m) return { colonne: 0, ligne: 0 };
  let colonne = 0;
  for (const c of m[1]) colonne = colonne * 26 + (c.charCodeAt(0) - 64);
  return { colonne, ligne: Number(m[2]) };
}
function lettreColonne(colonne) {
  let n = colonne;
  let sortie = "";
  while (n > 0) {
    const reste = (n - 1) % 26;
    sortie = String.fromCharCode(65 + reste) + sortie;
    n = Math.floor((n - 1) / 26);
  }
  return sortie;
}
var ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decoderXml(texte2) {
  return texte2.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (tout, code) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES[code] ?? tout;
  });
}
function encoderXml(texte2) {
  return texte2.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}
function texteDesT(fragment) {
  let sortie = "";
  const motif = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while (m = motif.exec(fragment)) sortie += decoderXml(m[1] ?? "");
  return sortie;
}
function lireChainesPartagees(entrees) {
  const partie = entrees.get("xl/sharedStrings.xml");
  if (!partie) return [];
  const xml = partie.contenu.toString("utf8");
  const chaines = [];
  const motif = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m;
  while (m = motif.exec(xml)) chaines.push(m[1] === void 0 ? "" : texteDesT(m[1]));
  return chaines;
}
function lireOnglets(entrees) {
  const classeur = entrees.get("xl/workbook.xml");
  if (!classeur) throw new Error("Classeur invalide : xl/workbook.xml absent");
  const relations = entrees.get("xl/_rels/workbook.xml.rels");
  const cibles = /* @__PURE__ */ new Map();
  if (relations) {
    const xml2 = relations.contenu.toString("utf8");
    const motif2 = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g;
    let m2;
    while (m2 = motif2.exec(xml2)) {
      const cible = m2[2].startsWith("/") ? m2[2].slice(1) : `xl/${m2[2].replace(/^\.\//, "")}`;
      cibles.set(m2[1], cible);
    }
  }
  const xml = classeur.contenu.toString("utf8");
  const onglets = [];
  const motif = /<sheet\b([^>]*)\/?>/g;
  let m;
  let indice = 0;
  while (m = motif.exec(xml)) {
    const attributs = m[1];
    const nom = /\bname="([^"]*)"/.exec(attributs)?.[1];
    if (nom === void 0) continue;
    indice++;
    const idRelation = /\br:id="([^"]*)"/.exec(attributs)?.[1];
    const chemin = idRelation && cibles.get(idRelation) || `xl/worksheets/sheet${indice}.xml`;
    onglets.push({ nom: decoderXml(nom), chemin });
  }
  return onglets;
}
var FORMATS_DATE_INTEGRES = /* @__PURE__ */ new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function dateSerieVersDate(serie) {
  const jours = serie > 59 ? serie - 1 : serie;
  return new Date(Math.round((jours - 25568) * 864e5));
}
function estFormatDate(numeroFormat, formatsPersonnalises) {
  if (numeroFormat === null) return false;
  if (FORMATS_DATE_INTEGRES.has(numeroFormat)) return true;
  const code = formatsPersonnalises.get(numeroFormat);
  if (!code) return false;
  return /(^|[^\\])[dmyhs]/i.test(code.replace(/"[^"]*"/g, ""));
}
function lireStyles(entrees) {
  const partie = entrees.get("xl/styles.xml");
  if (!partie) return { parStyle: [], personnalises: /* @__PURE__ */ new Map() };
  const xml = partie.contenu.toString("utf8");
  const personnalises = /* @__PURE__ */ new Map();
  const motifFormats = /<numFmt\b[^>]*\bnumFmtId="(\d+)"[^>]*\bformatCode="([^"]*)"[^>]*\/?>/g;
  let m;
  while (m = motifFormats.exec(xml)) personnalises.set(Number(m[1]), decoderXml(m[2]));
  const blocXf = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  const parStyle = [];
  if (blocXf) {
    const motifXf = /<xf\b([^>]*)\/?>/g;
    let x;
    while (x = motifXf.exec(blocXf[1])) parStyle.push(Number(/\bnumFmtId="(\d+)"/.exec(x[1])?.[1] ?? 0));
  }
  return { parStyle, personnalises };
}
function lireFeuille(xml, chaines, styles) {
  const lignes = /* @__PURE__ */ new Map();
  let derniereLigne = 0;
  const motif = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while (m = motif.exec(xml)) {
    const attributs = m[1];
    const corps = m[2] ?? "";
    const ref2 = /\br="([A-Z]+\d+)"/.exec(attributs)?.[1];
    if (!ref2) continue;
    const { colonne, ligne } = decoderRef(ref2);
    const type = /\bt="([^"]*)"/.exec(attributs)?.[1] ?? "n";
    const style = /\bs="(\d+)"/.exec(attributs)?.[1];
    const formule = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(corps)?.[1];
    const brutV = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(corps)?.[1];
    let texte2 = "";
    let nombre = null;
    if (type === "s") {
      const indice = brutV === void 0 ? NaN : Number(brutV);
      texte2 = Number.isInteger(indice) ? chaines[indice] ?? "" : "";
    } else if (type === "inlineStr") {
      texte2 = texteDesT(corps);
    } else if (type === "str") {
      texte2 = decoderXml(brutV ?? "");
    } else if (type === "b") {
      texte2 = brutV === "1" ? "VRAI" : "FAUX";
    } else if (type === "e") {
      texte2 = decoderXml(brutV ?? "");
    } else if (brutV !== void 0 && brutV !== "") {
      nombre = Number(brutV);
      if (!Number.isFinite(nombre)) {
        nombre = null;
        texte2 = decoderXml(brutV);
      } else {
        const numeroFormat = style === void 0 ? null : styles.parStyle[Number(style)] ?? null;
        texte2 = estFormatDate(numeroFormat, styles.personnalises) ? dateSerieVersDate(nombre).toISOString().slice(0, 10) : String(nombre);
      }
    }
    const cellule = { ref: ref2, colonne, ligne, texte: texte2, nombre, formule: formule === void 0 ? null : decoderXml(formule) };
    const liste = lignes.get(ligne) ?? [];
    liste.push(cellule);
    lignes.set(ligne, liste);
    if (ligne > derniereLigne) derniereLigne = ligne;
  }
  for (const liste of lignes.values()) liste.sort((a, b) => a.colonne - b.colonne);
  return { lignes, derniereLigne };
}
function lireClasseur(buffer) {
  const entrees = lireZip(buffer);
  const chainesPartagees = lireChainesPartagees(entrees);
  const styles = lireStyles(entrees);
  const onglets = [];
  for (const { nom, chemin } of lireOnglets(entrees)) {
    const partie = entrees.get(chemin);
    if (!partie) continue;
    const { lignes, derniereLigne } = lireFeuille(partie.contenu.toString("utf8"), chainesPartagees, styles);
    onglets.push({ nom, chemin, lignes, derniereLigne });
  }
  return { onglets, entrees, chainesPartagees };
}
function valeur(cellules, colonne) {
  return cellules?.find((c) => c.colonne === colonne)?.texte.trim() ?? "";
}
function ongletNomme(classeur, nom) {
  const cible = nom.trim().toLowerCase();
  return classeur.onglets.find((o) => o.nom.trim().toLowerCase() === cible);
}

// src/server/modules/import/service.ts
init_constantes();
var ONGLET_SUIVI_QUOTIDIEN = "Suivi Quotidien";
var COL_DATE = 1;
var COL_CLIENT = 3;
var COL_PRODUIT = 6;
var COL_DESCRIPTION = 7;
var COL_LIVRABLES = 8;
var COL_PRIORITE = 9;
var STATUTS_NORMALISES = STATUTS_REPORTING.map((s) => ({ statut: s, cle: normaliser(s) }));
function extraireStatut(description) {
  const texte2 = description.trim();
  if (!texte2) return null;
  const segments = texte2.split(":");
  const dernier = normaliser(segments[segments.length - 1] ?? "");
  const candidats = [...STATUTS_NORMALISES].sort((a, b) => b.cle.length - a.cle.length);
  const exact = candidats.find((c) => c.cle === dernier);
  if (exact) return exact.statut;
  const contenu = candidats.find((c) => dernier.startsWith(c.cle));
  return contenu?.statut ?? null;
}
function statutDossierDepuisReporting(statut) {
  switch (statut) {
    case "Termine":
      return "clos";
    case "Annule":
      return "annule";
    case "En attente client":
      return "en_attente";
    default:
      return "ouvert";
  }
}
function separerClientPays(brut) {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(brut.trim());
  if (!m || !m[1].trim()) return { client: brut.trim(), pays: null };
  return { client: m[1].trim(), pays: m[2].trim() };
}
function lireJour(brut) {
  const texte2 = brut.trim();
  if (!texte2) return null;
  const jjmmaaaa = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte2);
  if (jjmmaaaa) {
    const d = import_luxon2.DateTime.fromObject({ day: Number(jjmmaaaa[1]), month: Number(jjmmaaaa[2]), year: Number(jjmmaaaa[3]) });
    return d.isValid ? d.toISODate() : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte2);
  if (iso) {
    const d = import_luxon2.DateTime.fromISO(texte2.slice(0, 10));
    return d.isValid ? d.toISODate() : null;
  }
  return null;
}
function estEnTete(cellules) {
  const a = normaliser(valeur(cellules, COL_DATE));
  const g = normaliser(valeur(cellules, COL_DESCRIPTION));
  return a.startsWith("date") || g.includes("description") || g.includes("travaux") || g.includes("taches");
}
function lireSuiviQuotidien(onglet) {
  const lignes = [];
  const anomalies = [];
  let jourCourant = null;
  for (let numero = 1; numero <= onglet.derniereLigne; numero++) {
    const cellules = onglet.lignes.get(numero);
    if (!cellules?.length) continue;
    const toutVide = cellules.every((c) => !c.texte.trim());
    if (toutVide) continue;
    if (estEnTete(cellules)) continue;
    const jourLu = lireJour(valeur(cellules, COL_DATE));
    if (jourLu) jourCourant = jourLu;
    const client = valeur(cellules, COL_CLIENT);
    const produit = valeur(cellules, COL_PRODUIT);
    const description = valeur(cellules, COL_DESCRIPTION);
    if (!client && !produit && !description) continue;
    if (!jourCourant) {
      anomalies.push({ ligne: numero, raison: "aucune date de bloc connue pour cette ligne" });
      continue;
    }
    if (!client) {
      anomalies.push({ ligne: numero, raison: "client ou pays absent en colonne C" });
      continue;
    }
    lignes.push({
      ligne: numero,
      jour: jourCourant,
      client,
      produit,
      description,
      statutReporting: extraireStatut(description),
      livrables: valeur(cellules, COL_LIVRABLES),
      prioriteLendemain: valeur(cellules, COL_PRIORITE)
    });
  }
  return { lignes, anomalies };
}
async function importerClasseur(buffer, opts, auteur) {
  let classeur;
  try {
    classeur = lireClasseur(buffer);
  } catch (e) {
    throw new ErreurHttp(400, `Classeur illisible : ${e instanceof Error ? e.message : String(e)}`);
  }
  const onglet = ongletNomme(classeur, ONGLET_SUIVI_QUOTIDIEN);
  if (!onglet) {
    const noms = classeur.onglets.map((o) => o.nom).join(", ");
    throw new ErreurHttp(400, `Onglet \xAB ${ONGLET_SUIVI_QUOTIDIEN} \xBB absent du classeur. Onglets trouves : ${noms || "aucun"}`);
  }
  const { lignes, anomalies } = lireSuiviQuotidien(onglet);
  const parDossier = /* @__PURE__ */ new Map();
  for (const l of lignes) {
    const cle = `${normaliser(l.client)}|${normaliser(l.produit)}`;
    const precedent = parDossier.get(cle);
    if (!precedent || l.jour >= precedent.jour) parDossier.set(cle, l);
  }
  const dossiers2 = [];
  let crees = 0;
  let misAJour = 0;
  for (const l of parDossier.values()) {
    const { client, pays } = separerClientPays(l.client);
    const existants = await dossiersParClientProduit(opts.compteId, client, l.produit || null);
    let dossier;
    let cree;
    if (existants.length === 1) {
      dossier = existants[0];
      cree = false;
    } else {
      const r = await trouverOuCreerDossier(
        {
          compteId: opts.compteId,
          posteId: opts.posteId ?? null,
          client,
          pays,
          produit: l.produit || null,
          operation: null
        },
        auteur
      );
      dossier = r.dossier;
      cree = r.cree;
    }
    const statut = statutDossierDepuisReporting(l.statutReporting);
    const resume = l.statutReporting ? `${l.statutReporting} au ${import_luxon2.DateTime.fromISO(l.jour).toFormat("dd/MM/yyyy")}` : null;
    const [maj] = await db.update(schema_exports.dossiers).set({ statut, resume, clotureLe: statut === "clos" || statut === "annule" ? /* @__PURE__ */ new Date() : null, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm16.eq)(schema_exports.dossiers.id, dossier.id)).returning();
    dossiers2.push(maj ?? dossier);
    if (cree) crees++;
    else misAJour++;
  }
  const jours = lignes.map((l) => l.jour).sort();
  const bilan = {
    lignesLues: lignes.length,
    lignesIgnorees: anomalies.length,
    dossiersCrees: crees,
    dossiersMisAJour: misAJour,
    jourDebut: jours[0] ?? null,
    jourFin: jours[jours.length - 1] ?? null,
    anomalies: anomalies.slice(0, 50)
  };
  await db.insert(schema_exports.imports).values({
    compteId: opts.compteId,
    nomFichier: opts.nomFichier,
    empreinte: sha256(buffer),
    bilan,
    jourDebut: bilan.jourDebut,
    jourFin: bilan.jourFin,
    importeParId: auteur.utilisateurId
  });
  await journaliser("classeur_importe", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "compte",
    entiteId: opts.compteId,
    details: { nomFichier: opts.nomFichier, ...bilan, anomalies: bilan.anomalies.length }
  });
  return { bilan, dossiers: dossiers2 };
}

// src/server/modules/import/routes.ts
var TYPES_ACCEPTES = /* @__PURE__ */ new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream"
]);
var envoi = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: config.tailleMaxImportOctets, files: 1 },
  fileFilter: (_req, fichier, callback) => {
    const extensionOk = /\.xlsx$/i.test(fichier.originalname);
    if (!extensionOk || !TYPES_ACCEPTES.has(fichier.mimetype)) {
      return callback(new ErreurHttp(400, "Seuls les classeurs .xlsx sont acceptes"));
    }
    callback(null, true);
  }
});
var routesImport = (0, import_express6.Router)();
routesImport.use(exigerConnexion);
routesImport.post("/classeur", exigerRole("admin", "manager"), envoi.single("fichier"), async (req, res) => {
  if (!req.file) throw new ErreurHttp(400, "Aucun classeur recu (champ \xAB fichier \xBB attendu)");
  const d = valider(
    import_zod8.z.object({ compteId: import_zod8.z.coerce.number().int().positive(), posteId: import_zod8.z.coerce.number().int().positive().optional() }),
    req.body
  );
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const { bilan, dossiers: dossiers2 } = await importerClasseur(
    req.file.buffer,
    { compteId: d.compteId, posteId: d.posteId ?? null, nomFichier: req.file.originalname },
    auteurDe(req)
  );
  res.status(201).json({ bilan, dossiers: dossiers2.map((x) => ({ id: x.id, libelle: x.libelle, statut: x.statut, resume: x.resume })) });
});
routesImport.get("/", async (req, res) => {
  const d = valider(import_zod8.z.object({ compteId: import_zod8.z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const lignes = await db.select({
    id: schema_exports.imports.id,
    nomFichier: schema_exports.imports.nomFichier,
    bilan: schema_exports.imports.bilan,
    jourDebut: schema_exports.imports.jourDebut,
    jourFin: schema_exports.imports.jourFin,
    creeLe: schema_exports.imports.creeLe
  }).from(schema_exports.imports).where((0, import_drizzle_orm17.eq)(schema_exports.imports.compteId, d.compteId)).orderBy((0, import_drizzle_orm17.desc)(schema_exports.imports.creeLe)).limit(50);
  res.json(lignes);
});

// src/server/modules/indicateurs/routes.ts
var import_express7 = require("express");
var import_zod9 = require("zod");
var import_drizzle_orm19 = require("drizzle-orm");
init_client();
init_http();

// src/server/modules/indicateurs/service.ts
var import_drizzle_orm18 = require("drizzle-orm");
var import_luxon3 = require("luxon");
init_client();
init_parametres2();
init_constantes();
init_heures_ouvrees();
function periodesComparees(jours, maintenant = /* @__PURE__ */ new Date()) {
  const fin = maintenant;
  const debut = new Date(fin.getTime() - jours * 864e5);
  return {
    courante: { debut, fin },
    precedente: { debut: new Date(debut.getTime() - jours * 864e5), fin: debut }
  };
}
function conditionsCommunes(filtres) {
  const conditions = [import_drizzle_orm18.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`];
  if (filtres.compteId) conditions.push((0, import_drizzle_orm18.eq)(schema_exports.demandes.compteId, filtres.compteId));
  if (filtres.posteId) conditions.push((0, import_drizzle_orm18.eq)(schema_exports.demandes.posteId, filtres.posteId));
  return conditions;
}
async function flux(periode, filtres = {}) {
  const base = conditionsCommunes(filtres);
  const entrees = await db.select({
    jour: import_drizzle_orm18.sql`to_char(${schema_exports.demandes.ouverteLe} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as("jour"),
    famille: schema_exports.demandes.famille,
    nombre: import_drizzle_orm18.sql`count(*)::int`.as("nombre")
  }).from(schema_exports.demandes).where((0, import_drizzle_orm18.and)(...base, (0, import_drizzle_orm18.gte)(schema_exports.demandes.ouverteLe, periode.debut), (0, import_drizzle_orm18.lt)(schema_exports.demandes.ouverteLe, periode.fin))).groupBy(import_drizzle_orm18.sql`1`, schema_exports.demandes.famille);
  const sorties = await db.select({
    jour: import_drizzle_orm18.sql`to_char(${schema_exports.demandes.termineeLe} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as("jour"),
    famille: schema_exports.demandes.famille,
    nombre: import_drizzle_orm18.sql`count(*)::int`.as("nombre")
  }).from(schema_exports.demandes).where((0, import_drizzle_orm18.and)(...base, import_drizzle_orm18.sql`${schema_exports.demandes.termineeLe} IS NOT NULL`, (0, import_drizzle_orm18.gte)(schema_exports.demandes.termineeLe, periode.debut), (0, import_drizzle_orm18.lt)(schema_exports.demandes.termineeLe, periode.fin))).groupBy(import_drizzle_orm18.sql`1`, schema_exports.demandes.famille);
  const parJour = /* @__PURE__ */ new Map();
  const parFamille = /* @__PURE__ */ new Map();
  const cumuler2 = (lignes, cle) => {
    for (const l of lignes) {
      const j = parJour.get(l.jour) ?? { entrees: 0, sorties: 0 };
      j[cle] += l.nombre;
      parJour.set(l.jour, j);
      const f = parFamille.get(l.famille) ?? { entrees: 0, sorties: 0 };
      f[cle] += l.nombre;
      parFamille.set(l.famille, f);
    }
  };
  cumuler2(entrees, "entrees");
  cumuler2(sorties, "sorties");
  const totalEntrees = entrees.reduce((s, l) => s + l.nombre, 0);
  const totalSorties = sorties.reduce((s, l) => s + l.nombre, 0);
  return {
    entrees: totalEntrees,
    sorties: totalSorties,
    solde: totalEntrees - totalSorties,
    parJour: [...parJour.entries()].map(([jour, v]) => ({ jour, ...v })).sort((a, b) => a.jour.localeCompare(b.jour)),
    parFamille: [...parFamille.entries()].map(([famille2, v]) => ({ famille: famille2, ...v })).sort((a, b) => b.entrees - a.entrees)
  };
}
var TRANCHES = [
  { tranche: "moins d\u2019un jour", max: 1 },
  { tranche: "1 a 2 jours", max: 2 },
  { tranche: "3 a 5 jours", max: 5 },
  { tranche: "6 a 10 jours", max: 10 },
  { tranche: "plus de 10 jours", max: Infinity }
];
async function stock(filtres = {}, maintenant = /* @__PURE__ */ new Date()) {
  const base = conditionsCommunes(filtres);
  const demandes2 = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm18.and)(...base, (0, import_drizzle_orm18.inArray)(schema_exports.demandes.statut, STATUTS_OUVERTS)));
  const debuts = await debutsDeStatut(demandes2);
  const horaires = await horairesParCompte(demandes2);
  const minutesJour = minutesParJourOuvre(horaires.values().next().value ?? await horairesDuCompte(filtres.compteId));
  const parStatut = {};
  const parFamille = {};
  const parActeur = {};
  const ages = [];
  let slaDepasse = 0;
  let chargeEstimeeMinutes = 0;
  for (const d of demandes2) {
    parStatut[d.statut] = (parStatut[d.statut] ?? 0) + 1;
    parFamille[d.famille] = (parFamille[d.famille] ?? 0) + 1;
    parActeur[d.acteurAttendu] = (parActeur[d.acteurAttendu] ?? 0) + 1;
    const temps = tempsDemandeAvecHoraires(d, debuts.get(d.id) ?? d.ouverteLe, horaires.get(d.compteId), maintenant);
    ages.push(temps.total);
    if (d.slaEcheanceLe && d.slaEcheanceLe <= maintenant) slaDepasse++;
    chargeEstimeeMinutes += famille(d.famille)?.tempsStandardMinutes ?? 0;
  }
  ages.sort((a, b) => a - b);
  const tranches = TRANCHES.map((t) => ({ tranche: t.tranche, nombre: 0 }));
  for (const age of ages) {
    const jours = age / minutesJour;
    const indice = TRANCHES.findIndex((t) => jours <= t.max);
    tranches[indice === -1 ? TRANCHES.length - 1 : indice].nombre++;
  }
  return {
    total: demandes2.length,
    parStatut,
    parFamille,
    parActeur,
    ageMoyenMinutes: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0,
    ageMedianMinutes: ages.length ? Math.round(ages[Math.floor(ages.length / 2)]) : 0,
    tranchesAge: tranches,
    slaDepasse,
    chargeEstimeeMinutes
  };
}
function mediane(valeurs) {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  return Math.round(tri[Math.floor(tri.length / 2)]);
}
function moyenne(valeurs) {
  if (!valeurs.length) return null;
  return Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
}
async function delais(periode, filtres = {}) {
  const base = conditionsCommunes(filtres);
  const demandes2 = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm18.and)(...base, import_drizzle_orm18.sql`${schema_exports.demandes.termineeLe} IS NOT NULL`, (0, import_drizzle_orm18.gte)(schema_exports.demandes.termineeLe, periode.debut), (0, import_drizzle_orm18.lt)(schema_exports.demandes.termineeLe, periode.fin)));
  const horaires = await horairesParCompte(demandes2);
  const premieres = [];
  const totaux = [];
  const attente = {};
  const parFamille = /* @__PURE__ */ new Map();
  let dansSla = 0;
  let avecSla = 0;
  for (const d of demandes2) {
    const temps = tempsDemandeAvecHoraires(d, d.termineeLe, horaires.get(d.compteId), d.termineeLe);
    totaux.push(temps.total);
    if (temps.premiereReponse !== null) premieres.push(temps.premiereReponse);
    for (const [acteur, minutes] of Object.entries(temps.parActeur)) attente[acteur] = (attente[acteur] ?? 0) + minutes;
    const f = parFamille.get(d.famille) ?? { delais: [], dansSla: 0, avecSla: 0 };
    f.delais.push(temps.total);
    if (d.slaEcheanceLe) {
      avecSla++;
      f.avecSla++;
      if (d.termineeLe <= d.slaEcheanceLe) {
        dansSla++;
        f.dansSla++;
      }
    }
    parFamille.set(d.famille, f);
  }
  const attenteParActeurMinutes = { poste: 0, do: 0, client: 0, tiers: 0, aucun: 0 };
  for (const [acteur, minutes] of Object.entries(attente)) {
    if (acteur in attenteParActeurMinutes) attenteParActeurMinutes[acteur] = Math.round(minutes);
  }
  return {
    terminees: demandes2.length,
    premiereReponseMoyenneMinutes: moyenne(premieres),
    premiereReponseMedianeMinutes: mediane(premieres),
    delaiTotalMoyenMinutes: moyenne(totaux),
    delaiTotalMedianMinutes: mediane(totaux),
    attenteParActeurMinutes,
    respectSla: avecSla ? dansSla / avecSla : null,
    parFamille: [...parFamille.entries()].map(([famille2, v]) => ({
      famille: famille2,
      terminees: v.delais.length,
      delaiMedianMinutes: mediane(v.delais) ?? 0,
      respectSla: v.avecSla ? v.dansSla / v.avecSla : null
    })).sort((a, b) => b.terminees - a.terminees)
  };
}
async function charge(periode, filtres = {}) {
  const base = conditionsCommunes(filtres);
  const lignes = await db.select({ famille: schema_exports.demandes.famille, volume: import_drizzle_orm18.sql`count(*)::int`.as("volume") }).from(schema_exports.demandes).where((0, import_drizzle_orm18.and)(...base, (0, import_drizzle_orm18.gte)(schema_exports.demandes.ouverteLe, periode.debut), (0, import_drizzle_orm18.lt)(schema_exports.demandes.ouverteLe, periode.fin))).groupBy(schema_exports.demandes.famille);
  const horaires = await horairesDuCompte(filtres.compteId);
  const minutesJour = minutesParJourOuvre(horaires);
  const parFamille = lignes.map((l) => {
    const ref2 = famille(l.famille);
    const tempsStandardMinutes = ref2?.tempsStandardMinutes ?? 0;
    return {
      famille: l.famille,
      libelle: ref2?.libelle ?? l.famille,
      volume: l.volume,
      tempsStandardMinutes,
      minutes: l.volume * tempsStandardMinutes
    };
  });
  const totalMinutes = parFamille.reduce((s, f) => s + f.minutes, 0);
  return {
    totalMinutes,
    totalJours: Math.round(totalMinutes / minutesJour * 10) / 10,
    parFamille: parFamille.sort((a, b) => b.minutes - a.minutes)
  };
}
async function tableauDeBord(jours, filtres = {}, maintenant = /* @__PURE__ */ new Date()) {
  const { courante, precedente } = periodesComparees(jours, maintenant);
  const parametres2 = await lireParametres();
  const [fluxCourant, stockCourant, delaisCourant, chargeCourante, fluxPrecedent, delaisPrecedent, chargePrecedente] = await Promise.all([
    flux(courante, filtres),
    stock(filtres, maintenant),
    delais(courante, filtres),
    charge(courante, filtres),
    flux(precedente, filtres),
    delais(precedente, filtres),
    charge(precedente, filtres)
  ]);
  const horizonJours = Math.max(...parametres2.alertes.joursAvantEcheance, 0);
  const horizon = new Date(maintenant.getTime() + horizonJours * 864e5);
  const conditionsEcheance = [(0, import_drizzle_orm18.eq)(schema_exports.echeances.annulee, false), import_drizzle_orm18.sql`${schema_exports.echeances.honoreeLe} IS NULL`, (0, import_drizzle_orm18.lte)(schema_exports.echeances.echeanceLe, horizon)];
  if (filtres.compteId) conditionsEcheance.push((0, import_drizzle_orm18.eq)(schema_exports.dossiers.compteId, filtres.compteId));
  const echeances2 = await db.select({
    dossierId: schema_exports.dossiers.id,
    dossier: schema_exports.dossiers.libelle,
    type: schema_exports.echeances.type,
    libelle: schema_exports.echeances.libelle,
    echeanceLe: schema_exports.echeances.echeanceLe
  }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm18.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where((0, import_drizzle_orm18.and)(...conditionsEcheance)).orderBy(schema_exports.echeances.echeanceLe).limit(50);
  const seuilAttenteMinutes = parametres2.sla.attenteDoHeures * 60;
  const enAttenteDo = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers.libelle }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm18.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where((0, import_drizzle_orm18.and)(...conditionsCommunes(filtres), (0, import_drizzle_orm18.eq)(schema_exports.demandes.statut, "attente_do")));
  const debutsDo = await debutsDeStatut(enAttenteDo.map((l) => l.demande));
  const horairesDo = await horairesParCompte(enAttenteDo.map((l) => l.demande));
  const attentesDoLongues = enAttenteDo.map((l) => {
    const temps = tempsDemandeAvecHoraires(l.demande, debutsDo.get(l.demande.id) ?? l.demande.ouverteLe, horairesDo.get(l.demande.compteId), maintenant);
    return { demandeId: l.demande.id, objet: l.demande.objet, dossier: l.dossier, minutesAttente: temps.statutCourant };
  }).filter((l) => l.minutesAttente >= seuilAttenteMinutes).sort((a, b) => b.minutesAttente - a.minutesAttente);
  return {
    periode: { debut: courante.debut.toISOString(), fin: courante.fin.toISOString(), jours },
    flux: fluxCourant,
    stock: stockCourant,
    delais: delaisCourant,
    charge: chargeCourante,
    precedent: { flux: fluxPrecedent, delais: delaisPrecedent, charge: chargePrecedente },
    echeancesProches: echeances2.map((e) => ({
      ...e,
      joursRestants: Math.floor((e.echeanceLe.getTime() - maintenant.getTime()) / 864e5)
    })),
    attentesDoLongues
  };
}
async function debutsDeStatut(demandes2) {
  if (!demandes2.length) return /* @__PURE__ */ new Map();
  const lignes = await db.select({ demandeId: schema_exports.transitionsStatut.demandeId, debut: import_drizzle_orm18.sql`max(${schema_exports.transitionsStatut.survenuLe})`.as("debut") }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm18.inArray)(schema_exports.transitionsStatut.demandeId, demandes2.map((d) => d.id))).groupBy(schema_exports.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}
async function horairesParCompte(demandes2) {
  const sortie = /* @__PURE__ */ new Map();
  for (const compteId of new Set(demandes2.map((d) => d.compteId))) {
    sortie.set(compteId, await horairesDuCompte(compteId));
  }
  return sortie;
}

// src/server/modules/indicateurs/routes.ts
var routesIndicateurs = (0, import_express7.Router)();
routesIndicateurs.use(exigerConnexion);
routesIndicateurs.get("/tableau-de-bord", async (req, res) => {
  const q = valider(
    import_zod9.z.object({
      compteId: import_zod9.z.coerce.number().int().positive().optional(),
      posteId: import_zod9.z.coerce.number().int().positive().optional(),
      jours: import_zod9.z.coerce.number().int().min(1).max(365).optional()
    }),
    req.query
  );
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  if (q.posteId) {
    const [poste] = await db.select({ compteId: schema_exports.postes.compteId }).from(schema_exports.postes).where((0, import_drizzle_orm19.eq)(schema_exports.postes.id, q.posteId));
    if (!poste) throw new ErreurHttp(404, "Poste introuvable");
    exigerCompte(p, poste.compteId);
  }
  let compteId = q.compteId;
  if (!compteId && p.comptes !== null) {
    compteId = compteParDefaut(p) ?? void 0;
    if (!compteId) {
      if (!p.comptes.length) return res.json({ aucunCompte: true });
      throw new ErreurHttp(400, "Choisissez un compte client : les indicateurs ne se cumulent pas entre comptes");
    }
  }
  res.json(await tableauDeBord(q.jours ?? 7, { compteId, posteId: q.posteId }));
});

// src/server/modules/qualite/routes.ts
var import_express8 = require("express");
var import_zod10 = require("zod");
var import_drizzle_orm22 = require("drizzle-orm");
init_client();
init_http();

// src/server/modules/qualite/service.ts
var import_drizzle_orm20 = require("drizzle-orm");
var import_luxon4 = require("luxon");
init_client();
init_http();
init_evenements();
init_parametres2();
init_constantes();
async function checklistsPourFamille(famille2, compteId) {
  const toutes = await db.select().from(schema_exports.checklists).where((0, import_drizzle_orm20.eq)(schema_exports.checklists.actif, true));
  return toutes.filter((c) => {
    if (c.compteId && compteId && c.compteId !== compteId) return false;
    const familles = c.familles ?? [];
    return familles.length === 0 || familles.includes(famille2);
  });
}
async function enregistrerControleEnvoi(entree, auteur) {
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm20.eq)(schema_exports.demandes.id, entree.demandeId));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  const [checklist] = await db.select().from(schema_exports.checklists).where((0, import_drizzle_orm20.eq)(schema_exports.checklists.id, entree.checklistId));
  if (!checklist) throw new ErreurHttp(404, "Check-list introuvable");
  const points = checklist.points ?? [];
  const inconnus = Object.keys(entree.reponses).filter((cle) => !points.some((p) => p.cle === cle));
  if (inconnus.length) throw new ErreurHttp(400, `Points inconnus pour cette check-list : ${inconnus.join(", ")}`);
  const manquants = points.filter((p) => p.obligatoire && entree.reponses[p.cle] !== true);
  const conforme = manquants.length === 0;
  const [controle] = await db.insert(schema_exports.controlesEnvoi).values({
    demandeId: entree.demandeId,
    checklistId: entree.checklistId,
    evenementId: entree.evenementId ?? null,
    reponses: entree.reponses,
    conforme,
    commentaire: entree.commentaire ?? null,
    controleParId: auteur.utilisateurId
  }).returning();
  await journaliser("controle_envoi", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "demande",
    entiteId: entree.demandeId,
    details: { checklist: checklist.code, conforme, pointsManquants: manquants.map((p) => p.cle) }
  });
  return controle;
}
async function controlesEnvoiDeLaDemande(demandeId) {
  return db.select({ controle: schema_exports.controlesEnvoi, checklist: schema_exports.checklists.libelle, points: schema_exports.checklists.points }).from(schema_exports.controlesEnvoi).leftJoin(schema_exports.checklists, (0, import_drizzle_orm20.eq)(schema_exports.checklists.id, schema_exports.controlesEnvoi.checklistId)).where((0, import_drizzle_orm20.eq)(schema_exports.controlesEnvoi.demandeId, demandeId)).orderBy((0, import_drizzle_orm20.desc)(schema_exports.controlesEnvoi.creeLe));
}
function cleSemaine(date2) {
  const d = import_luxon4.DateTime.fromJSDate(date2);
  return `${d.weekYear}-W${String(d.weekNumber).padStart(2, "0")}`;
}
function bornesSemaine(semaine) {
  const [annee, numero] = semaine.split("-W");
  const d = import_luxon4.DateTime.fromObject({ weekYear: Number(annee), weekNumber: Number(numero), weekday: 1 }).startOf("day");
  return { debut: d.toJSDate(), fin: d.plus({ weeks: 1 }).toJSDate() };
}
async function tirerEchantillon(semaine, opts = {}, auteur) {
  const parametres2 = await lireParametres();
  const taux = opts.taux ?? parametres2.qualite.tauxEchantillon;
  const { debut, fin } = bornesSemaine(semaine);
  const conditions = [
    (0, import_drizzle_orm20.eq)(schema_exports.evenements.sens, "sortant"),
    (0, import_drizzle_orm20.gte)(schema_exports.evenements.survenuLe, debut),
    (0, import_drizzle_orm20.lt)(schema_exports.evenements.survenuLe, fin),
    import_drizzle_orm20.sql`${schema_exports.evenements.demandeId} IS NOT NULL`,
    import_drizzle_orm20.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`
  ];
  if (opts.compteId) conditions.push((0, import_drizzle_orm20.eq)(schema_exports.evenements.compteId, opts.compteId));
  const envois = await db.selectDistinct({ demandeId: schema_exports.evenements.demandeId, famille: schema_exports.demandes.famille }).from(schema_exports.evenements).innerJoin(schema_exports.demandes, (0, import_drizzle_orm20.eq)(schema_exports.demandes.id, schema_exports.evenements.demandeId)).where((0, import_drizzle_orm20.and)(...conditions));
  const deja = await db.select({ demandeId: schema_exports.controlesQualite.demandeId }).from(schema_exports.controlesQualite).where((0, import_drizzle_orm20.eq)(schema_exports.controlesQualite.semaine, semaine));
  const dejaTirees = new Set(deja.map((d) => d.demandeId));
  const candidats = envois.filter((e) => e.demandeId !== null && !dejaTirees.has(e.demandeId));
  const cible = envois.length === 0 ? 0 : Math.max(1, Math.round(envois.length * taux));
  const aTirer = Math.max(0, Math.min(cible - dejaTirees.size, candidats.length));
  const melange = [...candidats].sort(() => Math.random() - 0.5).slice(0, aTirer);
  if (melange.length) {
    const grilleId = opts.grilleId ?? (await grilleParDefaut(opts.compteId))?.id ?? null;
    await db.insert(schema_exports.controlesQualite).values(
      melange.map((e) => ({ demandeId: e.demandeId, grilleId, semaine, notes: {}, reprise: false }))
    );
  }
  await journaliser("echantillon_qualite_tire", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    details: { semaine, envois: envois.length, tires: melange.length, taux }
  });
  return { semaine, envois: envois.length, tires: melange.length, deja: dejaTirees.size };
}
async function grilleParDefaut(compteId) {
  const grilles = await db.select().from(schema_exports.grillesQualite).where((0, import_drizzle_orm20.eq)(schema_exports.grillesQualite.actif, true));
  return grilles.find((g) => g.compteId === compteId) ?? grilles.find((g) => !g.compteId) ?? grilles[0];
}
function calculerNote(criteres, notes) {
  const notes_ = criteres.map((c) => ({ poids: c.poids, note: notes[c.cle] })).filter((x) => typeof x.note === "number" && Number.isFinite(x.note));
  if (!notes_.length) return null;
  const poidsTotal = notes_.reduce((s, x) => s + x.poids, 0);
  if (poidsTotal <= 0) return null;
  return Math.round(notes_.reduce((s, x) => s + x.note * x.poids, 0) / poidsTotal * 100) / 100;
}
async function noterControle(controleId, entree, auteur) {
  const [controle] = await db.select().from(schema_exports.controlesQualite).where((0, import_drizzle_orm20.eq)(schema_exports.controlesQualite.id, controleId));
  if (!controle) throw new ErreurHttp(404, "Controle qualite introuvable");
  let criteres = [];
  if (controle.grilleId) {
    const [grille] = await db.select().from(schema_exports.grillesQualite).where((0, import_drizzle_orm20.eq)(schema_exports.grillesQualite.id, controle.grilleId));
    criteres = grille?.criteres ?? [];
  }
  const inconnus = Object.keys(entree.notes).filter((cle) => !criteres.some((c) => c.cle === cle));
  if (criteres.length && inconnus.length) throw new ErreurHttp(400, `Criteres inconnus pour cette grille : ${inconnus.join(", ")}`);
  const horsPlage = Object.entries(entree.notes).filter(([, n]) => n < 0 || n > 100);
  if (horsPlage.length) throw new ErreurHttp(400, `Note attendue entre 0 et 100 : ${horsPlage.map(([c]) => c).join(", ")}`);
  const note = calculerNote(criteres, entree.notes);
  const [maj] = await db.update(schema_exports.controlesQualite).set({
    notes: entree.notes,
    note: note === null ? null : String(note),
    reprise: entree.reprise ?? controle.reprise,
    bonDuPremierCoup: entree.bonDuPremierCoup !== void 0 ? entree.bonDuPremierCoup : controle.bonDuPremierCoup,
    commentaire: entree.commentaire ?? controle.commentaire,
    controleParId: auteur.utilisateurId
  }).where((0, import_drizzle_orm20.eq)(schema_exports.controlesQualite.id, controleId)).returning();
  await journaliser("controle_qualite_note", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "controle_qualite",
    entiteId: controleId,
    details: { note, reprise: maj.reprise, bonDuPremierCoup: maj.bonDuPremierCoup }
  });
  return maj;
}
async function indicateursQualite(periode, filtres = {}) {
  const conditionsControle = [(0, import_drizzle_orm20.gte)(schema_exports.controlesQualite.creeLe, periode.debut), (0, import_drizzle_orm20.lt)(schema_exports.controlesQualite.creeLe, periode.fin)];
  if (filtres.compteId) conditionsControle.push((0, import_drizzle_orm20.eq)(schema_exports.demandes.compteId, filtres.compteId));
  const controles = await db.select({ controle: schema_exports.controlesQualite }).from(schema_exports.controlesQualite).innerJoin(schema_exports.demandes, (0, import_drizzle_orm20.eq)(schema_exports.demandes.id, schema_exports.controlesQualite.demandeId)).where((0, import_drizzle_orm20.and)(...conditionsControle));
  const avecNote = controles.filter((c) => c.controle.note !== null);
  const avecBon = controles.filter((c) => c.controle.bonDuPremierCoup !== null);
  const conditionsEnvoi = [(0, import_drizzle_orm20.gte)(schema_exports.controlesEnvoi.creeLe, periode.debut), (0, import_drizzle_orm20.lt)(schema_exports.controlesEnvoi.creeLe, periode.fin)];
  if (filtres.compteId) conditionsEnvoi.push((0, import_drizzle_orm20.eq)(schema_exports.demandes.compteId, filtres.compteId));
  const envois = await db.select({ controle: schema_exports.controlesEnvoi, points: schema_exports.checklists.points }).from(schema_exports.controlesEnvoi).innerJoin(schema_exports.demandes, (0, import_drizzle_orm20.eq)(schema_exports.demandes.id, schema_exports.controlesEnvoi.demandeId)).leftJoin(schema_exports.checklists, (0, import_drizzle_orm20.eq)(schema_exports.checklists.id, schema_exports.controlesEnvoi.checklistId)).where((0, import_drizzle_orm20.and)(...conditionsEnvoi));
  const manques = /* @__PURE__ */ new Map();
  for (const e of envois) {
    const points = e.points ?? [];
    const reponses = e.controle.reponses ?? {};
    for (const p of points) {
      if (p.obligatoire && reponses[p.cle] !== true) {
        const deja = manques.get(p.cle) ?? { libelle: p.libelle, manques: 0 };
        deja.manques++;
        manques.set(p.cle, deja);
      }
    }
  }
  return {
    tires: controles.length,
    notes: avecNote.length,
    noteMoyenne: avecNote.length ? Math.round(avecNote.reduce((s, c) => s + Number(c.controle.note), 0) / avecNote.length * 100) / 100 : null,
    tauxReprise: controles.length ? controles.filter((c) => c.controle.reprise).length / controles.length : null,
    bonDuPremierCoup: avecBon.length ? avecBon.filter((c) => c.controle.bonDuPremierCoup).length / avecBon.length : null,
    envoisControles: envois.length,
    tauxConformite: envois.length ? envois.filter((e) => e.controle.conforme).length / envois.length : null,
    pointsManques: [...manques.entries()].map(([cle, v]) => ({ cle, ...v })).sort((a, b) => b.manques - a.manques)
  };
}
async function controlesDeLaSemaine(semaine, compteId) {
  const conditions = [(0, import_drizzle_orm20.eq)(schema_exports.controlesQualite.semaine, semaine)];
  if (compteId) conditions.push((0, import_drizzle_orm20.eq)(schema_exports.demandes.compteId, compteId));
  return db.select({
    controle: schema_exports.controlesQualite,
    demande: schema_exports.demandes,
    dossier: schema_exports.dossiers.libelle,
    grille: schema_exports.grillesQualite.libelle,
    criteres: schema_exports.grillesQualite.criteres
  }).from(schema_exports.controlesQualite).innerJoin(schema_exports.demandes, (0, import_drizzle_orm20.eq)(schema_exports.demandes.id, schema_exports.controlesQualite.demandeId)).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm20.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).leftJoin(schema_exports.grillesQualite, (0, import_drizzle_orm20.eq)(schema_exports.grillesQualite.id, schema_exports.controlesQualite.grilleId)).where((0, import_drizzle_orm20.and)(...conditions)).orderBy((0, import_drizzle_orm20.desc)(schema_exports.controlesQualite.creeLe));
}

// src/server/modules/digest/service.ts
var import_drizzle_orm21 = require("drizzle-orm");
var import_luxon5 = require("luxon");
init_client();
init_parametres2();
init_tirets();
init_heures_ouvrees();
init_constantes();
function decisionAttendue(famille2, objet) {
  const validation = famille(famille2)?.validation ?? "";
  switch (famille2) {
    case "T01":
      return `Valider le transitaire et le prix : ${objet}`;
    case "T02":
      return `Trancher l'exception sur l'expedition : ${objet}`;
    case "T03":
      return `Valider la modification de la facture ou de la proforma : ${objet}`;
    case "T05":
      return `Valider la demarche reglementaire : ${objet}`;
    case "T06":
      return `Valider le tableau de situation : ${objet}`;
    case "T08":
      return `Valider le prix et le MOQ : ${objet}`;
    case "T12":
      return `Signer le courrier : ${objet}`;
    case "T13":
      return `Decider : ${objet}`;
    default:
      return validation ? `${objet} (validation : ${validation})` : objet;
  }
}
function elementsDeDecision(references, montants, echeances2) {
  const sortie = [];
  for (const [cle, valeur2] of Object.entries(references ?? {})) {
    if (valeur2 !== null && valeur2 !== void 0 && String(valeur2).trim()) sortie.push({ libelle: cle, valeur: String(valeur2) });
  }
  for (const [cle, valeur2] of Object.entries(montants ?? {})) {
    if (valeur2 !== null && valeur2 !== void 0 && String(valeur2).trim()) sortie.push({ libelle: `montant approuve ${cle}`, valeur: String(valeur2) });
  }
  for (const e of echeances2) {
    sortie.push({
      libelle: e.libelle || LIBELLES_ECHEANCES[e.type] || e.type,
      valeur: import_luxon5.DateTime.fromJSDate(e.echeanceLe).setLocale("fr").toFormat("dd/MM/yyyy")
    });
  }
  return sortie;
}
async function construireDigest(compteId, maintenant = /* @__PURE__ */ new Date()) {
  const [compte] = await db.select().from(schema_exports.comptesClients).where((0, import_drizzle_orm21.eq)(schema_exports.comptesClients.id, compteId));
  if (!compte) throw new Error(`Compte client ${compteId} introuvable`);
  const parametres2 = await lireParametres();
  const seuilMinutes = parametres2.sla.attenteDoHeures * 60;
  const conditions = [
    (0, import_drizzle_orm21.eq)(schema_exports.demandes.compteId, compteId),
    (0, import_drizzle_orm21.eq)(schema_exports.demandes.statut, "attente_do"),
    import_drizzle_orm21.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`
  ];
  const lignesBrutes = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm21.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where((0, import_drizzle_orm21.and)(...conditions)).orderBy((0, import_drizzle_orm21.asc)(schema_exports.demandes.ouverteLe));
  const horaires = await horairesDuCompte(compteId);
  const debuts = await debutsDeStatut2(lignesBrutes.map((l) => l.demande));
  const dossierIds = [...new Set(lignesBrutes.map((l) => l.dossier.id))];
  const echeances2 = dossierIds.length ? await db.select().from(schema_exports.echeances).where(
    (0, import_drizzle_orm21.and)(
      (0, import_drizzle_orm21.inArray)(schema_exports.echeances.dossierId, dossierIds),
      (0, import_drizzle_orm21.eq)(schema_exports.echeances.annulee, false),
      import_drizzle_orm21.sql`${schema_exports.echeances.honoreeLe} IS NULL`,
      (0, import_drizzle_orm21.lte)(schema_exports.echeances.echeanceLe, new Date(maintenant.getTime() + 30 * 864e5))
    )
  ).orderBy((0, import_drizzle_orm21.asc)(schema_exports.echeances.echeanceLe)) : [];
  const echeancesParDossier = /* @__PURE__ */ new Map();
  for (const e of echeances2) {
    const liste = echeancesParDossier.get(e.dossierId) ?? [];
    liste.push(e);
    echeancesParDossier.set(e.dossierId, liste);
  }
  const demandeIds = lignesBrutes.map((l) => l.demande.id);
  const derniers = demandeIds.length ? await db.select({ demandeId: schema_exports.evenements.demandeId, resume: schema_exports.evenements.resume, survenuLe: schema_exports.evenements.survenuLe }).from(schema_exports.evenements).where((0, import_drizzle_orm21.and)((0, import_drizzle_orm21.inArray)(schema_exports.evenements.demandeId, demandeIds), (0, import_drizzle_orm21.eq)(schema_exports.evenements.nature, "demande_validation_do"))).orderBy((0, import_drizzle_orm21.asc)(schema_exports.evenements.survenuLe)) : [];
  const derniereParDemande = /* @__PURE__ */ new Map();
  for (const d of derniers) if (d.demandeId !== null) derniereParDemande.set(d.demandeId, d.resume);
  const lignes = lignesBrutes.map((l) => {
    const temps = tempsDemandeAvecHoraires(l.demande, debuts.get(l.demande.id) ?? l.demande.ouverteLe, horaires, maintenant);
    return {
      demandeId: l.demande.id,
      dossierId: l.dossier.id,
      dossier: l.dossier.libelle,
      client: l.dossier.client,
      famille: l.demande.famille,
      objet: l.demande.objet,
      decisionAttendue: decisionAttendue(l.demande.famille, l.demande.objet),
      minutesAttente: temps.statutCourant,
      attenteLisible: formaterDuree(temps.statutCourant),
      urgent: temps.statutCourant >= seuilMinutes,
      elements: elementsDeDecision(
        l.dossier.references ?? {},
        l.dossier.montantsApprouves ?? {},
        echeancesParDossier.get(l.dossier.id) ?? []
      ),
      derniereDemande: derniereParDemande.get(l.demande.id) ?? null
    };
  });
  lignes.sort((a, b) => b.minutesAttente - a.minutesAttente);
  const dt = import_luxon5.DateTime.fromJSDate(maintenant).setLocale("fr");
  const moment = dt.hour < 13 ? "matin" : "apres-midi";
  return {
    compteId,
    compte: compte.nom,
    donneurOrdre: compte.donneurOrdreNom,
    genereLe: maintenant.toISOString(),
    moment,
    lignes,
    brouillon: redigerBrouillon({ compte: compte.nom, donneurOrdre: compte.donneurOrdreNom, lignes, dt })
  };
}
function redigerBrouillon(donnees) {
  const { donneurOrdre, lignes, dt } = donnees;
  const date2 = dt.toFormat("cccc d LLLL yyyy");
  const entete = `Bonjour${donneurOrdre ? ` ${donneurOrdre}` : ""},`;
  if (!lignes.length) {
    return retirerTiretsLongs(
      [entete, "", `Point du ${date2} : aucune decision n'est en attente de votre part a cette heure.`, "", "Bien cordialement,"].join("\n")
    );
  }
  const corps = lignes.map((l, i) => {
    const morceaux = [`${i + 1}. ${l.decisionAttendue}`];
    morceaux.push(`   Dossier : ${l.dossier}`);
    morceaux.push(`   En attente depuis : ${l.attenteLisible} (heures ouvrees)${l.urgent ? ", au-dela du delai habituel" : ""}`);
    if (l.derniereDemande) morceaux.push(`   Point de situation : ${l.derniereDemande}`);
    if (l.elements.length) morceaux.push(`   Elements : ${l.elements.map((e) => `${e.libelle} ${e.valeur}`).join(" ; ")}`);
    return morceaux.join("\n");
  });
  const urgentes = lignes.filter((l) => l.urgent).length;
  const resume = lignes.length === 1 ? "Une decision attend votre retour." : `${lignes.length} decisions attendent votre retour${urgentes ? `, dont ${urgentes} depuis plus longtemps que d'habitude` : ""}.`;
  return retirerTiretsLongs(
    [entete, "", `Point du ${date2}. ${resume}`, "", ...corps, "", "Merci de votre retour.", "Bien cordialement,"].join("\n")
  );
}
async function debutsDeStatut2(demandes2) {
  if (!demandes2.length) return /* @__PURE__ */ new Map();
  const lignes = await db.select({ demandeId: schema_exports.transitionsStatut.demandeId, debut: import_drizzle_orm21.sql`max(${schema_exports.transitionsStatut.survenuLe})`.as("debut") }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm21.inArray)(schema_exports.transitionsStatut.demandeId, demandes2.map((d) => d.id))).groupBy(schema_exports.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}

// src/server/modules/qualite/routes.ts
var semaineSchema = import_zod10.z.string().regex(/^\d{4}-W\d{2}$/, "Semaine attendue au format AAAA-Www");
var routesQualite = (0, import_express8.Router)();
routesQualite.use(exigerConnexion);
routesQualite.get("/checklists/:demandeId", async (req, res) => {
  const demandeId = idParam(req, "demandeId");
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm22.eq)(schema_exports.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  res.json({
    checklists: await checklistsPourFamille(demande.famille, demande.compteId),
    controles: await controlesEnvoiDeLaDemande(demandeId)
  });
});
routesQualite.post("/controle-envoi", exigerEcriture, async (req, res) => {
  const d = valider(
    import_zod10.z.object({
      demandeId: import_zod10.z.number().int().positive(),
      checklistId: import_zod10.z.number().int().positive(),
      reponses: import_zod10.z.record(import_zod10.z.string(), import_zod10.z.boolean()),
      commentaire: import_zod10.z.string().trim().max(1e3).nullish(),
      evenementId: import_zod10.z.number().int().positive().nullish()
    }),
    req.body
  );
  const [demande] = await db.select({ compteId: schema_exports.demandes.compteId }).from(schema_exports.demandes).where((0, import_drizzle_orm22.eq)(schema_exports.demandes.id, d.demandeId));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), demande.compteId);
  res.status(201).json(await enregistrerControleEnvoi(d, auteurDe(req)));
});
routesQualite.get("/echantillon", async (req, res) => {
  const q = valider(
    import_zod10.z.object({ semaine: semaineSchema.optional(), compteId: import_zod10.z.coerce.number().int().positive().optional() }),
    req.query
  );
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  const semaine = q.semaine ?? cleSemaine(/* @__PURE__ */ new Date());
  const controles = await controlesDeLaSemaine(semaine, q.compteId);
  res.json({
    semaine,
    controles: p.comptes === null ? controles : controles.filter((c) => p.comptes.includes(c.demande.compteId))
  });
});
routesQualite.post("/echantillon", exigerRole("admin", "manager"), async (req, res) => {
  const d = valider(
    import_zod10.z.object({
      semaine: semaineSchema.optional(),
      compteId: import_zod10.z.number().int().positive(),
      taux: import_zod10.z.number().min(0).max(1).optional(),
      grilleId: import_zod10.z.number().int().positive().optional()
    }),
    req.body
  );
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const semaine = d.semaine ?? cleSemaine(/* @__PURE__ */ new Date());
  res.status(201).json(await tirerEchantillon(semaine, { compteId: d.compteId, taux: d.taux, grilleId: d.grilleId }, auteurDe(req)));
});
routesQualite.post("/controle/:id/note", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const d = valider(
    import_zod10.z.object({
      notes: import_zod10.z.record(import_zod10.z.string(), import_zod10.z.number().min(0).max(100)),
      reprise: import_zod10.z.boolean().optional(),
      bonDuPremierCoup: import_zod10.z.boolean().nullish(),
      commentaire: import_zod10.z.string().trim().max(1e3).nullish()
    }),
    req.body
  );
  const [ligne] = await db.select({ compteId: schema_exports.demandes.compteId }).from(schema_exports.controlesQualite).innerJoin(schema_exports.demandes, (0, import_drizzle_orm22.eq)(schema_exports.demandes.id, schema_exports.controlesQualite.demandeId)).where((0, import_drizzle_orm22.eq)(schema_exports.controlesQualite.id, id2));
  if (!ligne) throw new ErreurHttp(404, "Controle qualite introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), ligne.compteId);
  res.json(await noterControle(id2, d, auteurDe(req)));
});
routesQualite.get("/indicateurs", async (req, res) => {
  const q = valider(
    import_zod10.z.object({ compteId: import_zod10.z.coerce.number().int().positive().optional(), jours: import_zod10.z.coerce.number().int().min(1).max(365).optional() }),
    req.query
  );
  const p = await perimetreDe(req.utilisateur);
  if (q.compteId) exigerCompte(p, q.compteId);
  const jours = q.jours ?? 30;
  const fin = /* @__PURE__ */ new Date();
  const debut = new Date(fin.getTime() - jours * 864e5);
  res.json(await indicateursQualite({ debut, fin }, { compteId: q.compteId }));
});
routesQualite.get("/grilles", async (_req, res) => {
  res.json(await db.select().from(schema_exports.grillesQualite).where((0, import_drizzle_orm22.eq)(schema_exports.grillesQualite.actif, true)));
});
var routesDigest = (0, import_express8.Router)();
routesDigest.use(exigerConnexion);
routesDigest.get("/validation-do", async (req, res) => {
  const q = valider(import_zod10.z.object({ compteId: import_zod10.z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur), q.compteId);
  res.json(await construireDigest(q.compteId));
});

// src/server/modules/export/routes.ts
var import_express9 = require("express");
var import_multer2 = __toESM(require("multer"));
var import_zod11 = require("zod");
init_config();
init_http();

// src/server/modules/export/service.ts
var import_drizzle_orm23 = require("drizzle-orm");
var import_luxon6 = require("luxon");
init_client();
init_http();
init_evenements();

// src/server/lib/xlsx/ecriture-zip.ts
var import_node_zlib2 = __toESM(require("node:zlib"));
var TABLE_CRC = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let c = 4294967295;
  for (let i = 0; i < buffer.length; i++) c = TABLE_CRC[(c ^ buffer[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
var DATE_DOS_DEFAUT = 33;
var HEURE_DOS_DEFAUT = 0;
function ecrireZip(entrees) {
  const locaux = [];
  const central = [];
  let offset = 0;
  for (const e of entrees) {
    const nom = Buffer.from(e.nom, "utf8");
    const compresse = import_node_zlib2.default.deflateRawSync(e.contenu, { level: 6 });
    const gagne = compresse.length < e.contenu.length;
    const donnees = gagne ? compresse : e.contenu;
    const methode = gagne ? 8 : 0;
    const crc = crc32(e.contenu);
    const heure2 = e.dateHeureDos ?? HEURE_DOS_DEFAUT;
    const date2 = e.dateDos ?? DATE_DOS_DEFAUT;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(methode, 8);
    local.writeUInt16LE(heure2, 10);
    local.writeUInt16LE(date2, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(e.contenu.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    locaux.push(local, nom, donnees);
    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(33639248, 0);
    entree.writeUInt16LE(20, 4);
    entree.writeUInt16LE(20, 6);
    entree.writeUInt16LE(2048, 8);
    entree.writeUInt16LE(methode, 10);
    entree.writeUInt16LE(heure2, 12);
    entree.writeUInt16LE(date2, 14);
    entree.writeUInt32LE(crc, 16);
    entree.writeUInt32LE(donnees.length, 20);
    entree.writeUInt32LE(e.contenu.length, 24);
    entree.writeUInt16LE(nom.length, 28);
    entree.writeUInt16LE(0, 30);
    entree.writeUInt16LE(0, 32);
    entree.writeUInt16LE(0, 34);
    entree.writeUInt16LE(0, 36);
    entree.writeUInt32LE(0, 38);
    entree.writeUInt32LE(offset, 42);
    central.push(entree, nom);
    offset += local.length + nom.length + donnees.length;
  }
  const repertoire = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(101010256, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20);
  return Buffer.concat([...locaux, repertoire, fin]);
}

// src/server/lib/xlsx/ecriture.ts
var SIGNATURE_CHAINES = "xl/sharedStrings.xml";
var ClasseurModifiable = class {
  entrees;
  chaines;
  indexChaines;
  chainesModifiees = false;
  /** Feuilles reecrites, par chemin dans l'archive. */
  feuilles = /* @__PURE__ */ new Map();
  cheminsParNom = /* @__PURE__ */ new Map();
  constructor(buffer) {
    this.entrees = lireZip(buffer);
    this.chaines = this.lireChaines();
    this.indexChaines = new Map(this.chaines.map((c, i) => [c, i]));
    for (const { nom, chemin } of this.lireOnglets()) this.cheminsParNom.set(nom.trim().toLowerCase(), chemin);
  }
  /** Noms des onglets, dans l'ordre du classeur. */
  nomsOnglets() {
    return this.lireOnglets().map((o) => o.nom);
  }
  lireOnglets() {
    const classeur = this.entrees.get("xl/workbook.xml");
    if (!classeur) throw new Error("Classeur invalide : xl/workbook.xml absent");
    const relations = this.entrees.get("xl/_rels/workbook.xml.rels");
    const cibles = /* @__PURE__ */ new Map();
    if (relations) {
      const xml2 = relations.contenu.toString("utf8");
      const motif2 = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g;
      let m2;
      while (m2 = motif2.exec(xml2)) {
        const cible = m2[2].startsWith("/") ? m2[2].slice(1) : `xl/${m2[2].replace(/^\.\//, "")}`;
        cibles.set(m2[1], cible);
      }
    }
    const xml = classeur.contenu.toString("utf8");
    const sortie = [];
    const motif = /<sheet\b([^>]*)\/?>/g;
    let m;
    let indice = 0;
    while (m = motif.exec(xml)) {
      const nom = /\bname="([^"]*)"/.exec(m[1])?.[1];
      if (nom === void 0) continue;
      indice++;
      const idRelation = /\br:id="([^"]*)"/.exec(m[1])?.[1];
      sortie.push({ nom, chemin: idRelation && cibles.get(idRelation) || `xl/worksheets/sheet${indice}.xml` });
    }
    return sortie;
  }
  lireChaines() {
    const partie = this.entrees.get(SIGNATURE_CHAINES);
    if (!partie) return [];
    const xml = partie.contenu.toString("utf8");
    const chaines = [];
    const motif = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
    let m;
    while (m = motif.exec(xml)) {
      if (m[1] === void 0) {
        chaines.push("");
        continue;
      }
      let texte2 = "";
      const motifT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
      let x;
      while (x = motifT.exec(m[1])) texte2 += decoderEntites(x[1] ?? "");
      chaines.push(texte2);
    }
    return chaines;
  }
  /** Index d'une chaine dans la table partagee, ajoutee si elle n'y est pas encore. */
  indexChaine(texte2) {
    const deja = this.indexChaines.get(texte2);
    if (deja !== void 0) return deja;
    const indice = this.chaines.length;
    this.chaines.push(texte2);
    this.indexChaines.set(texte2, indice);
    this.chainesModifiees = true;
    return indice;
  }
  cheminOnglet(nom) {
    const chemin = this.cheminsParNom.get(nom.trim().toLowerCase());
    if (!chemin) throw new Error(`Onglet \xAB ${nom} \xBB absent du classeur. Onglets presents : ${this.nomsOnglets().join(", ")}`);
    return chemin;
  }
  feuille(nom) {
    const chemin = this.cheminOnglet(nom);
    const deja = this.feuilles.get(chemin);
    if (deja !== void 0) return deja;
    const partie = this.entrees.get(chemin);
    if (!partie) throw new Error(`Feuille introuvable dans l'archive : ${chemin}`);
    const xml = partie.contenu.toString("utf8");
    this.feuilles.set(chemin, xml);
    return xml;
  }
  ecrireFeuille(nom, xml) {
    this.feuilles.set(this.cheminOnglet(nom), xml);
  }
  /** Numero de la derniere ligne portant des donnees. */
  derniereLigne(nom) {
    const xml = this.feuille(nom);
    let max = 0;
    const motif = /<row\b[^>]*\br="(\d+)"/g;
    let m;
    while (m = motif.exec(xml)) max = Math.max(max, Number(m[1]));
    return max;
  }
  /** Styles de chaque colonne d'une ligne existante, pour servir de modele. */
  stylesDeLaLigne(nom, ligne) {
    const sortie = /* @__PURE__ */ new Map();
    const brut = this.extraireLigne(this.feuille(nom), ligne);
    if (!brut) return sortie;
    const motif = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
    let m;
    while (m = motif.exec(brut)) {
      const ref2 = /\br="([A-Z]+\d+)"/.exec(m[1])?.[1];
      const style = /\bs="(\d+)"/.exec(m[1])?.[1];
      if (ref2 && style) sortie.set(decoderRef(ref2).colonne, style);
    }
    return sortie;
  }
  /** Le fragment XML complet d'une ligne, ou null si elle n'existe pas. */
  extraireLigne(xml, ligne) {
    const motif = new RegExp(`<row\\b[^>]*\\br="${ligne}"[^>]*(?:/>|>[\\s\\S]*?</row>)`, "");
    return motif.exec(xml)?.[0] ?? null;
  }
  /** Vrai si la cellule porte une formule : on ne l'ecrase jamais. */
  porteUneFormule(nom, ref2) {
    const { ligne } = decoderRef(ref2);
    const brut = this.extraireLigne(this.feuille(nom), ligne);
    if (!brut) return false;
    const motif = new RegExp(`<c\\b[^>]*\\br="${ref2}"[^>]*>([\\s\\S]*?)</c>`, "");
    const corps = motif.exec(brut)?.[1];
    return Boolean(corps && /<f[\s>/]/.test(corps));
  }
  /** Construit le XML d'une cellule, en conservant les attributs fournis. */
  xmlCellule(ref2, valeur2, style) {
    const attributs = [`r="${ref2}"`];
    if (style !== void 0) attributs.push(`s="${style}"`);
    if (valeur2 === null || valeur2 === "") return `<c ${attributs.join(" ")}/>`;
    if (typeof valeur2 === "number") {
      if (!Number.isFinite(valeur2)) throw new Error(`Valeur numerique invalide pour ${ref2}`);
      return `<c ${attributs.join(" ")}><v>${valeur2}</v></c>`;
    }
    attributs.push('t="s"');
    return `<c ${attributs.join(" ")}><v>${this.indexChaine(valeur2)}</v></c>`;
  }
  /**
   * Ecrit une valeur dans une cellule existante ou absente, sans toucher a sa mise en forme.
   * Une cellule qui porte une formule est refusee : l'ecraser detruirait le calcul du classeur.
   */
  definirCellule(nom, colonne, ligne, valeur2) {
    const ref2 = `${lettreColonne(colonne)}${ligne}`;
    if (this.porteUneFormule(nom, ref2)) {
      throw new Error(`La cellule ${ref2} de l'onglet \xAB ${nom} \xBB porte une formule : l'export ne l'ecrase pas`);
    }
    let xml = this.feuille(nom);
    const brutLigne = this.extraireLigne(xml, ligne);
    if (!brutLigne) {
      const nouvelle = `<row r="${ligne}">${this.xmlCellule(ref2, valeur2)}</row>`;
      this.ecrireFeuille(nom, this.insererLigne(xml, ligne, nouvelle));
      return;
    }
    const motifCellule = new RegExp(`<c\\b[^>]*\\br="${ref2}"[^>]*(?:/>|>[\\s\\S]*?</c>)`, "");
    const celluleExistante = motifCellule.exec(brutLigne)?.[0];
    let nouvelleLigne;
    if (celluleExistante) {
      const style = /\bs="(\d+)"/.exec(celluleExistante)?.[1];
      nouvelleLigne = brutLigne.replace(motifCellule, this.xmlCellule(ref2, valeur2, style));
    } else {
      nouvelleLigne = this.insererCellule(brutLigne, colonne, this.xmlCellule(ref2, valeur2));
    }
    xml = xml.replace(brutLigne, nouvelleLigne);
    this.ecrireFeuille(nom, xml);
  }
  /** Insere une cellule dans une ligne, en respectant l'ordre croissant des colonnes. */
  insererCellule(brutLigne, colonne, xmlCellule) {
    const motif = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
    let m;
    let position = -1;
    while (m = motif.exec(brutLigne)) {
      const ref2 = /\br="([A-Z]+\d+)"/.exec(m[1])?.[1];
      if (ref2 && decoderRef(ref2).colonne > colonne) {
        position = m.index;
        break;
      }
    }
    if (position >= 0) return `${brutLigne.slice(0, position)}${xmlCellule}${brutLigne.slice(position)}`;
    if (/\/>\s*$/.test(brutLigne)) return `${brutLigne.replace(/\/>\s*$/, ">")}${xmlCellule}</row>`;
    return brutLigne.replace(/<\/row>\s*$/, `${xmlCellule}</row>`);
  }
  /** Insere une ligne entiere a sa place dans `sheetData`. */
  insererLigne(xml, ligne, xmlLigne) {
    const motif = /<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g;
    let m;
    while (m = motif.exec(xml)) {
      if (Number(m[1]) > ligne) return `${xml.slice(0, m.index)}${xmlLigne}${xml.slice(m.index)}`;
    }
    if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, `<sheetData>${xmlLigne}</sheetData>`);
    return xml.replace(/<\/sheetData>/, `${xmlLigne}</sheetData>`);
  }
  /** Ajoute des lignes a la suite de la derniere ligne existante. */
  ajouterLignes(nom, lignes) {
    if (!lignes.length) return this.derniereLigne(nom);
    let numero = this.derniereLigne(nom);
    const fragments = [];
    for (const l of lignes) {
      numero++;
      const styles = l.ligneModele ? this.stylesDeLaLigne(nom, l.ligneModele) : /* @__PURE__ */ new Map();
      const cellules = [...l.cellules].sort((a, b) => a.colonne - b.colonne).map((c) => this.xmlCellule(`${lettreColonne(c.colonne)}${numero}`, c.valeur, styles.get(c.colonne))).join("");
      fragments.push(cellules ? `<row r="${numero}">${cellules}</row>` : `<row r="${numero}"/>`);
    }
    let xml = this.feuille(nom);
    xml = /<sheetData\s*\/>/.test(xml) ? xml.replace(/<sheetData\s*\/>/, `<sheetData>${fragments.join("")}</sheetData>`) : xml.replace(/<\/sheetData>/, `${fragments.join("")}</sheetData>`);
    this.ecrireFeuille(nom, this.majDimension(xml, numero));
    return numero;
  }
  /** Met a jour la plage declaree de la feuille, si elle est presente. */
  majDimension(xml, derniereLigne) {
    return xml.replace(/<dimension\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/, (tout, c1, l1, c2, l2) => {
      const fin = Math.max(Number(l2), derniereLigne);
      return fin === Number(l2) ? tout : `<dimension ref="${c1}${l1}:${c2}${fin}"/>`;
    });
  }
  /** Reconstitue l'archive : seules les parties modifiees sont reecrites. */
  versBuffer() {
    const sortie = [];
    for (const [nom, entree] of this.entrees) {
      let contenu = entree.contenu;
      if (this.feuilles.has(nom)) contenu = Buffer.from(this.feuilles.get(nom), "utf8");
      else if (nom === SIGNATURE_CHAINES && this.chainesModifiees) contenu = Buffer.from(this.xmlChaines(), "utf8");
      sortie.push({ nom, contenu, dateHeureDos: entree.dateHeureDos, dateDos: entree.dateDos });
    }
    if (this.chainesModifiees && !this.entrees.has(SIGNATURE_CHAINES)) {
      throw new Error(
        "Ce classeur n'a pas de table de chaines partagees. Fournissez un classeur produit par Excel ou LibreOffice, qui en contient toujours une."
      );
    }
    return ecrireZip(sortie);
  }
  xmlChaines() {
    const entrees = this.chaines.map((c) => `<si><t xml:space="preserve">${encoderXml(c)}</t></si>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.chaines.length}" uniqueCount="${this.chaines.length}">${entrees}</sst>`;
  }
};
var ENTITES2 = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decoderEntites(texte2) {
  return texte2.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (tout, code) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES2[code] ?? tout;
  });
}

// src/server/modules/export/service.ts
init_tirets();
init_constantes();
var ONGLET_SUIVI = "Suivi Quotidien";
var COL = { date: 1, client: 3, produit: 6, description: 7, livrables: 8, priorite: 9 };
function numeroOngletSemaine(semaineIso, annee) {
  return annee === 2026 ? semaineIso - 26 : semaineIso;
}
function nomOngletSemaine(semaineIso, annee) {
  return `sem ${numeroOngletSemaine(semaineIso, annee)}`;
}
async function construireBlocJour(compteId, jour) {
  const debut = import_luxon6.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon6.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const conditions = [
    (0, import_drizzle_orm23.eq)(schema_exports.demandes.compteId, compteId),
    import_drizzle_orm23.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
    // Toute demande qui a bouge dans la journee, ou qui reste ouverte apres y etre entree.
    import_drizzle_orm23.sql`(
      (${schema_exports.demandes.dernierEvenementLe} >= ${debut} AND ${schema_exports.demandes.dernierEvenementLe} < ${fin})
      OR (${schema_exports.demandes.ouverteLe} < ${fin} AND ${schema_exports.demandes.statut} NOT IN ('termine', 'annule'))
    )`
  ];
  const demandes2 = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm23.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where((0, import_drizzle_orm23.and)(...conditions)).orderBy((0, import_drizzle_orm23.asc)(schema_exports.dossiers.client), (0, import_drizzle_orm23.asc)(schema_exports.demandes.ouverteLe));
  const parDossier = /* @__PURE__ */ new Map();
  for (const l of demandes2) {
    const deja = parDossier.get(l.dossier.id) ?? { dossier: l.dossier, demandes: [] };
    deja.demandes.push(l.demande);
    parDossier.set(l.dossier.id, deja);
  }
  const demandeIds = demandes2.map((l) => l.demande.id);
  const evenements2 = demandeIds.length ? await db.select({ demandeId: schema_exports.evenements.demandeId, resume: schema_exports.evenements.resume, objet: schema_exports.evenements.objet, survenuLe: schema_exports.evenements.survenuLe }).from(schema_exports.evenements).where((0, import_drizzle_orm23.and)((0, import_drizzle_orm23.inArray)(schema_exports.evenements.demandeId, demandeIds), (0, import_drizzle_orm23.gte)(schema_exports.evenements.survenuLe, debut), (0, import_drizzle_orm23.lt)(schema_exports.evenements.survenuLe, fin))).orderBy((0, import_drizzle_orm23.asc)(schema_exports.evenements.survenuLe)) : [];
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
function nettoyerPhrase(texte2) {
  return texte2.replace(/\s+/g, " ").replace(/\s*\.\s*$/, "").trim();
}
function ecrireBlocJour(classeur, bloc, modele) {
  const dateTexte = import_luxon6.DateTime.fromISO(bloc.jour).toFormat("dd/MM/yyyy");
  const lignes = [{ cellules: [] }];
  lignes.push({
    cellules: modele.entetes.map((texte2, i) => ({ colonne: i + 1, valeur: texte2 })),
    ligneModele: modele.ligneEntete
  });
  bloc.lignes.forEach((l, rang) => {
    lignes.push({
      // B, D et E restent vides : elles ne sont pas ecrites du tout.
      cellules: [
        { colonne: COL.date, valeur: rang === 0 ? dateTexte : null },
        { colonne: COL.client, valeur: l.client },
        { colonne: COL.produit, valeur: l.produit },
        { colonne: COL.description, valeur: l.description },
        { colonne: COL.livrables, valeur: l.livrables || null },
        { colonne: COL.priorite, valeur: l.prioriteLendemain || null }
      ],
      ligneModele: modele.ligneDonnees
    });
  });
  classeur.ajouterLignes(ONGLET_SUIVI, lignes);
}
function repererModele(buffer) {
  const classeur = lireClasseur(buffer);
  const onglet = ongletNomme(classeur, ONGLET_SUIVI);
  if (!onglet) {
    throw new ErreurHttp(400, `Onglet \xAB ${ONGLET_SUIVI} \xBB absent du classeur. Onglets trouves : ${classeur.onglets.map((o) => o.nom).join(", ") || "aucun"}`);
  }
  let ligneEntete = 0;
  let ligneDonnees = 0;
  let entetes = [];
  for (let n = 1; n <= onglet.derniereLigne; n++) {
    const cellules = onglet.lignes.get(n);
    if (!cellules?.length) continue;
    const a = valeur(cellules, COL.date).toLowerCase();
    const g = valeur(cellules, COL.description).toLowerCase();
    const estEntete = a.startsWith("date") || g.includes("description") || g.includes("travaux") || g.includes("taches");
    if (estEntete) {
      ligneEntete = n;
      const largeur = Math.max(...cellules.map((c) => c.colonne));
      entetes = Array.from({ length: largeur }, (_, i) => valeur(cellules, i + 1));
    } else if (ligneEntete && valeur(cellules, COL.client)) {
      ligneDonnees = n;
    }
  }
  if (!ligneEntete) throw new ErreurHttp(400, `Aucune ligne d'en-tete reperee dans l'onglet \xAB ${ONGLET_SUIVI} \xBB`);
  return { entetes, ligneEntete, ligneDonnees: ligneDonnees || ligneEntete + 1 };
}
var LIGNES_SEMAINE = {
  nouveauxLeads: 4,
  dossiersTraites: 5,
  documentsEmis: 6,
  relancesEnvoyees: 7,
  // Lignes 8 a 11 : laissees vides, l'export n'y touche pas.
  validationsObtenues: 12,
  faitsMarquants: 13,
  expeditionsParties: 14,
  pointsVigilance: 15,
  actionsSemaineSuivante: 16,
  appuiDemande: 17,
  pointsBloquants: 18
};
var MOTIFS_REFERENCE = [
  /\bBL\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bAWB\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bPFI\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bbooking\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bcommande\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\b(?:facture|proforma)\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi
];
function retirerReferences(texte2) {
  let sortie = texte2;
  for (const motif of MOTIFS_REFERENCE) sortie = sortie.replace(motif, (m) => m.split(/[\s:-]/)[0]);
  return sortie.replace(/\s{2,}/g, " ").trim();
}
async function construireColonneSemaine(compteId, jour) {
  const debut = import_luxon6.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon6.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const horsPerimetre = import_drizzle_orm23.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`;
  const [nouveaux] = await db.select({ n: import_drizzle_orm23.sql`count(*)::int` }).from(schema_exports.demandes).where((0, import_drizzle_orm23.and)((0, import_drizzle_orm23.eq)(schema_exports.demandes.compteId, compteId), horsPerimetre, (0, import_drizzle_orm23.eq)(schema_exports.demandes.famille, "T08"), (0, import_drizzle_orm23.gte)(schema_exports.demandes.ouverteLe, debut), (0, import_drizzle_orm23.lt)(schema_exports.demandes.ouverteLe, fin)));
  const [traites] = await db.select({ n: import_drizzle_orm23.sql`count(*)::int` }).from(schema_exports.demandes).where((0, import_drizzle_orm23.and)((0, import_drizzle_orm23.eq)(schema_exports.demandes.compteId, compteId), horsPerimetre, import_drizzle_orm23.sql`${schema_exports.demandes.termineeLe} IS NOT NULL`, (0, import_drizzle_orm23.gte)(schema_exports.demandes.termineeLe, debut), (0, import_drizzle_orm23.lt)(schema_exports.demandes.termineeLe, fin)));
  const parNature = await db.select({ nature: schema_exports.evenements.nature, n: import_drizzle_orm23.sql`count(*)::int` }).from(schema_exports.evenements).innerJoin(schema_exports.demandes, (0, import_drizzle_orm23.eq)(schema_exports.demandes.id, schema_exports.evenements.demandeId)).where((0, import_drizzle_orm23.and)((0, import_drizzle_orm23.eq)(schema_exports.evenements.compteId, compteId), horsPerimetre, (0, import_drizzle_orm23.gte)(schema_exports.evenements.survenuLe, debut), (0, import_drizzle_orm23.lt)(schema_exports.evenements.survenuLe, fin))).groupBy(schema_exports.evenements.nature);
  const compte = (nature) => parNature.find((p) => p.nature === nature)?.n ?? 0;
  const [expeditions] = await db.select({ n: import_drizzle_orm23.sql`count(*)::int` }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm23.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where((0, import_drizzle_orm23.and)((0, import_drizzle_orm23.eq)(schema_exports.dossiers.compteId, compteId), (0, import_drizzle_orm23.eq)(schema_exports.echeances.type, "etd"), (0, import_drizzle_orm23.gte)(schema_exports.echeances.echeanceLe, debut), (0, import_drizzle_orm23.lt)(schema_exports.echeances.echeanceLe, fin)));
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
function ecrireColonneSemaine(classeur, onglet, colonne, donnees) {
  const ecrire2 = (ligne, valeur2) => classeur.definirCellule(onglet, colonne, ligne, valeur2);
  ecrire2(LIGNES_SEMAINE.nouveauxLeads, donnees.nouveauxLeads);
  ecrire2(LIGNES_SEMAINE.dossiersTraites, donnees.dossiersTraites);
  ecrire2(LIGNES_SEMAINE.documentsEmis, donnees.documentsEmis);
  ecrire2(LIGNES_SEMAINE.relancesEnvoyees, donnees.relancesEnvoyees);
  ecrire2(LIGNES_SEMAINE.validationsObtenues, donnees.validationsObtenues);
  ecrire2(LIGNES_SEMAINE.expeditionsParties, donnees.expeditionsParties);
  ecrire2(LIGNES_SEMAINE.faitsMarquants, donnees.faitsMarquants || null);
  ecrire2(LIGNES_SEMAINE.pointsVigilance, donnees.pointsVigilance || null);
  ecrire2(LIGNES_SEMAINE.actionsSemaineSuivante, donnees.actionsSemaineSuivante || null);
  ecrire2(LIGNES_SEMAINE.appuiDemande, donnees.appuiDemande || null);
  ecrire2(LIGNES_SEMAINE.pointsBloquants, donnees.pointsBloquants || null);
}
async function exporterReporting(buffer, options, auteur) {
  if (!options.jours.length) throw new ErreurHttp(400, "Indiquez au moins un jour a exporter");
  const modele = repererModele(buffer);
  const classeur = new ClasseurModifiable(buffer);
  let lignesEcrites = 0;
  const joursEcrits = [];
  for (const jour of [...options.jours].sort()) {
    const bloc = await construireBlocJour(options.compteId, jour);
    if (!bloc.lignes.length) continue;
    ecrireBlocJour(classeur, bloc, modele);
    lignesEcrites += bloc.lignes.length;
    joursEcrits.push(jour);
  }
  let nomSemaine = null;
  let colonnesSemaine = 0;
  if (options.ongletSemaine && joursEcrits.length) {
    const premier = import_luxon6.DateTime.fromISO(joursEcrits[0]);
    const candidat = nomOngletSemaine(premier.weekNumber, premier.weekYear);
    const present = classeur.nomsOnglets().find((n) => n.trim().toLowerCase() === candidat.toLowerCase());
    if (!present) {
      throw new ErreurHttp(
        400,
        `Onglet \xAB ${candidat} \xBB absent du classeur. Onglets presents : ${classeur.nomsOnglets().join(", ")}. Verifiez la plage de dates de l'en-tete.`
      );
    }
    nomSemaine = present;
    for (let jourSemaine = 1; jourSemaine <= 5; jourSemaine++) {
      const jour = premier.set({ weekday: jourSemaine }).toISODate();
      if (!joursEcrits.includes(jour)) continue;
      ecrireColonneSemaine(classeur, present, jourSemaine + 1, await construireColonneSemaine(options.compteId, jour));
      colonnesSemaine++;
    }
  }
  const fichier = classeur.versBuffer();
  const bilan = {
    joursEcrits,
    lignesEcrites,
    ongletSemaine: nomSemaine,
    coloneesSemaine: colonnesSemaine,
    onglets: classeur.nomsOnglets()
  };
  await journaliser("reporting_exporte", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "compte",
    entiteId: options.compteId,
    details: { ...bilan }
  });
  return { fichier, bilan };
}

// src/server/modules/export/routes.ts
var envoi2 = (0, import_multer2.default)({
  storage: import_multer2.default.memoryStorage(),
  limits: { fileSize: config.tailleMaxImportOctets, files: 1 },
  fileFilter: (_req, fichier, callback) => {
    if (!/\.xlsx$/i.test(fichier.originalname)) return callback(new ErreurHttp(400, "Seuls les classeurs .xlsx sont acceptes"));
    callback(null, true);
  }
});
var jourSchema = import_zod11.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Jour attendu au format AAAA-MM-JJ");
var routesExport = (0, import_express9.Router)();
routesExport.use(exigerConnexion);
routesExport.get("/apercu", async (req, res) => {
  const q = valider(import_zod11.z.object({ compteId: import_zod11.z.coerce.number().int().positive(), jour: jourSchema }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur), q.compteId);
  res.json(await construireBlocJour(q.compteId, q.jour));
});
routesExport.post("/reporting", exigerRole("admin", "manager"), envoi2.single("fichier"), async (req, res) => {
  if (!req.file) throw new ErreurHttp(400, "Aucun classeur recu (champ \xAB fichier \xBB attendu)");
  const d = valider(
    import_zod11.z.object({
      compteId: import_zod11.z.coerce.number().int().positive(),
      jours: import_zod11.z.string().min(10),
      ongletSemaine: import_zod11.z.enum(["0", "1", "true", "false"]).optional()
    }),
    req.body
  );
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const jours = d.jours.split(",").map((j) => j.trim()).filter(Boolean);
  for (const j of jours) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j)) throw new ErreurHttp(400, `Jour invalide : ${j}. Format attendu AAAA-MM-JJ.`);
  }
  const { fichier, bilan } = await exporterReporting(
    req.file.buffer,
    { compteId: d.compteId, jours, ongletSemaine: d.ongletSemaine === "1" || d.ongletSemaine === "true" },
    auteurDe(req)
  );
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("content-disposition", `attachment; filename="${req.file.originalname.replace(/\.xlsx$/i, "")}-complete.xlsx"`);
  res.setHeader("x-bilan-export", encodeURIComponent(JSON.stringify(bilan)));
  res.send(fichier);
});

// src/server/lib/migrations.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
init_config();
init_client();
var journal2 = null;
function lireJournal() {
  if (journal2) return journal2;
  const chemin = import_node_path2.default.join(config.racine, "drizzle", "meta", "_journal.json");
  const brut = JSON.parse(import_node_fs.default.readFileSync(chemin, "utf8"));
  journal2 = (brut.entries ?? []).map((e) => ({ when: Number(e.when), tag: String(e.tag) }));
  return journal2;
}
async function etatMigrations() {
  let attendues = 0;
  try {
    const entrees = lireJournal();
    attendues = entrees.length;
    const { rows } = await getPool().query(
      "SELECT count(*)::text AS total, max(created_at)::text AS dernier FROM drizzle.__drizzle_migrations"
    );
    const appliquees = Number(rows[0]?.total ?? 0);
    const dernier = rows[0]?.dernier ? Number(rows[0].dernier) : null;
    return {
      attendues,
      appliquees,
      derniere: entrees.find((e) => e.when === dernier)?.tag ?? null,
      aJour: appliquees >= attendues
    };
  } catch (e) {
    return { attendues, appliquees: 0, derniere: null, aJour: false, erreur: e.message.slice(0, 120) };
  }
}

// src/server/modules/mcp/routes.ts
var import_express10 = __toESM(require("express"));
var import_express_rate_limit2 = __toESM(require("express-rate-limit"));
init_config();
init_securite();
init_journal();

// src/server/modules/mcp/service.ts
var import_drizzle_orm24 = require("drizzle-orm");
var import_luxon7 = require("luxon");
init_client();
init_config();
init_parametres2();
init_constantes();
init_heures_ouvrees();
var VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
var INSTRUCTIONS = [
  "GPAO AZMG-Solutions : pilotage operationnel des postes places chez les clients.",
  "L'unite de travail n'est pas le mail mais la demande, rattachee a un dossier (client, produit, operation). Un mail, une consigne WhatsApp ou un vocal sont des evenements qui creent, font avancer ou cloturent une demande.",
  "Pour parler d\u2019un dossier, le retrouver d\u2019abord (chercher_dossier), puis lire sa fiche (fiche_dossier). Ne rien inventer qui n\u2019y figure pas.",
  "Tous les delais sont comptes en heures ouvrees du client (Barcelone), week-ends et feries exclus. Une journee ouvree vaut 9 heures.",
  "La famille T00 est hors perimetre du poste : elle n\u2019apparait dans aucun outil et ne peut pas etre ecrite.",
  "Aucun outil n\u2019envoie de message a un client, un transitaire ou la donneuse d\u2019ordre. exporter_reporting rend un texte a relire, jamais un envoi.",
  "Ne jamais reprendre une appreciation du client sur le collaborateur : decrire l\u2019etat factuel du dossier et l\u2019action qui debloque.",
  "Les outils d\u2019ecriture laissent une trace \xAB claude \xBB dans le journal des actions."
].join(" ");
function entier(v, nom) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${nom} : identifiant numerique attendu`);
  return n;
}
function texte(v, nom, min = 1) {
  const t = String(v ?? "").trim();
  if (t.length < min) throw new Error(`${nom} : ${min} caractere(s) minimum attendu(s)`);
  return t;
}
function choix(v, valeurs, nom, defaut) {
  if (v === void 0 || v === null || v === "") {
    if (defaut !== void 0) return defaut;
    throw new Error(`${nom} : valeur attendue parmi ${valeurs.join(", ")}`);
  }
  const t = String(v);
  if (!valeurs.includes(t)) throw new Error(`${nom} : \xAB ${t} \xBB inconnu. Attendu : ${valeurs.join(", ")}`);
  return t;
}
function familleValide(v, nom = "famille") {
  const f = texte(v, nom, 2).toUpperCase();
  if (estHorsPerimetre(f)) throw new Error(`La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : elle n'entre pas dans le pilotage`);
  return f;
}
function instant2(v, nom) {
  if (v === void 0 || v === null || v === "") return void 0;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`${nom} : date attendue au format ISO (AAAA-MM-JJTHH:MM:SSZ)`);
  return d;
}
var lienDemande = (id2) => `${config.url}/demandes/${id2}`;
var lienDossier = (id2) => `${config.url}/dossiers/${id2}`;
async function compteDemande(v) {
  if (v !== void 0 && v !== null && v !== "") return entier(v, "compte_id");
  const comptes = await db.select({ id: schema_exports.comptesClients.id, nom: schema_exports.comptesClients.nom }).from(schema_exports.comptesClients).where((0, import_drizzle_orm24.eq)(schema_exports.comptesClients.actif, true));
  if (comptes.length === 1) return comptes[0].id;
  throw new Error(`compte_id obligatoire : plusieurs comptes clients (${comptes.map((c) => `${c.id} ${c.nom}`).join(", ")})`);
}
async function demandeDuPerimetre(id2) {
  const [d] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm24.eq)(schema_exports.demandes.id, entier(id2, "demande_id")));
  if (!d || estHorsPerimetre(d.famille)) throw new Error("Demande introuvable");
  return d;
}
var OUTILS = [
  {
    name: "file_du_jour",
    title: "File du jour",
    description: "Demandes ouvertes du poste, triees par urgence : delai cible depasse, echeance proche, priorite, puis anciennete. Les durees sont en heures ouvrees du client.",
    inputSchema: {
      type: "object",
      properties: {
        compte_id: { type: "integer", description: "Compte client. Facultatif s\u2019il n\u2019y en a qu\u2019un." },
        famille: { type: "string", description: "Code de famille, par exemple T01" },
        acteur: { type: "string", enum: ["poste", "do", "client", "tiers"], description: "Acteur dont on attend l\u2019action" },
        risque_seulement: { type: "boolean", description: "Ne garder que les demandes en retard ou proches d\u2019une echeance" },
        limite: { type: "integer", minimum: 1, maximum: 100, description: "30 par defaut" }
      }
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const lignes = await fileDuJour({
        compteId,
        familles: args.famille ? [familleValide(args.famille)] : void 0,
        acteurs: args.acteur ? [choix(args.acteur, ["poste", "do", "client", "tiers"], "acteur")] : void 0,
        risqueSeulement: Boolean(args.risque_seulement),
        limite: Math.min(Math.max(Number(args.limite) || 30, 1), 100)
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
        lien: lienDemande(l.id)
      }));
    }
  },
  {
    name: "chercher_dossier",
    title: "Chercher un dossier",
    description: "Cherche un dossier par client, produit, pays ou operation. Renvoie le dossier_id a utiliser avec les autres outils.",
    inputSchema: {
      type: "object",
      properties: {
        recherche: { type: "string", description: "Client, produit, pays ou operation (partiel accepte)" },
        compte_id: { type: "integer" },
        limite: { type: "integer", minimum: 1, maximum: 50, description: "20 par defaut" }
      },
      required: ["recherche"]
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const lignes = await chercherDossiers(texte(args.recherche, "recherche", 2), {
        compteId,
        limite: Math.min(Math.max(Number(args.limite) || 20, 1), 50)
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
        lien: lienDossier(d.id)
      }));
    }
  },
  {
    name: "fiche_dossier",
    title: "Fiche d\u2019un dossier",
    description: "Lit un dossier : identification, references, montants approuves, demandes avec leurs delais, echeances, et la chronologie des evenements. Le hors perimetre en est exclu.",
    inputSchema: {
      type: "object",
      properties: {
        dossier_id: { type: "integer" },
        evenements: { type: "integer", minimum: 0, maximum: 100, description: "Nombre d\u2019evenements de la chronologie, 20 par defaut" }
      },
      required: ["dossier_id"]
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const dossier = await lireDossier(entier(args.dossier_id, "dossier_id"));
      const demandes2 = await demandesDuDossier(dossier.id);
      const avecTemps = await Promise.all(
        demandes2.map(async (d) => {
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
            lien: lienDemande(d.id)
          };
        })
      );
      const echeances2 = await db.select().from(schema_exports.echeances).where((0, import_drizzle_orm24.and)((0, import_drizzle_orm24.eq)(schema_exports.echeances.dossierId, dossier.id), (0, import_drizzle_orm24.eq)(schema_exports.echeances.annulee, false))).orderBy((0, import_drizzle_orm24.asc)(schema_exports.echeances.echeanceLe));
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
        echeances: echeances2.map((e) => ({ type: e.type, libelle: e.libelle, le: e.echeanceLe.toISOString().slice(0, 10), honoree: Boolean(e.honoreeLe) })),
        chronologie: chrono.slice(0, limite).map((l) => ({ type: l.type, le: l.survenuLe.toISOString(), titre: l.titre, detail: l.detail })),
        lien: lienDossier(dossier.id)
      };
    }
  },
  {
    name: "creer_demande",
    title: "Creer une demande",
    description: "Ouvre une demande dans un dossier existant, ou cree le dossier a la volee si client et produit sont fournis. Un dossier identique existant est reutilise.",
    inputSchema: {
      type: "object",
      properties: {
        dossier_id: { type: "integer", description: "Dossier existant. Sinon, renseigner client." },
        compte_id: { type: "integer" },
        client: { type: "string", description: "Client du nouveau dossier" },
        pays: { type: "string" },
        produit: { type: "string" },
        operation: { type: "string" },
        famille: { type: "string", description: `Code de famille parmi ${FAMILLES_PILOTAGE.map((f) => f.code).join(", ")}` },
        objet: { type: "string", description: "Ce qu\u2019il y a a faire, en une ligne" },
        priorite: { type: "string", enum: ["basse", "normale", "haute", "critique"] },
        echeance: { type: "string", description: "Echeance de la demande, au format ISO" }
      },
      required: ["famille", "objet"]
    },
    async executer(args, auteur) {
      const famille2 = familleValide(args.famille);
      const objet = texte(args.objet, "objet", 2);
      let dossierId;
      if (args.dossier_id) {
        dossierId = (await lireDossier(entier(args.dossier_id, "dossier_id"))).id;
      } else {
        const compteId = await compteDemande(args.compte_id);
        const { dossier } = await trouverOuCreerDossier(
          {
            compteId,
            client: texte(args.client, "client"),
            pays: args.pays ? String(args.pays) : null,
            produit: args.produit ? String(args.produit) : null,
            operation: args.operation ? String(args.operation) : null
          },
          auteur
        );
        dossierId = dossier.id;
      }
      const demande = await creerDemande(
        {
          dossierId,
          famille: famille2,
          objet,
          origine: "saisie",
          priorite: args.priorite ? choix(args.priorite, ["basse", "normale", "haute", "critique"], "priorite") : void 0,
          echeanceLe: instant2(args.echeance, "echeance") ?? null
        },
        auteur
      );
      return { demande_id: demande.id, dossier_id: dossierId, statut: libelleStatut(demande.statut), lien: lienDemande(demande.id) };
    }
  },
  {
    name: "ajouter_evenement",
    title: "Ajouter un evenement",
    description: "Enregistre un mail, une consigne, une note ou une reponse sur une demande ou un dossier. C\u2019est la nature qui fait avancer la demande (voir le referentiel).",
    inputSchema: {
      type: "object",
      properties: {
        demande_id: { type: "integer" },
        dossier_id: { type: "integer", description: "A defaut de demande_id" },
        sens: { type: "string", enum: [...SENS] },
        nature: { type: "string", enum: [...NATURES] },
        famille: { type: "string" },
        interlocuteur: { type: "string", enum: [...INTERLOCUTEURS] },
        source: { type: "string", enum: [...SOURCES] },
        objet: { type: "string" },
        resume: { type: "string", description: "Etat factuel et action qui debloque, jamais une appreciation sur le collaborateur" },
        survenu_le: { type: "string", description: "Horodatage d\u2019origine, au format ISO. Maintenant par defaut." }
      },
      required: ["nature"]
    },
    async executer(args, auteur) {
      if (!args.demande_id && !args.dossier_id) throw new Error("Indiquez demande_id ou dossier_id");
      const nature = choix(args.nature, NATURES, "nature");
      const resultat = await ajouterEvenement(
        {
          demandeId: args.demande_id ? (await demandeDuPerimetre(args.demande_id)).id : null,
          dossierId: args.dossier_id ? entier(args.dossier_id, "dossier_id") : null,
          sens: choix(args.sens, SENS, "sens", "entrant"),
          nature,
          famille: args.famille ? familleValide(args.famille) : null,
          interlocuteur: args.interlocuteur ? choix(args.interlocuteur, INTERLOCUTEURS, "interlocuteur") : null,
          source: choix(args.source, SOURCES, "source", "saisie"),
          objet: args.objet ? String(args.objet) : null,
          resume: args.resume ? String(args.resume) : null,
          survenuLe: instant2(args.survenu_le, "survenu_le")
        },
        auteur
      );
      return {
        evenement_id: resultat.evenement.id,
        demande_id: resultat.demande?.id ?? null,
        demande_creee: resultat.demandeCreee,
        statut: resultat.demande ? libelleStatut(resultat.demande.statut) : null,
        hors_perimetre: resultat.horsPerimetre
      };
    }
  },
  {
    name: "changer_statut",
    title: "Changer le statut d\u2019une demande",
    description: "Change le statut d\u2019une demande. La transition est horodatee et le temps passe dans le statut quitte est comptabilise.",
    inputSchema: {
      type: "object",
      properties: {
        demande_id: { type: "integer" },
        statut: { type: "string", enum: [...STATUTS] },
        motif: { type: "string" }
      },
      required: ["demande_id", "statut"]
    },
    async executer(args, auteur) {
      const demande = await demandeDuPerimetre(args.demande_id);
      const maj = await changerStatut(demande.id, choix(args.statut, STATUTS, "statut"), auteur, {
        motif: args.motif ? String(args.motif).slice(0, 300) : "via le connecteur Claude"
      });
      const temps = await tempsDemande(maj);
      return {
        demande_id: maj.id,
        statut: libelleStatut(maj.statut),
        statut_reporting: statutReporting(maj.statut),
        acteur_attendu: maj.acteurAttendu,
        delai_total: formaterDuree(temps.total),
        lien: lienDemande(maj.id)
      };
    }
  },
  {
    name: "echeances_a_venir",
    title: "Echeances a venir",
    description: "Cut-off, departs et arrivees prevus, validites d\u2019offre, expirations de document et creneaux d\u2019entrepot, du plus proche au plus lointain.",
    inputSchema: {
      type: "object",
      properties: {
        compte_id: { type: "integer" },
        jours: { type: "integer", minimum: 1, maximum: 180, description: "14 par defaut" }
      }
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const jours = Math.min(Math.max(Number(args.jours) || 14, 1), 180);
      const maintenant = /* @__PURE__ */ new Date();
      const lignes = await db.select({ echeance: schema_exports.echeances, dossierId: schema_exports.dossiers.id, dossier: schema_exports.dossiers.libelle }).from(schema_exports.echeances).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm24.eq)(schema_exports.dossiers.id, schema_exports.echeances.dossierId)).where(
        (0, import_drizzle_orm24.and)(
          (0, import_drizzle_orm24.eq)(schema_exports.dossiers.compteId, compteId),
          (0, import_drizzle_orm24.eq)(schema_exports.echeances.annulee, false),
          import_drizzle_orm24.sql`${schema_exports.echeances.honoreeLe} IS NULL`,
          (0, import_drizzle_orm24.gte)(schema_exports.echeances.echeanceLe, new Date(maintenant.getTime() - 7 * 864e5)),
          (0, import_drizzle_orm24.lte)(schema_exports.echeances.echeanceLe, new Date(maintenant.getTime() + jours * 864e5))
        )
      ).orderBy((0, import_drizzle_orm24.asc)(schema_exports.echeances.echeanceLe)).limit(100);
      return lignes.map((l) => ({
        dossier_id: l.dossierId,
        dossier: l.dossier,
        type: l.echeance.type,
        libelle: l.echeance.libelle,
        le: l.echeance.echeanceLe.toISOString().slice(0, 10),
        jours_restants: Math.floor((l.echeance.echeanceLe.getTime() - maintenant.getTime()) / 864e5),
        lien: lienDossier(l.dossierId)
      }));
    }
  },
  {
    name: "indicateurs",
    title: "Indicateurs de pilotage",
    description: "Flux, stock, delais, respect du delai cible, attente par acteur et charge estimee, avec la comparaison a la periode precedente.",
    inputSchema: {
      type: "object",
      properties: {
        compte_id: { type: "integer" },
        jours: { type: "integer", minimum: 1, maximum: 365, description: "7 par defaut" }
      }
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
          delai_cible_depasse: tb.stock.slaDepasse
        },
        delais: {
          terminees: tb.delais.terminees,
          premiere_reponse_mediane: tb.delais.premiereReponseMedianeMinutes === null ? null : formaterDuree(tb.delais.premiereReponseMedianeMinutes),
          delai_total_median: tb.delais.delaiTotalMedianMinutes === null ? null : formaterDuree(tb.delais.delaiTotalMedianMinutes),
          respect_delai_cible: tb.delais.respectSla,
          attente_par_acteur: Object.fromEntries(
            Object.entries(tb.delais.attenteParActeurMinutes).filter(([, m]) => m > 0).map(([a, m]) => [a, formaterDuree(m)])
          )
        },
        charge_estimee_jours: tb.charge.totalJours,
        attentes_do_longues: tb.attentesDoLongues.map((a) => ({
          demande_id: a.demandeId,
          objet: a.objet,
          dossier: a.dossier,
          attente: formaterDuree(a.minutesAttente)
        })),
        echeances_proches: tb.echeancesProches.map((e) => ({ dossier: e.dossier, libelle: e.libelle ?? e.type, jours_restants: e.joursRestants }))
      };
    }
  },
  {
    name: "a_classer",
    title: "File \xAB A classer \xBB",
    description: "Evenements dont le typage automatique est sous le seuil de confiance, ou dont la famille manque. Le hors perimetre en est exclu.",
    inputSchema: {
      type: "object",
      properties: { limite: { type: "integer", minimum: 1, maximum: 100, description: "20 par defaut" } }
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const parametres2 = await lireParametres();
      const lignes = await aClasser(parametres2.seuilConfianceTypage, Math.min(Math.max(Number(args.limite) || 20, 1), 100));
      return lignes.map((l) => ({
        evenement_id: l.evenement.id,
        dossier: l.dossier,
        objet: l.evenement.objet,
        resume: l.evenement.resume,
        sens: l.evenement.sens,
        nature: l.evenement.nature,
        famille: l.evenement.famille,
        confiance: l.evenement.confianceTypage,
        survenu_le: l.evenement.survenuLe.toISOString()
      }));
    }
  },
  {
    name: "corriger_typage",
    title: "Corriger le typage d\u2019un evenement",
    description: "Corrige la famille, la nature, le sens ou l\u2019interlocuteur d\u2019un evenement mal classe. La correction est tracee avec son auteur.",
    inputSchema: {
      type: "object",
      properties: {
        evenement_id: { type: "integer" },
        famille: { type: "string" },
        nature: { type: "string", enum: [...NATURES] },
        sens: { type: "string", enum: [...SENS] },
        interlocuteur: { type: "string", enum: [...INTERLOCUTEURS] }
      },
      required: ["evenement_id"]
    },
    async executer(args, auteur) {
      const modifs = {};
      if (args.famille) modifs.famille = familleValide(args.famille);
      if (args.nature) modifs.nature = choix(args.nature, NATURES, "nature");
      if (args.sens) modifs.sens = choix(args.sens, SENS, "sens");
      if (args.interlocuteur) modifs.interlocuteur = choix(args.interlocuteur, INTERLOCUTEURS, "interlocuteur");
      if (!Object.keys(modifs).length) throw new Error("Indiquez au moins une correction");
      const maj = await corrigerTypage(entier(args.evenement_id, "evenement_id"), modifs, auteur);
      return { evenement_id: maj.id, famille: maj.famille, nature: maj.nature, sens: maj.sens, interlocuteur: maj.interlocuteur };
    }
  },
  {
    name: "exporter_reporting",
    title: "Preparer le reporting d\u2019un jour",
    description: "Prepare les lignes du reporting quotidien pour un jour donne : une ligne par dossier, au dernier etat connu, description terminee par le statut exact. Rend un texte a relire, n\u2019envoie rien et n\u2019ecrit dans aucun classeur.",
    inputSchema: {
      type: "object",
      properties: {
        compte_id: { type: "integer" },
        jour: { type: "string", description: "AAAA-MM-JJ. Aujourd\u2019hui par defaut." }
      }
    },
    annotations: { readOnlyHint: true },
    async executer(args) {
      const compteId = await compteDemande(args.compte_id);
      const jour = args.jour ? texte(args.jour, "jour", 10).slice(0, 10) : import_luxon7.DateTime.now().toISODate();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error("jour : format AAAA-MM-JJ attendu");
      const bloc = await construireBlocJour(compteId, jour);
      return {
        jour: import_luxon7.DateTime.fromISO(jour).toFormat("dd/MM/yyyy"),
        lignes: bloc.lignes.map((l) => ({
          client_ou_pays: l.client,
          produit_et_reference: l.produit,
          description: l.description,
          statut: l.statut,
          livrables_finalises: l.livrables,
          priorite_du_lendemain: l.prioriteLendemain
        })),
        rappel: "Ce texte est un brouillon a relire. L'ecriture dans le classeur se fait dans l'application, ecran Export."
      };
    }
  }
];
function erreur(id2, code, message) {
  return { jsonrpc: "2.0", id: id2 ?? null, error: { code, message } };
}
async function utilisateurDuConnecteur() {
  if (config.mcp.utilisateur) {
    const [u] = await db.select({ id: schema_exports.utilisateurs.id }).from(schema_exports.utilisateurs).where((0, import_drizzle_orm24.and)((0, import_drizzle_orm24.eq)(schema_exports.utilisateurs.email, config.mcp.utilisateur), (0, import_drizzle_orm24.eq)(schema_exports.utilisateurs.actif, true)));
    if (u) return u.id;
  }
  const [admin] = await db.select({ id: schema_exports.utilisateurs.id }).from(schema_exports.utilisateurs).where((0, import_drizzle_orm24.and)((0, import_drizzle_orm24.eq)(schema_exports.utilisateurs.role, "admin"), (0, import_drizzle_orm24.eq)(schema_exports.utilisateurs.actif, true))).orderBy((0, import_drizzle_orm24.asc)(schema_exports.utilisateurs.id));
  return admin?.id ?? null;
}
async function traiterMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return erreur(msg?.id, -32600, "Requete JSON-RPC invalide");
  const { id: id2, method } = msg;
  const params = msg.params ?? {};
  if (id2 === void 0 || id2 === null) return null;
  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: id2,
        result: {
          protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "azmg-gpao", title: "AZMG GPAO", version: "1.0.0" },
          instructions: INSTRUCTIONS
        }
      };
    case "ping":
      return { jsonrpc: "2.0", id: id2, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id: id2, result: { tools: OUTILS.map(({ executer: _e, ...o }) => o) } };
    case "tools/call": {
      const outil = OUTILS.find((o) => o.name === params.name);
      if (!outil) return erreur(id2, -32602, `Outil inconnu : ${String(params.name)}`);
      try {
        const auteur = auteurClaude(await utilisateurDuConnecteur());
        const resultat = await outil.executer(params.arguments ?? {}, auteur);
        return {
          jsonrpc: "2.0",
          id: id2,
          result: {
            content: [{ type: "text", text: JSON.stringify(resultat, null, 1) }],
            structuredContent: Array.isArray(resultat) ? { resultats: resultat } : resultat
          }
        };
      } catch (e) {
        return { jsonrpc: "2.0", id: id2, result: { content: [{ type: "text", text: e.message }], isError: true } };
      }
    }
    default:
      return erreur(id2, -32601, `Methode non prise en charge : ${method}`);
  }
}

// src/server/modules/mcp/routes.ts
var LONGUEUR_MIN_JETON = 32;
var appels = [];
function noterAppel(req, statut, detail) {
  const corps = req.body;
  const rpc = Array.isArray(corps) ? corps.map((m) => m?.method).join(",") : corps?.method ?? null;
  appels.unshift({ le: (/* @__PURE__ */ new Date()).toISOString(), http: req.method, chemin: req.originalUrl.slice(0, 120), statut, rpc, auth: detail, agent: String(req.headers["user-agent"] ?? "").slice(0, 80) });
  appels.length = Math.min(appels.length, 15);
}
function etatMcp() {
  return { configure: config.mcp.jeton.length >= LONGUEUR_MIN_JETON, derniers_appels: appels };
}
var routesMcp = (0, import_express10.Router)();
routesMcp.use((0, import_express_rate_limit2.default)({ windowMs: 6e4, limit: config.test ? 1e4 : 120, standardHeaders: true, legacyHeaders: false }));
routesMcp.use(import_express10.default.json({ limit: "1mb" }));
routesMcp.use((req, res, next) => {
  const attendu = config.mcp.jeton;
  if (attendu.length < LONGUEUR_MIN_JETON) {
    noterAppel(req, 503, "non configur\xE9");
    res.status(503).json({ erreur: "Connecteur Claude non configur\xE9 (AZMG_MCP_TOKEN)" });
    return;
  }
  const entete = String(req.headers.authorization ?? "");
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
  if (!jeton || !egaliteConstante(jeton, attendu)) {
    const forme = !entete ? "en-t\xEAte absent" : !entete.startsWith("Bearer ") ? `sans \xAB Bearer \xBB (${entete.length} car.)` : `jeton refus\xE9 (${jeton.length} car. recus, ${attendu.length} attendus)`;
    noterAppel(req, 401, forme);
    res.status(401).json({ erreur: "Jeton du connecteur invalide" });
    return;
  }
  noterAppel(req, 200, "ok");
  next();
});
routesMcp.post("/", async (req, res) => {
  const corps = req.body;
  try {
    if (Array.isArray(corps)) {
      const reponses = (await Promise.all(corps.map((m) => traiterMessage(m)))).filter(Boolean);
      if (reponses.length) res.json(reponses);
      else res.status(202).end();
      return;
    }
    const reponse = await traiterMessage(corps);
    if (reponse) res.json(reponse);
    else res.status(202).end();
  } catch (e) {
    journal.error("Connecteur Claude en \xE9chec", { erreur: messageErreur(e) });
    const id2 = corps?.id;
    res.status(500).json({ jsonrpc: "2.0", id: id2 ?? null, error: { code: -32603, message: "Erreur interne de la GPAO" } });
  }
});
routesMcp.get("/", (_req, res) => {
  res.set("Allow", "POST").status(405).json({ erreur: "POST uniquement" });
});
routesMcp.delete("/", (_req, res) => {
  res.set("Allow", "POST").status(405).json({ erreur: "POST uniquement" });
});

// src/server/modules/typage/routes.ts
var import_express11 = require("express");
var import_express12 = __toESM(require("express"));
var import_express_rate_limit3 = __toESM(require("express-rate-limit"));
var import_zod12 = require("zod");
var import_drizzle_orm25 = require("drizzle-orm");
init_client();
init_config();
init_http();
init_securite();
init_service2();
init_service();
init_constantes();
var routesTypage = (0, import_express11.Router)();
routesTypage.use(exigerConnexion);
routesTypage.post("/essai", async (req, res) => {
  const d = valider(
    import_zod12.z.object({
      objet: import_zod12.z.string().trim().max(300).optional(),
      corps: import_zod12.z.string().trim().max(1e4).optional(),
      expediteur: import_zod12.z.string().trim().max(320).optional(),
      sens: import_zod12.z.enum(SENS).optional(),
      compteId: import_zod12.z.number().int().positive().optional()
    }),
    req.body
  );
  const resultat = await typerMessage(d, { compteId: d.compteId });
  res.json({ typage: resultat.typage, applicable: resultat.applicable });
});
routesTypage.get("/regles", async (_req, res) => {
  const lignes = await db.select().from(schema_exports.reglesTypage).orderBy((0, import_drizzle_orm25.asc)(schema_exports.reglesTypage.priorite), (0, import_drizzle_orm25.asc)(schema_exports.reglesTypage.id));
  res.json(lignes);
});
routesTypage.get("/regles/proposees", async (_req, res) => {
  res.json(await reglesProposees());
});
routesTypage.post("/regles/:id/accepter", exigerRole("admin", "manager"), async (req, res) => {
  res.json(await accepterRegle(idParam(req), auteurDe(req)));
});
routesTypage.post("/regles/:id/refuser", exigerRole("admin", "manager"), async (req, res) => {
  res.json(await refuserRegle(idParam(req), auteurDe(req)));
});
routesTypage.post("/regles", exigerRole("admin"), async (req, res) => {
  const d = valider(
    import_zod12.z.object({
      libelle: import_zod12.z.string().trim().min(3).max(200),
      domaine: import_zod12.z.string().trim().max(200).nullish(),
      motsCles: import_zod12.z.array(import_zod12.z.string().trim().min(2).max(80)).max(30).default([]),
      famille: import_zod12.z.enum(CODES_FAMILLES).nullish(),
      nature: import_zod12.z.enum(NATURES).nullish(),
      interlocuteur: import_zod12.z.enum(INTERLOCUTEURS).nullish(),
      priorite: import_zod12.z.number().int().min(1).max(999).default(70),
      compteId: import_zod12.z.number().int().positive().nullish()
    }),
    req.body
  );
  const [regle] = await db.insert(schema_exports.reglesTypage).values({ ...d, actif: true, proposee: false, creeParId: req.utilisateur.id }).returning();
  res.status(201).json(regle);
});
routesTypage.patch("/regles/:id", exigerRole("admin"), async (req, res) => {
  const d = valider(
    import_zod12.z.object({
      libelle: import_zod12.z.string().trim().min(3).max(200).optional(),
      motsCles: import_zod12.z.array(import_zod12.z.string().trim().min(2).max(80)).max(30).optional(),
      famille: import_zod12.z.enum(CODES_FAMILLES).nullish(),
      nature: import_zod12.z.enum(NATURES).nullish(),
      interlocuteur: import_zod12.z.enum(INTERLOCUTEURS).nullish(),
      priorite: import_zod12.z.number().int().min(1).max(999).optional(),
      actif: import_zod12.z.boolean().optional()
    }),
    req.body
  );
  const [maj] = await db.update(schema_exports.reglesTypage).set({ ...d, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm25.eq)(schema_exports.reglesTypage.id, idParam(req))).returning();
  if (!maj) throw new ErreurHttp(404, "Regle introuvable");
  res.json(maj);
});
routesTypage.get("/ia/etat", async (_req, res) => {
  res.json(await etatFileIa());
});
routesTypage.post("/regles/proposer/:evenementId", exigerRole("admin", "manager"), async (req, res) => {
  const evenementId = idParam(req, "evenementId");
  const [evenement] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm25.eq)(schema_exports.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, "Evenement introuvable");
  const proposition = await proposerRegle(
    evenementId,
    { famille: evenement.famille ?? void 0, nature: evenement.nature, interlocuteur: evenement.interlocuteur },
    auteurDe(req)
  );
  if (!proposition) throw new ErreurHttp(409, "Aucune regle exploitable : objet trop court ou regle deja proposee");
  res.status(201).json(proposition);
});
var routesAgent = (0, import_express11.Router)();
routesAgent.use((0, import_express_rate_limit3.default)({ windowMs: 6e4, limit: config.test ? 1e4 : 120, standardHeaders: true, legacyHeaders: false }));
routesAgent.use(import_express12.default.json({ limit: "2mb" }));
routesAgent.use((req, res, next) => {
  const attendu = config.agent.jeton;
  if (!attendu) {
    res.status(503).json({ erreur: "API agent non configuree (AGENT_API_TOKEN)" });
    return;
  }
  const entete = String(req.headers.authorization ?? "");
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
  if (!jeton || !egaliteConstante(jeton, attendu)) {
    res.status(401).json({ erreur: "Jeton de l\u2019API agent invalide" });
    return;
  }
  next();
});
routesAgent.get("/ia/taches", async (req, res) => {
  const q = valider(import_zod12.z.object({ limite: import_zod12.z.coerce.number().int().min(1).max(200).optional() }), req.query);
  res.json({ taches: await tachesEnAttente(q.limite ?? 50) });
});
routesAgent.post("/ia/taches/:id/resultat", async (req, res) => {
  const id2 = idParam(req);
  const [tache] = await db.select().from(schema_exports.aiTasks).where((0, import_drizzle_orm25.eq)(schema_exports.aiTasks.id, id2));
  if (!tache) throw new ErreurHttp(404, "Tache IA introuvable");
  const corps = valider(
    import_zod12.z.object({ resultat: import_zod12.z.record(import_zod12.z.string(), import_zod12.z.unknown()).nullish(), erreur: import_zod12.z.string().trim().max(1e3).nullish() }),
    req.body
  );
  if (!corps.resultat) {
    const bilan = await enregistrerResultat(id2, null, corps.erreur ?? "aucun resultat");
    return res.json(bilan);
  }
  if (tache.type === "typer_evenement") {
    const valide = sortieTypageSchema.safeParse(corps.resultat);
    if (!valide.success) {
      const bilan = await enregistrerResultat(id2, null, valide.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; "));
      return res.status(422).json({ ...bilan, erreur: "Sortie invalide, la tache repart en file" });
    }
    return res.json(await enregistrerResultat(id2, valide.data));
  }
  res.json(await enregistrerResultat(id2, corps.resultat));
});

// src/server/modules/collecte/routes.ts
var import_express13 = require("express");
var import_express14 = __toESM(require("express"));
var import_multer3 = __toESM(require("multer"));
var import_express_rate_limit4 = __toESM(require("express-rate-limit"));
var import_node_path4 = __toESM(require("node:path"));
var import_zod13 = require("zod");
var import_drizzle_orm27 = require("drizzle-orm");
init_client();
init_config();
init_http();
init_journal();

// src/server/lib/stockage.ts
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path3 = __toESM(require("node:path"));
init_config();
init_securite();
var EXTENSIONS_ACCEPTEES = /* @__PURE__ */ new Set([
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".doc",
  ".txt",
  ".rtf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".tif",
  ".tiff",
  ".zip",
  ".eml",
  ".msg",
  ".xml",
  ".json"
]);
function extensionAcceptee(nomFichier) {
  return EXTENSIONS_ACCEPTEES.has(import_node_path3.default.extname(nomFichier).toLowerCase());
}
function cheminAbsolu(cheminRelatif) {
  const racine = import_node_path3.default.resolve(config.stockage);
  const absolu = import_node_path3.default.resolve(racine, cheminRelatif);
  if (absolu !== racine && !absolu.startsWith(racine + import_node_path3.default.sep)) {
    throw new Error("Chemin de fichier hors du dossier de stockage");
  }
  return absolu;
}
async function rangerFichier(contenu, nomFichier, sousDossier = "pieces") {
  const empreinte = sha256(contenu);
  const extension = import_node_path3.default.extname(nomFichier).toLowerCase().slice(0, 12);
  const chemin = import_node_path3.default.join(sousDossier, empreinte.slice(0, 2), empreinte.slice(2, 4), `${empreinte}${extension}`);
  const absolu = cheminAbsolu(chemin);
  try {
    const stat = await import_promises.default.stat(absolu);
    return { chemin, empreinte, tailleOctets: stat.size, deja: true };
  } catch {
  }
  await import_promises.default.mkdir(import_node_path3.default.dirname(absolu), { recursive: true });
  await import_promises.default.writeFile(absolu, contenu);
  return { chemin, empreinte, tailleOctets: contenu.length, deja: false };
}
async function fichierExiste(cheminRelatif) {
  try {
    await import_promises.default.access(cheminAbsolu(cheminRelatif));
    return true;
  } catch {
    return false;
  }
}

// src/server/adapters/collecte-mail.ts
var import_node_crypto3 = __toESM(require("node:crypto"));
var import_mailparser = require("mailparser");
init_config();
init_journal();
function adresse(valeur2) {
  if (!valeur2) return "";
  const v = valeur2;
  const premiere = v.value?.[0]?.address;
  if (premiere) return premiere.toLowerCase();
  const m = /<([^>]+)>/.exec(v.text ?? "");
  return (m ? m[1] : v.text ?? "").trim().toLowerCase();
}
function adresses(valeur2) {
  if (!valeur2) return [];
  const liste = Array.isArray(valeur2) ? valeur2 : [valeur2];
  const sortie = [];
  for (const v of liste) {
    for (const a of v.value ?? []) if (a.address) sortie.push(a.address.toLowerCase());
  }
  return [...new Set(sortie)];
}
function corpsTexte(mail) {
  if (mail.text?.trim()) return mail.text.trim();
  const html = typeof mail.html === "string" ? mail.html : "";
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function identifiantFil(messageId, references, inReplyTo) {
  const liste = Array.isArray(references) ? references : references ? references.split(/\s+/) : [];
  const premier = liste.map((r) => r.trim()).find((r) => r.startsWith("<"));
  return premier || inReplyTo?.trim() || messageId;
}
async function analyserMessage(brut) {
  const mail = await (0, import_mailparser.simpleParser)(brut, { skipImageLinks: true });
  const messageId = (mail.messageId ?? "").trim() || `<sans-id-${import_node_crypto3.default.createHash("sha256").update(String(brut)).digest("hex").slice(0, 32)}@azmg-gpao>`;
  return {
    messageId,
    filId: identifiantFil(messageId, mail.references, mail.inReplyTo),
    expediteur: adresse(mail.from),
    destinataires: [...adresses(mail.to), ...adresses(mail.cc)],
    objet: (mail.subject ?? "").trim(),
    corps: corpsTexte(mail),
    // L'horodatage d'origine est conserve tel quel : c'est lui qui fait foi pour les delais.
    survenuLe: mail.date ?? /* @__PURE__ */ new Date(),
    pieces: (mail.attachments ?? []).filter((p) => p.content && p.filename).map((p) => ({ nomFichier: p.filename, contenu: p.content, typeMime: p.contentType ?? "application/octet-stream" }))
  };
}
function decouperMbox(contenu) {
  const texte2 = contenu.toString("binary");
  const lignes = texte2.split(/\r?\n/);
  const messages = [];
  let courant = null;
  for (const ligne of lignes) {
    if (/^From .+\d{4}$/.test(ligne) || /^From \S+@\S+ /.test(ligne)) {
      if (courant?.length) messages.push(courant);
      courant = [];
      continue;
    }
    if (courant === null) continue;
    courant.push(ligne.replace(/^>(>*From )/, "$1"));
  }
  if (courant?.length) messages.push(courant);
  return messages.map((m) => Buffer.from(m.join("\n"), "binary"));
}
var CollecteSimulee = class {
  mode = "mock";
  async relever() {
    return [];
  }
};
var CollecteAppsScript = class {
  mode = "apps_script";
  async relever() {
    return [];
  }
};
var CollecteImap = class {
  mode = "imap";
  async relever(limite = 50) {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: config.collecte.imap.hote,
      port: config.collecte.imap.port,
      secure: config.collecte.imap.securise,
      auth: { user: config.collecte.imap.utilisateur, pass: config.collecte.imap.motDePasse },
      logger: false
    });
    const messages = [];
    await client.connect();
    try {
      const verrou = await client.getMailboxLock(config.collecte.imap.dossier);
      try {
        for await (const message of client.fetch({ seen: false }, { source: true, uid: true })) {
          if (messages.length >= limite) break;
          if (!message.source) continue;
          try {
            messages.push(await analyserMessage(message.source));
            await client.messageFlagsAdd({ uid: String(message.uid) }, ["\\Seen"], { uid: true });
          } catch (e) {
            journal.warn("Message IMAP illisible, ignore", { erreur: messageErreur(e) });
          }
        }
      } finally {
        verrou.release();
      }
    } finally {
      await client.logout().catch(() => void 0);
    }
    return messages;
  }
};
var instance2 = null;
function adaptateurCollecte() {
  if (instance2) return instance2;
  switch (config.collecte.mode) {
    case "imap":
      instance2 = new CollecteImap();
      break;
    case "apps_script":
      instance2 = new CollecteAppsScript();
      break;
    default:
      instance2 = new CollecteSimulee();
  }
  return instance2;
}
function signerCharge(corps, secret) {
  return import_node_crypto3.default.createHmac("sha256", secret).update(corps).digest("hex");
}
function verifierSignature(corps, signature, secret) {
  if (!signature || !secret) return false;
  const attendue = signerCharge(corps, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  return a.length === b.length && import_node_crypto3.default.timingSafeEqual(a, b);
}

// src/server/modules/collecte/service.ts
var import_drizzle_orm26 = require("drizzle-orm");
init_client();
init_journal();
init_evenements();
init_service2();
init_typage();
init_constantes();
var TAILLE_MAX_PIECE = 10 * 1024 * 1024;
function bilanVide() {
  return { lus: 0, crees: 0, doublons: 0, ignores: 0, horsPerimetre: 0, aClasser: 0, piecesRangees: 0, erreurs: [] };
}
function sensDuMessage(message, config2) {
  if (estUneDe(message.expediteur, config2.adressesPoste)) return "sortant";
  if (message.destinataires?.some((d) => estUneDe(d, config2.adressesPoste))) return "entrant";
  const domaine = domaineDe(message.expediteur);
  if (domaine && (config2.domainesInternes ?? []).some((d) => domaine.endsWith(d))) return "sortant";
  return "entrant";
}
function estIgnore(message, config2) {
  if (!config2.adressesIgnorees.length) return false;
  const correspondants = [message.expediteur, ...message.destinataires ?? []];
  if (correspondants.some((a) => estUneDe(a, config2.adressesPoste))) return false;
  return correspondants.some((a) => estUneDe(a, config2.adressesIgnorees));
}
async function configDuCompte(compteId) {
  const [compte] = await db.select({
    donneurOrdreEmail: schema_exports.comptesClients.donneurOrdreEmail,
    adressesIgnorees: schema_exports.comptesClients.adressesIgnorees
  }).from(schema_exports.comptesClients).where((0, import_drizzle_orm26.eq)(schema_exports.comptesClients.id, compteId));
  const lignes = await db.select({
    id: schema_exports.postes.id,
    intitule: schema_exports.postes.intitule,
    adresses: schema_exports.postes.adresses,
    familles: schema_exports.postes.familles
  }).from(schema_exports.postes).where((0, import_drizzle_orm26.and)((0, import_drizzle_orm26.eq)(schema_exports.postes.compteId, compteId), (0, import_drizzle_orm26.eq)(schema_exports.postes.actif, true)));
  const chaines = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  const postes2 = lignes.map((l) => ({
    id: l.id,
    intitule: l.intitule,
    adresses: chaines(l.adresses),
    familles: chaines(l.familles)
  }));
  return {
    postes: postes2,
    adressesPoste: postes2.flatMap((p) => p.adresses),
    adresseDo: compte?.donneurOrdreEmail ?? null,
    adressesIgnorees: chaines(compte?.adressesIgnorees)
  };
}
function posteDuMessage(message, postes2, famille2) {
  if (!postes2.length) return null;
  if (postes2.length === 1) return postes2[0].id;
  const parExpediteur = postes2.find((p) => estUneDe(message.expediteur, p.adresses));
  if (parExpediteur) return parExpediteur.id;
  const parDestinataire = postes2.find((p) => message.destinataires?.some((d) => estUneDe(d, p.adresses)));
  if (parDestinataire) return parDestinataire.id;
  if (famille2) {
    const parFamille = postes2.filter((p) => p.familles.includes(famille2));
    if (parFamille.length === 1) return parFamille[0].id;
  }
  return null;
}
async function demandeDuFil(filId, compteId) {
  const [ligne] = await db.select({ demandeId: schema_exports.evenements.demandeId, dossierId: schema_exports.evenements.dossierId }).from(schema_exports.evenements).where((0, import_drizzle_orm26.and)((0, import_drizzle_orm26.eq)(schema_exports.evenements.filId, filId), (0, import_drizzle_orm26.eq)(schema_exports.evenements.compteId, compteId), (0, import_drizzle_orm26.isNotNull)(schema_exports.evenements.demandeId))).orderBy((0, import_drizzle_orm26.desc)(schema_exports.evenements.survenuLe)).limit(1);
  if (!ligne?.demandeId || !ligne.dossierId) return null;
  return { demandeId: ligne.demandeId, dossierId: ligne.dossierId };
}
async function enregistrerMessage(message, opts, auteur) {
  const [deja] = await db.select({ id: schema_exports.evenements.id }).from(schema_exports.evenements).where((0, import_drizzle_orm26.eq)(schema_exports.evenements.messageId, message.messageId));
  if (deja) return null;
  const config2 = opts.config ?? await configDuCompte(opts.compteId);
  if (estIgnore(message, config2)) return { ignore: true };
  const domainesInternes = opts.domainesInternes ?? ["azmg-solutions.com"];
  const sens = sensDuMessage(message, { adressesPoste: config2.adressesPoste, domainesInternes });
  const typage = await typerMessage(
    {
      objet: message.objet,
      corps: message.corps,
      expediteur: message.expediteur,
      destinataires: message.destinataires,
      sens,
      adressesPoste: config2.adressesPoste,
      adresseDo: config2.adresseDo
    },
    { compteId: opts.compteId }
  );
  const horsPerimetre = estHorsPerimetre(typage.typage.famille);
  const posteId = opts.posteId ?? posteDuMessage(message, config2.postes, typage.applicable ? typage.typage.famille : null);
  const parFil = horsPerimetre ? null : await demandeDuFil(message.filId, opts.compteId);
  let dossierId = parFil?.dossierId ?? opts.dossierParDefautId ?? null;
  if (!dossierId) {
    const client = message.expediteur ? message.expediteur.split("@")[0] : "Expediteur inconnu";
    const { dossier } = await trouverOuCreerDossier(
      { compteId: opts.compteId, posteId, client, produit: null, operation: null, notes: "Dossier ouvert automatiquement par la collecte des mails, a reclasser." },
      auteur
    );
    dossierId = dossier.id;
  }
  const piecesRangees = [];
  for (const piece of message.pieces) {
    if (!extensionAcceptee(piece.nomFichier) || piece.contenu.length > TAILLE_MAX_PIECE) continue;
    try {
      const range = await rangerFichier(piece.contenu, piece.nomFichier);
      piecesRangees.push({ chemin: range.chemin, nomFichier: piece.nomFichier, taille: range.tailleOctets, empreinte: range.empreinte });
    } catch (e) {
      journal.warn("Piece jointe non rangee", { erreur: messageErreur(e) });
    }
  }
  const resultat = await ajouterEvenement(
    {
      demandeId: parFil?.demandeId ?? null,
      dossierId,
      sens,
      nature: (typage.applicable ? typage.typage.nature : null) ?? "information",
      famille: typage.applicable ? typage.typage.famille : null,
      interlocuteur: typage.applicable ? typage.typage.interlocuteur : null,
      source: opts.source ?? "mail",
      filId: message.filId,
      messageId: message.messageId,
      expediteur: message.expediteur,
      destinataires: message.destinataires,
      survenuLe: message.survenuLe,
      objet: message.objet,
      resume: message.corps.slice(0, 500),
      contenu: message.corps.slice(0, 5e4),
      confianceTypage: typage.typage.confiance,
      justificatifs: typage.typage.justificatifs
    },
    auteur
  );
  for (const piece of piecesRangees) {
    await db.insert(schema_exports.pieces).values({
      dossierId,
      demandeId: resultat.demande?.id ?? null,
      evenementId: resultat.evenement.id,
      type: "piece jointe",
      nomFichier: piece.nomFichier,
      chemin: piece.chemin,
      tailleOctets: piece.taille,
      empreinte: piece.empreinte
    });
  }
  return {
    evenementId: resultat.evenement.id,
    demandeId: resultat.demande?.id ?? null,
    horsPerimetre,
    aClasser: !typage.applicable,
    pieces: piecesRangees.length
  };
}
async function enregistrerLot(messages, opts, auteur) {
  const bilan = bilanVide();
  const ordonnes = [...messages].sort((a, b) => a.survenuLe.getTime() - b.survenuLe.getTime());
  const config2 = opts.config ?? await configDuCompte(opts.compteId);
  for (const message of ordonnes) {
    bilan.lus++;
    try {
      const resultat = await enregistrerMessage(message, { ...opts, config: config2 }, auteur);
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
  await journaliser("mails_collectes", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "compte",
    entiteId: opts.compteId,
    details: { ...bilan, erreurs: bilan.erreurs.length }
  });
  return bilan;
}

// src/server/modules/collecte/routes.ts
var envoi3 = (0, import_multer3.default)({
  storage: import_multer3.default.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 20 },
  fileFilter: (_req, fichier, callback) => {
    if (!/\.(eml|mbox|txt)$/i.test(fichier.originalname)) {
      return callback(new ErreurHttp(400, "Seuls les fichiers .eml et .mbox sont acceptes"));
    }
    callback(null, true);
  }
});
var routesCollecte = (0, import_express13.Router)();
routesCollecte.use(exigerConnexion);
routesCollecte.get("/etat", async (_req, res) => {
  const [dernier] = await db.select({ creeLe: schema_exports.journalActions.creeLe, details: schema_exports.journalActions.details }).from(schema_exports.journalActions).where((0, import_drizzle_orm27.eq)(schema_exports.journalActions.action, "mails_collectes")).orderBy((0, import_drizzle_orm27.desc)(schema_exports.journalActions.creeLe)).limit(1);
  res.json({
    mode: adaptateurCollecte().mode,
    webhookConfigure: Boolean(config.collecte.secretAppsScript),
    dernierePasse: dernier ? { le: dernier.creeLe, bilan: dernier.details } : null
  });
});
routesCollecte.post("/import", exigerRole("admin", "manager"), envoi3.array("fichiers", 20), async (req, res) => {
  const fichiers = req.files ?? [];
  if (!fichiers.length) throw new ErreurHttp(400, "Aucun fichier recu (champ \xAB fichiers \xBB attendu)");
  const d = valider(
    import_zod13.z.object({
      compteId: import_zod13.z.coerce.number().int().positive(),
      posteId: import_zod13.z.coerce.number().int().positive().optional(),
      dossierId: import_zod13.z.coerce.number().int().positive().optional()
    }),
    req.body
  );
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const messages = [];
  const illisibles = [];
  for (const fichier of fichiers) {
    const bruts = /\.mbox$/i.test(fichier.originalname) ? decouperMbox(fichier.buffer) : [fichier.buffer];
    for (const brut of bruts) {
      try {
        messages.push(await analyserMessage(brut));
      } catch (e) {
        illisibles.push({ fichier: import_node_path4.default.basename(fichier.originalname), raison: messageErreur(e).slice(0, 200) });
      }
    }
  }
  const bilan = await enregistrerLot(
    messages,
    { compteId: d.compteId, posteId: d.posteId ?? null, dossierParDefautId: d.dossierId ?? null, source: "import" },
    auteurDe(req)
  );
  res.status(201).json({ bilan, illisibles });
});
routesCollecte.post("/relever", exigerRole("admin", "manager"), async (req, res) => {
  const d = valider(import_zod13.z.object({ compteId: import_zod13.z.number().int().positive(), limite: import_zod13.z.number().int().min(1).max(200).optional() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  const adaptateur = adaptateurCollecte();
  if (adaptateur.mode === "mock") {
    throw new ErreurHttp(409, "La collecte des mails est en mode simule : renseignez APPS_SCRIPT_SECRET ou IMAP_* pour l\u2019activer");
  }
  const messages = await adaptateur.relever(d.limite ?? 50);
  res.json({ mode: adaptateur.mode, bilan: await enregistrerLot(messages, { compteId: d.compteId }, auteurDe(req)) });
});
routesCollecte.get("/piece/:id", async (req, res) => {
  const id2 = idParam(req);
  const [ligne] = await db.select({ piece: schema_exports.pieces, compteId: schema_exports.dossiers.compteId }).from(schema_exports.pieces).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm27.eq)(schema_exports.dossiers.id, schema_exports.pieces.dossierId)).where((0, import_drizzle_orm27.eq)(schema_exports.pieces.id, id2));
  if (!ligne?.piece.chemin) throw new ErreurHttp(404, "Piece introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), ligne.compteId);
  if (!await fichierExiste(ligne.piece.chemin)) throw new ErreurHttp(404, "Fichier absent du stockage");
  const nom = (ligne.piece.nomFichier ?? "piece").replace(/["\\\r\n]/g, "_");
  res.setHeader("content-disposition", `attachment; filename="${nom}"`);
  res.setHeader("x-content-type-options", "nosniff");
  res.sendFile(cheminAbsolu(ligne.piece.chemin));
});
var routesWebhookCollecte = (0, import_express13.Router)();
routesWebhookCollecte.use((0, import_express_rate_limit4.default)({ windowMs: 6e4, limit: config.test ? 1e4 : 300, standardHeaders: true, legacyHeaders: false }));
routesWebhookCollecte.use(import_express14.default.text({ type: "*/*", limit: "25mb" }));
var chargeSchema = import_zod13.z.object({
  compteId: import_zod13.z.number().int().positive(),
  posteId: import_zod13.z.number().int().positive().nullish(),
  messages: import_zod13.z.array(
    import_zod13.z.object({
      /** Message complet au format RFC 5322, tel que Gmail le fournit. */
      brut: import_zod13.z.string().min(10).optional(),
      /** Ou bien les champs deja extraits par le script. */
      messageId: import_zod13.z.string().min(3).optional(),
      filId: import_zod13.z.string().optional(),
      expediteur: import_zod13.z.string().optional(),
      destinataires: import_zod13.z.array(import_zod13.z.string()).optional(),
      objet: import_zod13.z.string().optional(),
      corps: import_zod13.z.string().optional(),
      survenuLe: import_zod13.z.string().optional()
    })
  ).max(100)
});
routesWebhookCollecte.post("/", async (req, res) => {
  const secret = config.collecte.secretAppsScript;
  if (!secret) {
    res.status(503).json({ erreur: "Collecte Apps Script non configuree (APPS_SCRIPT_SECRET)" });
    return;
  }
  const corpsBrut = typeof req.body === "string" ? req.body : "";
  const signature = String(req.headers["x-azmg-signature"] ?? "");
  if (!verifierSignature(corpsBrut, signature, secret)) {
    journal.warn("Webhook de collecte refuse : signature invalide");
    res.status(401).json({ erreur: "Signature invalide" });
    return;
  }
  let charge2;
  try {
    charge2 = chargeSchema.parse(JSON.parse(corpsBrut));
  } catch (e) {
    res.status(400).json({ erreur: `Charge invalide : ${messageErreur(e).slice(0, 200)}` });
    return;
  }
  const messages = [];
  for (const m of charge2.messages) {
    if (m.brut) {
      messages.push(await analyserMessage(Buffer.from(m.brut, "utf8")));
      continue;
    }
    if (!m.messageId) continue;
    messages.push({
      messageId: m.messageId,
      filId: m.filId || m.messageId,
      expediteur: (m.expediteur ?? "").toLowerCase(),
      destinataires: (m.destinataires ?? []).map((d) => d.toLowerCase()),
      objet: m.objet ?? "",
      corps: m.corps ?? "",
      survenuLe: m.survenuLe ? new Date(m.survenuLe) : /* @__PURE__ */ new Date(),
      pieces: []
    });
  }
  const bilan = await enregistrerLot(messages, { compteId: charge2.compteId, posteId: charge2.posteId ?? null }, AUTEUR_SYSTEME);
  res.json({ bilan });
});

// src/server/modules/brouillons/routes.ts
var import_express15 = require("express");
var import_zod14 = require("zod");
var import_drizzle_orm29 = require("drizzle-orm");
init_client();
init_http();

// src/server/modules/brouillons/service.ts
var import_drizzle_orm28 = require("drizzle-orm");
var import_luxon8 = require("luxon");
init_client();
init_http();
init_evenements();
init_parametres2();
init_tirets();
init_heures_ouvrees();
init_constantes();
async function enregistrerBrouillon(entree, auteur) {
  const [deja] = await db.select().from(schema_exports.brouillons).where((0, import_drizzle_orm28.eq)(schema_exports.brouillons.cleUnicite, entree.cleUnicite));
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
async function deciderBrouillon(id2, statut, auteur) {
  const [maj] = await db.update(schema_exports.brouillons).set({ statut, decideLe: /* @__PURE__ */ new Date(), decideParId: auteur.utilisateurId, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm28.and)((0, import_drizzle_orm28.eq)(schema_exports.brouillons.id, id2), (0, import_drizzle_orm28.eq)(schema_exports.brouillons.statut, "prepare"))).returning();
  if (!maj) {
    const [existe] = await db.select({ statut: schema_exports.brouillons.statut }).from(schema_exports.brouillons).where((0, import_drizzle_orm28.eq)(schema_exports.brouillons.id, id2));
    if (!existe) throw new ErreurHttp(404, "Brouillon introuvable");
    throw new ErreurHttp(409, `Ce brouillon a deja ete traite (${existe.statut === "utilise" ? "envoye" : "ecarte"}).`);
  }
  await journaliser("brouillon_decide", {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: "brouillon",
    entiteId: id2,
    details: { statut, type: maj.type }
  });
  return maj;
}
async function listerBrouillons(compteId, opts = {}) {
  const conditions = [(0, import_drizzle_orm28.eq)(schema_exports.brouillons.compteId, compteId)];
  if (opts.statut) conditions.push((0, import_drizzle_orm28.eq)(schema_exports.brouillons.statut, opts.statut));
  if (opts.type) conditions.push((0, import_drizzle_orm28.eq)(schema_exports.brouillons.type, opts.type));
  return db.select({
    brouillon: schema_exports.brouillons,
    dossier: schema_exports.dossiers.libelle,
    objet: schema_exports.demandes.objet
  }).from(schema_exports.brouillons).leftJoin(schema_exports.dossiers, (0, import_drizzle_orm28.eq)(schema_exports.dossiers.id, schema_exports.brouillons.dossierId)).leftJoin(schema_exports.demandes, (0, import_drizzle_orm28.eq)(schema_exports.demandes.id, schema_exports.brouillons.demandeId)).where((0, import_drizzle_orm28.and)(...conditions)).orderBy((0, import_drizzle_orm28.desc)(schema_exports.brouillons.prepareLe)).limit(Math.min(opts.limite ?? 100, 300));
}
function langueDe(adresse2) {
  const domaine = (adresse2 ?? "").split("@")[1]?.toLowerCase() ?? "";
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
  const lignes = await db.select({ demande: schema_exports.demandes, dossier: schema_exports.dossiers.libelle }).from(schema_exports.demandes).innerJoin(schema_exports.dossiers, (0, import_drizzle_orm28.eq)(schema_exports.dossiers.id, schema_exports.demandes.dossierId)).where(
    (0, import_drizzle_orm28.and)(
      (0, import_drizzle_orm28.eq)(schema_exports.demandes.compteId, compteId),
      import_drizzle_orm28.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
      // Une relance ne concerne que ce qui attend quelqu'un d'autre que le poste.
      (0, import_drizzle_orm28.inArray)(schema_exports.demandes.statut, ["attente_tiers", "attente_do"])
    )
  );
  if (!lignes.length) return [];
  const horaires = await horairesDuCompte(compteId);
  const debuts = await debutsDeStatut3(lignes.map((l) => l.demande));
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
  const evenements2 = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm28.inArray)(schema_exports.evenements.demandeId, eligibles.map((e) => e.demande.id))).orderBy((0, import_drizzle_orm28.desc)(schema_exports.evenements.survenuLe));
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
      lignes.push(`  ${import_luxon8.DateTime.fromJSDate(fait.le).toFormat("dd/MM/yyyy")} : ${fait.resume}`);
    }
  }
  lignes.push("", f.attente(dureeLocalisee(relance.minutesAttente, langue, relance.minutesParJour)), "", f.fin);
  return retirerTiretsLongs(lignes.join("\n"));
}
async function preparerRelances(compteId, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const aPreparer = await relancesAPreparer(compteId, maintenant);
  const jour = import_luxon8.DateTime.fromJSDate(maintenant).toISODate();
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
  const date2 = import_luxon8.DateTime.fromISO(jour).toFormat("dd/MM/yyyy");
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
  const reference = import_luxon8.DateTime.fromISO(jourDansLaSemaine);
  const onglet = nomOngletSemaine(reference.weekNumber, reference.weekYear);
  const colonnes = [];
  for (let jourSemaine = 1; jourSemaine <= 5; jourSemaine++) {
    const jour = reference.set({ weekday: jourSemaine }).toISODate();
    colonnes.push({
      jour,
      libelle: import_luxon8.DateTime.fromISO(jour).setLocale("fr").toFormat("cccc dd/MM"),
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
function complementActeur(acteur) {
  switch (acteur) {
    case "poste":
      return "de notre cote";
    case "do":
      return "de la validation de la donneuse d\u2019ordre";
    case "client":
      return "de votre retour";
    case "tiers":
      return "du retour d\u2019un tiers";
    default:
      return "de personne";
  }
}
async function preparerSituationClient(compteId, client, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const dossiers2 = await db.select().from(schema_exports.dossiers).where((0, import_drizzle_orm28.and)((0, import_drizzle_orm28.eq)(schema_exports.dossiers.compteId, compteId), (0, import_drizzle_orm28.eq)(schema_exports.dossiers.client, client))).orderBy((0, import_drizzle_orm28.asc)(schema_exports.dossiers.libelle));
  if (!dossiers2.length) throw new ErreurHttp(404, `Aucun dossier pour le client \xAB ${client} \xBB`);
  const horaires = await horairesDuCompte(compteId);
  const ids = dossiers2.map((d) => d.id);
  const toutesDemandes = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm28.and)((0, import_drizzle_orm28.inArray)(schema_exports.demandes.dossierId, ids), import_drizzle_orm28.sql`${schema_exports.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`)).orderBy((0, import_drizzle_orm28.desc)(schema_exports.demandes.ouverteLe));
  const debuts = await debutsDeStatut3(toutesDemandes);
  const prochaines = toutesDemandes.length ? await db.select().from(schema_exports.echeances).where(
    (0, import_drizzle_orm28.and)(
      (0, import_drizzle_orm28.inArray)(schema_exports.echeances.dossierId, ids),
      (0, import_drizzle_orm28.eq)(schema_exports.echeances.annulee, false),
      import_drizzle_orm28.sql`${schema_exports.echeances.honoreeLe} IS NULL`
    )
  ).orderBy((0, import_drizzle_orm28.asc)(schema_exports.echeances.echeanceLe)) : [];
  const derniersEvenements = await db.select({ id: schema_exports.evenements.id, dossierId: schema_exports.evenements.dossierId }).from(schema_exports.evenements).where((0, import_drizzle_orm28.inArray)(schema_exports.evenements.dossierId, ids)).orderBy((0, import_drizzle_orm28.desc)(schema_exports.evenements.survenuLe));
  const parDossier = (liste) => {
    const carte = /* @__PURE__ */ new Map();
    for (const item of liste) {
      if (item.dossierId === null) continue;
      const deja = carte.get(item.dossierId) ?? [];
      deja.push(item);
      carte.set(item.dossierId, deja);
    }
    return carte;
  };
  const demandesParDossier = parDossier(toutesDemandes);
  const echeancesParDossier = parDossier(prochaines);
  const evenementsParDossier = parDossier(derniersEvenements);
  const lignes = [];
  const sources = [];
  const donnees = [];
  for (const dossier of dossiers2) {
    const demandes2 = demandesParDossier.get(dossier.id) ?? [];
    if (!demandes2.length) continue;
    const ouvertes = demandes2.filter((d) => d.statut !== "termine" && d.statut !== "annule");
    const porteuse = ouvertes[0] ?? demandes2[0];
    const temps = tempsDemandeAvecHoraires(porteuse, debuts.get(porteuse.id) ?? porteuse.ouverteLe, horaires, maintenant);
    const echeance = (echeancesParDossier.get(dossier.id) ?? [])[0];
    const prochaine = echeance ? `${echeance.libelle ?? LIBELLES_ECHEANCES[echeance.type] ?? echeance.type} le ${import_luxon8.DateTime.fromJSDate(echeance.echeanceLe).toFormat("dd/MM/yyyy")}` : null;
    lignes.push(
      [
        `${dossier.libelle}`,
        `  Etat : ${statutReporting(porteuse.statut)}${porteuse.statut === "attente_do" ? " (validation DO attendue)" : ""}`,
        `  En cours : ${porteuse.objet}`,
        ouvertes.length > 1 ? `  Autres points ouverts : ${ouvertes.length - 1}` : null,
        `  En attente ${complementActeur(porteuse.acteurAttendu)} depuis ${formaterDuree(temps.statutCourant)}`,
        prochaine ? `  Prochaine echeance : ${prochaine}` : null
      ].filter(Boolean).join("\n")
    );
    donnees.push({ dossierId: dossier.id, libelle: dossier.libelle, statut: statutReporting(porteuse.statut), ouvertes: ouvertes.length });
    sources.push(...(evenementsParDossier.get(dossier.id) ?? []).slice(0, 3).map((e) => e.id));
  }
  if (!lignes.length) throw new ErreurHttp(404, `Aucune demande en perimetre pour le client \xAB ${client} \xBB`);
  const date2 = import_luxon8.DateTime.fromJSDate(maintenant).setLocale("fr").toFormat("dd/MM/yyyy");
  const contenu = [`Situation ${client} au ${date2}`, "", ...lignes, "", "Brouillon a relire avant envoi."].join("\n\n");
  const { cree, brouillon } = await enregistrerBrouillon(
    {
      compteId,
      type: "situation_client",
      titre: `Situation ${client} au ${date2}`,
      contenu,
      donnees: { client, dossiers: donnees },
      sources: [...new Set(sources)],
      cleUnicite: `situation:${compteId}:${client}:${import_luxon8.DateTime.fromJSDate(maintenant).toISODate()}`
    },
    auteur
  );
  return { cree, brouillon };
}
function extraireOffre(texte2, evenementId, transitaire, recuLe) {
  const t = texte2.replace(/\s+/g, " ");
  const prix = /(\d[\d\s.,]{1,12})\s*(eur|euros?|usd|dollars?|\$|€)/i.exec(t);
  const devise = prix ? normaliserDevise(prix[2]) : null;
  const cutOff = /cut[\s-]?off[^.]{0,40}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const etd = /\betd\b[^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const eta = /\beta\b[^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const transit = /transit[^.]{0,20}?(\d{1,3})\s*(jours?|days?|j\b)/i.exec(t);
  const validite = /validit[ey][^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,3}\s*jours?)/i.exec(t);
  return {
    evenementId,
    transitaire,
    prix: prix ? prix[1].trim().replace(/\s/g, " ") : null,
    devise,
    cutOff: cutOff ? cutOff[1] : null,
    etd: etd ? etd[1] : null,
    eta: eta ? eta[1] : null,
    transit: transit ? `${transit[1]} jours` : null,
    validite: validite ? validite[1] : null,
    recuLe
  };
}
function normaliserDevise(brut) {
  const v = brut.toLowerCase();
  if (v.startsWith("eur") || v === "\u20AC") return "EUR";
  if (v.startsWith("usd") || v.startsWith("dollar") || v === "$") return "USD";
  return brut.toUpperCase();
}
async function preparerComparatifCotations(dossierId, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const [dossier] = await db.select().from(schema_exports.dossiers).where((0, import_drizzle_orm28.eq)(schema_exports.dossiers.id, dossierId));
  if (!dossier) throw new ErreurHttp(404, "Dossier introuvable");
  const evenements2 = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm28.and)((0, import_drizzle_orm28.eq)(schema_exports.evenements.dossierId, dossierId), (0, import_drizzle_orm28.eq)(schema_exports.evenements.sens, "entrant"), (0, import_drizzle_orm28.eq)(schema_exports.evenements.famille, "T01"))).orderBy((0, import_drizzle_orm28.asc)(schema_exports.evenements.survenuLe));
  if (!evenements2.length) throw new ErreurHttp(404, "Aucune offre de fret recue sur ce dossier");
  const offres = evenements2.map(
    (e) => extraireOffre(`${e.objet ?? ""} ${e.contenu ?? e.resume ?? ""}`, e.id, (e.expediteur ?? "transitaire inconnu").split("@")[0], e.survenuLe)
  );
  const colonnes = ["Transitaire", "Prix", "Cut-off", "ETD", "ETA", "Transit", "Validite"];
  const lignes = offres.map((o) => [
    o.transitaire,
    o.prix ? `${o.prix}${o.devise ? ` ${o.devise}` : ""}` : "",
    o.cutOff ?? "",
    o.etd ?? "",
    o.eta ?? "",
    o.transit ?? "",
    o.validite ?? ""
  ]);
  const largeurs = colonnes.map((c, i) => Math.max(c.length, ...lignes.map((l) => l[i].length)));
  const ligneTexte = (cellules) => cellules.map((c, i) => c.padEnd(largeurs[i])).join("  ").trimEnd();
  const manquants = offres.filter((o) => !o.prix).length;
  const contenu = [
    `Comparatif des cotations : ${dossier.libelle}`,
    `Au ${import_luxon8.DateTime.fromJSDate(maintenant).toFormat("dd/MM/yyyy")}, ${offres.length} offre(s) recue(s).`,
    "",
    ligneTexte(colonnes),
    largeurs.map((l) => "-".repeat(l)).join("  "),
    ...lignes.map(ligneTexte),
    "",
    manquants ? `${manquants} offre(s) sans prix lisible : les cases vides sont a completer a la main, rien n'a ete devine.` : "Tous les prix ont ete lus dans les messages recus.",
    "",
    "Brouillon a relire. Le choix du transitaire et du prix revient a la DO."
  ].join("\n");
  const { cree, brouillon } = await enregistrerBrouillon(
    {
      compteId: dossier.compteId,
      type: "comparatif_cotations",
      dossierId,
      titre: `Comparatif des cotations : ${dossier.libelle}`,
      contenu,
      donnees: { offres, colonnes },
      sources: offres.map((o) => o.evenementId),
      cleUnicite: `comparatif:${dossierId}:${offres.length}:${offres.map((o) => o.evenementId).join("-")}`
    },
    auteur
  );
  return { cree, brouillon, offres };
}
async function preparerLeMatin(compteId, auteur, maintenant = /* @__PURE__ */ new Date()) {
  const parametres2 = await lireParametres();
  if (parametres2.pauseAutomatisations) return { ignore: true, raison: "automatisations en pause" };
  const bilan = { relances: 0, daily: 0, semaine: 0 };
  if (parametres2.automatisations.relances?.actif !== false) {
    bilan.relances = (await preparerRelances(compteId, auteur, maintenant)).crees;
  }
  if (parametres2.automatisations.daily?.actif !== false) {
    const veille = import_luxon8.DateTime.fromJSDate(maintenant).minus({ days: 1 }).toISODate();
    if ((await preparerDaily(compteId, veille, auteur)).cree) bilan.daily++;
    if (import_luxon8.DateTime.fromJSDate(maintenant).weekday === 1) {
      if ((await preparerSemaine(compteId, veille, auteur)).cree) bilan.semaine++;
    }
  }
  return { ignore: false, ...bilan };
}
async function debutsDeStatut3(demandes2) {
  if (!demandes2.length) return /* @__PURE__ */ new Map();
  const lignes = await db.select({ demandeId: schema_exports.transitionsStatut.demandeId, debut: import_drizzle_orm28.sql`max(${schema_exports.transitionsStatut.survenuLe})`.as("debut") }).from(schema_exports.transitionsStatut).where((0, import_drizzle_orm28.inArray)(schema_exports.transitionsStatut.demandeId, demandes2.map((d) => d.id))).groupBy(schema_exports.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}
async function evenementsDuJour(compteId, jour) {
  const debut = import_luxon8.DateTime.fromISO(jour, { zone: "utc" }).startOf("day").toJSDate();
  const fin = import_luxon8.DateTime.fromISO(jour, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const lignes = await db.select({ id: schema_exports.evenements.id }).from(schema_exports.evenements).where(
    (0, import_drizzle_orm28.and)(
      (0, import_drizzle_orm28.eq)(schema_exports.evenements.compteId, compteId),
      (0, import_drizzle_orm28.gte)(schema_exports.evenements.survenuLe, debut),
      (0, import_drizzle_orm28.lt)(schema_exports.evenements.survenuLe, fin),
      import_drizzle_orm28.sql`coalesce(${schema_exports.evenements.famille}, '') <> ${FAMILLE_HORS_PERIMETRE}`
    )
  ).limit(200);
  return lignes.map((l) => l.id);
}

// src/server/modules/brouillons/routes.ts
var typeSchema = import_zod14.z.enum(["relance", "daily", "semaine", "situation_client", "comparatif_cotations"]);
var jourSchema2 = import_zod14.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
var routesBrouillons = (0, import_express15.Router)();
routesBrouillons.use(exigerConnexion);
routesBrouillons.get("/", async (req, res) => {
  const q = valider(
    import_zod14.z.object({
      compteId: import_zod14.z.coerce.number().int().positive(),
      statut: import_zod14.z.enum(["prepare", "utilise", "ecarte"]).optional(),
      type: typeSchema.optional(),
      limite: import_zod14.z.coerce.number().int().min(1).max(300).optional()
    }),
    req.query
  );
  exigerCompte(await perimetreDe(req.utilisateur), q.compteId);
  res.json(await listerBrouillons(q.compteId, { statut: q.statut ?? "prepare", type: q.type, limite: q.limite }));
});
routesBrouillons.get("/relances-a-preparer", async (req, res) => {
  const q = valider(import_zod14.z.object({ compteId: import_zod14.z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur), q.compteId);
  const relances = await relancesAPreparer(q.compteId);
  res.json(
    relances.map((r) => ({
      demandeId: r.demande.id,
      objet: r.demande.objet,
      dossier: r.dossier,
      niveau: r.niveau,
      minutesAttente: r.minutesAttente,
      destinataire: r.destinataire,
      sources: r.sources
    }))
  );
});
routesBrouillons.post("/relances", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ compteId: import_zod14.z.number().int().positive() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  res.status(201).json(await preparerRelances(d.compteId, auteurDe(req)));
});
routesBrouillons.post("/daily", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ compteId: import_zod14.z.number().int().positive(), jour: jourSchema2 }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  res.status(201).json(await preparerDaily(d.compteId, d.jour, auteurDe(req)));
});
routesBrouillons.post("/semaine", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ compteId: import_zod14.z.number().int().positive(), jour: jourSchema2 }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  res.status(201).json(await preparerSemaine(d.compteId, d.jour, auteurDe(req)));
});
routesBrouillons.post("/situation-client", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ compteId: import_zod14.z.number().int().positive(), client: import_zod14.z.string().trim().min(1).max(200) }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  res.status(201).json(await preparerSituationClient(d.compteId, d.client, auteurDe(req)));
});
routesBrouillons.post("/comparatif-cotations", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ dossierId: import_zod14.z.number().int().positive() }), req.body);
  const [dossier] = await db.select({ compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm29.eq)(schema_exports.dossiers.id, d.dossierId));
  if (!dossier) throw new ErreurHttp(404, "Dossier introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), dossier.compteId);
  res.status(201).json(await preparerComparatifCotations(d.dossierId, auteurDe(req)));
});
routesBrouillons.post("/matin", exigerEcriture, async (req, res) => {
  const d = valider(import_zod14.z.object({ compteId: import_zod14.z.number().int().positive() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur), d.compteId);
  res.status(201).json(await preparerLeMatin(d.compteId, auteurDe(req)));
});
routesBrouillons.post("/:id/decision", exigerEcriture, async (req, res) => {
  const id2 = idParam(req);
  const d = valider(import_zod14.z.object({ statut: import_zod14.z.enum(["utilise", "ecarte"]) }), req.body);
  const [brouillon] = await db.select({ compteId: schema_exports.brouillons.compteId }).from(schema_exports.brouillons).where((0, import_drizzle_orm29.eq)(schema_exports.brouillons.id, id2));
  if (!brouillon) throw new ErreurHttp(404, "Brouillon introuvable");
  exigerCompte(await perimetreDe(req.utilisateur), brouillon.compteId);
  res.json(await deciderBrouillon(id2, d.statut, auteurDe(req)));
});

// src/server/app.ts
function creerApplication() {
  const app2 = (0, import_express16.default)();
  app2.disable("x-powered-by");
  if (config.trustProxy) app2.set("trust proxy", 1);
  app2.use((0, import_compression.default)({ threshold: 1024 }));
  app2.use(
    (0, import_helmet.default)({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:", "blob:"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
          "script-src": ["'self'"],
          "frame-src": ["'self'"],
          "form-action": ["'self'"],
          "upgrade-insecure-requests": config.production ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.production ? void 0 : false
    })
  );
  const deploiement = lireCommitDeploye();
  app2.get("/health", async (_req, res) => {
    try {
      await getPool().query("SELECT 1");
      res.json({
        statut: "ok",
        service: "AZMG GPAO",
        version: "81919f835bf907cf7c6efb4fcb785a787c0fb20e",
        deploiement,
        migrations: await etatMigrations(),
        mcp: etatMcp()
      });
    } catch {
      res.status(503).json({ statut: "erreur", service: "AZMG GPAO" });
    }
  });
  const dossierPublic = [import_node_path5.default.join(__dirname, "public"), import_node_path5.default.join(config.racine, "src", "server", "public")].find((d) => import_node_fs2.default.existsSync(d));
  if (dossierPublic) app2.use("/public", import_express16.default.static(dossierPublic, { maxAge: config.production ? "7d" : 0 }));
  app2.use("/api/agent", routesAgent);
  app2.use("/api/collecte/apps-script", routesWebhookCollecte);
  app2.use("/mcp", routesMcp);
  app2.use("/.well-known", (req, res) => {
    noterAppel(req, 404, "decouverte OAuth");
    res.status(404).json({ erreur: "Introuvable" });
  });
  app2.use(chargerSession);
  app2.use("/api", import_express16.default.json({ limit: "1mb" }));
  app2.use("/api/auth", routesAuth);
  app2.use("/api/utilisateurs", routesUtilisateurs);
  app2.use("/api/comptes", routesComptes);
  app2.use("/api/postes", routesPostes);
  app2.use("/api/parametres", routesParametres);
  app2.use("/api/referentiels", routesReferentiels);
  app2.use("/api/dossiers", routesDossiers);
  app2.use("/api/demandes", routesDemandes);
  app2.use("/api/evenements", routesEvenements);
  app2.use("/api/echeances", routesEcheances);
  app2.use("/api/saisie", routesSaisie);
  app2.use("/api/import", routesImport);
  app2.use("/api/indicateurs", routesIndicateurs);
  app2.use("/api/qualite", routesQualite);
  app2.use("/api/digest", routesDigest);
  app2.use("/api/export", routesExport);
  app2.use("/api/typage", routesTypage);
  app2.use("/api/collecte", routesCollecte);
  app2.use("/api/brouillons", routesBrouillons);
  app2.use("/api", (_req, res) => res.status(404).json({ erreur: "Route inconnue" }));
  const dossierWeb = import_node_path5.default.join(config.racine, "dist", "web");
  if (import_node_fs2.default.existsSync(dossierWeb)) {
    app2.use(import_express16.default.static(dossierWeb, { index: false, maxAge: config.production ? "30d" : 0 }));
    app2.get(/^\/(?!api\/|public\/).*/, (req, res, next) => {
      if (req.method !== "GET") return next();
      res.setHeader("cache-control", "no-cache");
      res.sendFile(import_node_path5.default.join(dossierWeb, "index.html"));
    });
  }
  app2.use(gestionErreurs);
  return app2;
}
function lireCommitDeploye() {
  try {
    return import_node_fs2.default.readFileSync(import_node_path5.default.join(config.racine, ".release-commit"), "utf8").trim();
  } catch {
    return null;
  }
}

// src/server/index.ts
init_config();
init_journal();

// src/server/taches-periodiques.ts
var import_drizzle_orm30 = require("drizzle-orm");
init_client();
init_journal();

// src/shared/dates.ts
var import_luxon9 = require("luxon");
init_heures_ouvrees();
function maintenantTana() {
  const dt = import_luxon9.DateTime.now().setZone(FUSEAU_TANA);
  return { jour: dt.toISODate(), heure: dt.hour, dt };
}

// src/server/taches-periodiques.ts
var CLE_VERROU = 7340242;
async function periodique(nom, periodicite, fn, forcer = false) {
  const [etat] = await db.select().from(schema_exports.cronRuns).where((0, import_drizzle_orm30.eq)(schema_exports.cronRuns.tache, nom));
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
  let erreur2 = null;
  let resultat;
  try {
    resultat = await fn();
  } catch (e) {
    statut = "echec";
    erreur2 = messageErreur(e).slice(0, 1e3);
    journal.error("Tache periodique en echec", { tache: nom, erreur: erreur2 });
  }
  const valeurs = {
    dernierPassageLe: maintenant,
    dernierStatut: statut,
    derniereErreur: erreur2,
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
    const comptes = await db.select({ id: schema_exports.comptesClients.id }).from(schema_exports.comptesClients).where((0, import_drizzle_orm30.eq)(schema_exports.comptesClients.actif, true));
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

// src/server/index.ts
if (config.production && (!config.sessionSecret || config.sessionSecret.length < 32)) {
  throw new Error("SESSION_SECRET absent ou trop court (32 caracteres minimum)");
}
var app = creerApplication();
var serveur = app.listen(config.port, () => {
  journal.info("AZMG GPAO demarre", { port: config.port, env: config.env, ia: config.ia.fournisseur, collecte: config.collecte.mode });
});
if (config.cronEnProcessus && !config.production) {
  setInterval(() => {
    tick({ budgetMs: 5e4 }).catch((e) => journal.error("Tick en echec", { erreur: String(e) }));
  }, 6e4);
}
process.on("SIGTERM", () => serveur.close());
//# sourceMappingURL=index.js.map
