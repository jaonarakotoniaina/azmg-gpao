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
var __copyProps = (to, from, except, desc5) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc5 = __getOwnPropDesc(from, key)) || desc5.enumerable });
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
var import_node_path2, config;
var init_config = __esm({
  "src/server/config.ts"() {
    "use strict";
    import_node_path2 = __toESM(require("node:path"));
    config = construire();
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
async function fermerDb() {
  if (pool) await pool.end();
  pool = null;
  instance = null;
}
async function migrer() {
  await (0, import_migrator.migrate)(getDb(), { migrationsFolder: import_node_path3.default.join(config.racine, "drizzle") });
}
var import_pg, import_node_postgres, import_migrator, import_node_path3, pool, instance, db;
var init_client = __esm({
  "src/server/db/client.ts"() {
    "use strict";
    import_pg = require("pg");
    import_node_postgres = require("drizzle-orm/node-postgres");
    import_migrator = require("drizzle-orm/node-postgres/migrator");
    import_node_path3 = __toESM(require("node:path"));
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
function masquer(texte) {
  return texte.replace(EMAIL, "[email]").replace(TELEPHONE, "[telephone]");
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
function estFerme(statut) {
  return STATUTS_FERMES.includes(statut);
}
var ROLES, FAMILLES, FAMILLES_PAR_METIER, CODES_FAMILLES, FAMILLE_HORS_PERIMETRE, FAMILLES_PILOTAGE, SENS, NATURES, DEFINITIONS_NATURES, INTERLOCUTEURS, LIBELLES_INTERLOCUTEURS, ACTEURS, DEFINITIONS_STATUTS, STATUTS_OUVERTS, STATUTS_FERMES, SOURCES, LIBELLES_SOURCES, TYPES_ECHEANCE, LIBELLES_ECHEANCES;
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
    ACTEURS = ["poste", "do", "client", "tiers", "aucun"];
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
    LIBELLES_SOURCES = {
      mail: "mail",
      whatsapp: "WhatsApp",
      vocal: "vocal WhatsApp",
      saisie: "saisie directe",
      import: "import"
    };
    TYPES_ECHEANCE = ["cut_off", "etd", "eta", "validite_offre", "expiration_document", "creneau_entrepot"];
    LIBELLES_ECHEANCES = {
      cut_off: "cut-off",
      etd: "ETD (depart prevu)",
      eta: "ETA (arrivee prevue)",
      validite_offre: "validite d\u2019offre",
      expiration_document: "expiration de document",
      creneau_entrepot: "creneau d\u2019entrepot"
    };
  }
});

// src/server/db/referentiel.ts
function entreesInitiales() {
  const entrees = [];
  FAMILLES.forEach(
    (f, i) => entrees.push({
      type: "famille",
      code: f.code,
      libelle: f.libelle,
      attributs: {
        validation: f.validation,
        horsPerimetre: Boolean(f.horsPerimetre),
        tempsStandardMinutes: f.tempsStandardMinutes,
        slaHeures: f.slaHeures
      },
      ordre: i
    })
  );
  DEFINITIONS_NATURES.forEach(
    (n, i) => entrees.push({ type: "nature", code: n.code, libelle: n.libelle, attributs: { sens: n.sens, effet: n.effet }, ordre: i })
  );
  DEFINITIONS_STATUTS.forEach(
    (s, i) => entrees.push({
      type: "statut",
      code: s.code,
      libelle: s.libelle,
      attributs: { reporting: s.reporting, mention: s.mention ?? null, acteur: s.acteur, fermee: s.fermee },
      ordre: i
    })
  );
  INTERLOCUTEURS.forEach((c, i) => entrees.push({ type: "interlocuteur", code: c, libelle: LIBELLES_INTERLOCUTEURS[c], attributs: {}, ordre: i }));
  SOURCES.forEach((c, i) => entrees.push({ type: "source", code: c, libelle: LIBELLES_SOURCES[c], attributs: {}, ordre: i }));
  TYPES_ECHEANCE.forEach((c, i) => entrees.push({ type: "echeance", code: c, libelle: LIBELLES_ECHEANCES[c], attributs: {}, ordre: i }));
  return entrees;
}
async function initialiserReferentiel() {
  const entrees = entreesInitiales();
  let ajoutees = 0;
  for (const e of entrees) {
    const [existe] = await db.select({ id: schema_exports.referentiels.id }).from(schema_exports.referentiels).where((0, import_drizzle_orm2.and)((0, import_drizzle_orm2.eq)(schema_exports.referentiels.type, e.type), (0, import_drizzle_orm2.eq)(schema_exports.referentiels.code, e.code)));
    if (existe) continue;
    await db.insert(schema_exports.referentiels).values(e).onConflictDoNothing();
    ajoutees++;
  }
  return { ajoutees };
}
async function initialiserChecklistsEtGrilles(compteId = null) {
  for (const c of CHECKLISTS_INITIALES) {
    const [existe] = await db.select({ id: schema_exports.checklists.id }).from(schema_exports.checklists).where((0, import_drizzle_orm2.eq)(schema_exports.checklists.code, c.code));
    if (existe) continue;
    await db.insert(schema_exports.checklists).values({ compteId, code: c.code, libelle: c.libelle, points: c.points, familles: c.familles });
  }
  for (const g of GRILLES_INITIALES) {
    const [existe] = await db.select({ id: schema_exports.grillesQualite.id }).from(schema_exports.grillesQualite).where((0, import_drizzle_orm2.eq)(schema_exports.grillesQualite.code, g.code));
    if (existe) continue;
    await db.insert(schema_exports.grillesQualite).values({ compteId, code: g.code, libelle: g.libelle, criteres: g.criteres, familles: g.familles });
  }
}
var import_drizzle_orm2, CHECKLISTS_INITIALES, GRILLES_INITIALES;
var init_referentiel = __esm({
  "src/server/db/referentiel.ts"() {
    "use strict";
    import_drizzle_orm2 = require("drizzle-orm");
    init_client();
    init_constantes();
    CHECKLISTS_INITIALES = [
      {
        code: "documents_expedition",
        libelle: "Documents d'expedition",
        familles: ["T02", "T03"],
        points: [
          { cle: "facture_packing", libelle: "Facture et packing list joints ensemble", obligatoire: true },
          { cle: "nif_client", libelle: "NIF du client present sur AWB et BL", obligatoire: true },
          { cle: "validation_avant_original", libelle: "Validation du client obtenue avant emission d'un original", obligatoire: true },
          { cle: "photo_shipping_mark", libelle: "Photo du shipping mark prise avant depart", obligatoire: true },
          { cle: "scan_bl", libelle: "Scan du BL joint au dossier", obligatoire: true },
          { cle: "pieces_archivees", libelle: "Pieces archivees dans le dossier serveur", obligatoire: true }
        ]
      },
      {
        code: "cotation_fret",
        libelle: "Cotation de fret envoyee au client",
        familles: ["T01"],
        points: [
          { cle: "prix_valide_do", libelle: "Prix valide par la DO", obligatoire: true },
          { cle: "validite_offre", libelle: "Date de validite de l'offre indiquee", obligatoire: true },
          { cle: "cutoff_etd", libelle: "Cut-off et ETD indiques", obligatoire: true },
          { cle: "incoterm", libelle: "Incoterm precise", obligatoire: false }
        ]
      },
      {
        code: "facture_proforma",
        libelle: "Proforma ou facture envoyee",
        familles: ["T03"],
        points: [
          { cle: "modification_validee", libelle: "Chaque modification validee par la DO", obligatoire: true },
          { cle: "coordonnees_bancaires", libelle: "Coordonnees bancaires verifiees", obligatoire: true },
          { cle: "reference_dossier", libelle: "Reference du dossier reportee", obligatoire: true }
        ]
      }
    ];
    GRILLES_INITIALES = [
      {
        code: "envoi_standard",
        libelle: "Qualite d\u2019un envoi du poste",
        familles: [],
        criteres: [
          { cle: "exactitude", libelle: "Exactitude des references et des montants", poids: 30 },
          { cle: "completude", libelle: "Completude des pieces attendues", poids: 25 },
          { cle: "delai", libelle: "Respect du delai annonce", poids: 20 },
          { cle: "redaction", libelle: "Redaction claire dans la langue de l\u2019interlocuteur", poids: 15 },
          { cle: "tracabilite", libelle: "Tracabilite dans le dossier (pieces archivees)", poids: 10 }
        ]
      }
    ];
  }
});

// src/server/lib/http.ts
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
var import_zod, heure, jourIso, plageSchema, horairesSchema, MODES_AUTOMATISATION, AUTOMATISATIONS, parametresSchema;
var init_parametres = __esm({
  "src/shared/parametres.ts"() {
    "use strict";
    import_zod = require("zod");
    init_constantes();
    init_heures_ouvrees();
    heure = import_zod.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");
    jourIso = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
    plageSchema = import_zod.z.object({ debut: heure, fin: heure });
    horairesSchema = import_zod.z.object({
      fuseau: import_zod.z.string().min(1),
      semaine: import_zod.z.record(import_zod.z.string().regex(/^[1-7]$/, "Jour ISO attendu entre 1 et 7"), import_zod.z.array(plageSchema)),
      feriesClient: import_zod.z.array(jourIso),
      feriesLocaux: import_zod.z.array(jourIso),
      feriesCollaborateur: import_zod.z.boolean()
    });
    MODES_AUTOMATISATION = ["auto", "brouillon", "manuel"];
    AUTOMATISATIONS = [
      { cle: "relances", libelle: "Preparation des relances N1, N2 et N3", defaut: "brouillon" },
      { cle: "digest_do", libelle: "Digest de validation pour la DO", defaut: "brouillon" },
      { cle: "daily", libelle: "Reporting quotidien", defaut: "brouillon" },
      { cle: "typage_ia", libelle: "Typage des evenements par l\u2019IA", defaut: "auto" },
      { cle: "echantillon_qualite", libelle: "Tirage de l\u2019echantillon qualite hebdomadaire", defaut: "auto" }
    ];
    parametresSchema = import_zod.z.object({
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
  const [ligne] = await db.select().from(schema_exports.parametres).where((0, import_drizzle_orm3.eq)(schema_exports.parametres.cle, CLE));
  const valeur = fusionner(ligne?.valeur);
  cache = { valeur, lu: Date.now() };
  return valeur;
}
async function horairesDuCompte(compteId) {
  const p = await lireParametres();
  if (!compteId) return p.horaires;
  const [compte] = await db.select({ horaires: schema_exports.comptesClients.horaires }).from(schema_exports.comptesClients).where((0, import_drizzle_orm3.eq)(schema_exports.comptesClients.id, compteId));
  const propres = compte?.horaires;
  if (!propres) return p.horaires;
  return { ...p.horaires, ...propres };
}
var import_drizzle_orm3, CLE, cache;
var init_parametres2 = __esm({
  "src/server/lib/parametres.ts"() {
    "use strict";
    import_drizzle_orm3 = require("drizzle-orm");
    init_client();
    init_parametres();
    CLE = "parametres";
    cache = null;
  }
});

// src/server/lib/securite.ts
function jetonAleatoire(octets = 24) {
  return import_node_crypto.default.randomBytes(octets).toString("base64url");
}
function sha256(donnee) {
  return import_node_crypto.default.createHash("sha256").update(donnee).digest("hex");
}
var import_node_crypto;
var init_securite = __esm({
  "src/server/lib/securite.ts"() {
    "use strict";
    import_node_crypto = __toESM(require("node:crypto"));
    init_config();
  }
});

// src/shared/tirets.ts
function retirerTiretsLongs(texte) {
  if (!TIRETS_LONGS.test(texte)) return texte;
  return texte.replace(/(\d)\s*[\u2012\u2013\u2014\u2015]\s*(\d)/g, "$1 \xE0 $2").replace(/^(\s*)[\u2012\u2013\u2014\u2015]\s*/gm, "$1- ").replace(/\s+[\u2012\u2013\u2014\u2015]\s+/g, ", ").replace(TIRETS_LONGS_G, "-");
}
function nettoyerProfondement(valeur) {
  if (typeof valeur === "string") return retirerTiretsLongs(valeur);
  if (Array.isArray(valeur)) return valeur.map((v) => nettoyerProfondement(v));
  if (valeur && typeof valeur === "object") {
    const sortie = {};
    for (const [cle, v] of Object.entries(valeur)) sortie[cle] = nettoyerProfondement(v);
    return sortie;
  }
  return valeur;
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
  const [deja] = await db.select().from(schema_exports.aiTasks).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(schema_exports.aiTasks.empreinteEntree, empreinte), (0, import_drizzle_orm4.eq)(schema_exports.aiTasks.statut, "traite"))).limit(1);
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
  const texte = corps.content?.find((c) => c.type === "text")?.text ?? "";
  const json = /\{[\s\S]*\}/.exec(texte)?.[0];
  if (!json) throw new Error("Reponse de l\u2019API sans objet JSON");
  return JSON.parse(json);
}
var import_drizzle_orm4, simulateurs, DUREE_VERROU_MS;
var init_service = __esm({
  "src/server/ai/service.ts"() {
    "use strict";
    import_drizzle_orm4 = require("drizzle-orm");
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
  const adresse = adresseNue(brut);
  if (!adresse || !liste?.length) return false;
  return liste.some((a) => adresseNue(a) === adresse);
}
function normaliserTypage(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@.]+/g, " ").replace(/\.(?![a-z0-9])/g, " ").replace(/(?<![a-z0-9])\./g, " ").replace(/\s+/g, " ").trim();
}
function domaineDe(adresse) {
  if (!adresse) return null;
  const m = /@([a-z0-9.-]+\.[a-z]{2,})/i.exec(adresse.trim());
  if (m) return m[1].toLowerCase();
  const nu = adresse.trim().toLowerCase();
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
var init_typage = __esm({
  "src/shared/typage.ts"() {
    "use strict";
  }
});

// src/server/modules/typage/regles.ts
function evaluerRegle(regle, message, texte, domaine) {
  if (regle.actif === false) return null;
  if (regle.sens && message.sens && regle.sens !== message.sens) return null;
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
  return signaux > 0 ? signaux : null;
}
function appliquerRegles(message, regles = REGLES_INITIALES) {
  const texte = texteDuMessage(message);
  if (!texte) return null;
  const domaine = domaineDe(message.expediteur);
  const correspondances = regles.map((regle) => ({ regle, signaux: evaluerRegle(regle, message, texte, domaine) })).filter((c) => c.signaux !== null).sort((a, b) => a.regle.priorite - b.regle.priorite || b.signaux - a.signaux);
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
  if (typage.interlocuteur || !message.adresseDo) return;
  if (estUneDe(message.expediteur, [message.adresseDo])) {
    typage.interlocuteur = "do";
    typage.justificatifs.push("message recu de l\u2019adresse de la donneuse d\u2019ordre");
    return;
  }
  if (message.destinataires?.some((d) => estUneDe(d, [message.adresseDo]))) {
    typage.interlocuteur = "do";
    typage.justificatifs.push("message adresse a la donneuse d\u2019ordre");
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
  sql: () => import_drizzle_orm5.sql,
  typerMessage: () => typerMessage
});
async function reglesActives(compteId) {
  const lignes = await db.select().from(schema_exports.reglesTypage).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.actif, true), (0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.proposee, false))).orderBy((0, import_drizzle_orm5.asc)(schema_exports.reglesTypage.priorite));
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
    const [existe] = await db.select({ id: schema_exports.reglesTypage.id }).from(schema_exports.reglesTypage).where((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.libelle, regle.libelle));
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
  const [evenement] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm5.eq)(schema_exports.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, "Evenement introuvable");
  const motsObjet = normaliserTypage(evenement.objet ?? "").split(" ").filter((m) => m.length >= 4 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m));
  const motsCles = [...new Set(motsObjet)].slice(0, 4);
  const domaineBrut = domaineDe(evenement.expediteur);
  const domaine = domaineBrut && !domaineBrut.includes("azmg-solutions") ? domaineBrut : null;
  if (!motsCles.length && !domaine) return null;
  const libelle = `Propose depuis \xAB ${(evenement.objet ?? "un evenement").slice(0, 60)} \xBB`;
  const [existe] = await db.select({ id: schema_exports.reglesTypage.id }).from(schema_exports.reglesTypage).where((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.libelle, libelle));
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
  const [maj] = await db.update(schema_exports.reglesTypage).set({ proposee: false, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.id, regleId)).returning();
  if (!maj) throw new ErreurHttp(404, "Regle introuvable");
  await journaliser("regle_acceptee", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "regle_typage", entiteId: regleId });
  return maj;
}
async function refuserRegle(regleId, auteur) {
  const [maj] = await db.update(schema_exports.reglesTypage).set({ actif: false, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.id, regleId)).returning();
  if (!maj) throw new ErreurHttp(404, "Regle introuvable");
  await journaliser("regle_refusee", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "regle_typage", entiteId: regleId });
  return maj;
}
async function reglesProposees(limite = 50) {
  return db.select().from(schema_exports.reglesTypage).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.proposee, true), (0, import_drizzle_orm5.eq)(schema_exports.reglesTypage.actif, true))).orderBy((0, import_drizzle_orm5.desc)(schema_exports.reglesTypage.creeLe)).limit(limite);
}
var import_drizzle_orm5, import_zod2, sortieTypageSchema, MOTS_VIDES;
var init_service2 = __esm({
  "src/server/modules/typage/service.ts"() {
    "use strict";
    import_drizzle_orm5 = require("drizzle-orm");
    import_zod2 = require("zod");
    init_client();
    init_http();
    init_evenements();
    init_parametres2();
    init_service();
    init_typer_evenement();
    init_regles();
    init_typage();
    init_constantes();
    sortieTypageSchema = import_zod2.z.object({
      famille: import_zod2.z.enum(CODES_FAMILLES),
      nature: import_zod2.z.enum(NATURES),
      sens: import_zod2.z.enum(SENS).optional(),
      interlocuteur: import_zod2.z.enum(INTERLOCUTEURS).nullish(),
      confiance: import_zod2.z.number().min(0).max(1),
      justificatifs: import_zod2.z.array(import_zod2.z.string().max(300)).max(4).default([])
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

// src/server/modules/auth/service.ts
var service_exports2 = {};
__export(service_exports2, {
  DUREE_SESSION_MS: () => DUREE_SESSION_MS,
  authentifier: () => authentifier,
  creerUtilisateur: () => creerUtilisateur,
  demanderReinitialisation: () => demanderReinitialisation,
  fermerSession: () => fermerSession,
  hacherMotDePasse: () => hacherMotDePasse,
  lireSession: () => lireSession,
  ouvrirSession: () => ouvrirSession,
  reinitialiserMotDePasse: () => reinitialiserMotDePasse,
  verifierMotDePasse: () => verifierMotDePasse
});
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
async function authentifier(email, motDePasse) {
  const [u] = await db.select().from(schema_exports.utilisateurs).where((0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) {
    empreinteFactice ??= await hacherMotDePasse("mot-de-passe-factice");
    await verifierMotDePasse(motDePasse, empreinteFactice);
    return null;
  }
  if (!await verifierMotDePasse(motDePasse, u.motDePasseHash)) return null;
  await db.update(schema_exports.utilisateurs).set({ derniereConnexionLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.id, u.id));
  return u;
}
async function ouvrirSession(utilisateurId) {
  const jeton = jetonAleatoire(32);
  const csrf = jetonAleatoire(24);
  await db.delete(schema_exports.sessions).where((0, import_drizzle_orm6.lt)(schema_exports.sessions.expireLe, /* @__PURE__ */ new Date()));
  await db.insert(schema_exports.sessions).values({ id: sha256(jeton), utilisateurId, jetonCsrf: csrf, expireLe: new Date(Date.now() + DUREE_SESSION_MS) });
  return { jeton, csrf };
}
async function lireSession(jeton) {
  if (!jeton) return null;
  const [ligne] = await db.select({ session: schema_exports.sessions, utilisateur: schema_exports.utilisateurs }).from(schema_exports.sessions).innerJoin(schema_exports.utilisateurs, (0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.id, schema_exports.sessions.utilisateurId)).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(schema_exports.sessions.id, sha256(jeton)), (0, import_drizzle_orm6.gt)(schema_exports.sessions.expireLe, /* @__PURE__ */ new Date()), (0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.actif, true)));
  if (!ligne) return null;
  if (ligne.session.expireLe.getTime() - Date.now() < DUREE_SESSION_MS / 2) {
    await db.update(schema_exports.sessions).set({ expireLe: new Date(Date.now() + DUREE_SESSION_MS) }).where((0, import_drizzle_orm6.eq)(schema_exports.sessions.id, ligne.session.id));
  }
  return {
    utilisateur: { id: ligne.utilisateur.id, email: ligne.utilisateur.email, nom: ligne.utilisateur.nom, role: ligne.utilisateur.role },
    csrf: ligne.session.jetonCsrf
  };
}
async function fermerSession(jeton) {
  if (jeton) await db.delete(schema_exports.sessions).where((0, import_drizzle_orm6.eq)(schema_exports.sessions.id, sha256(jeton)));
}
async function demanderReinitialisation(email) {
  const [u] = await db.select().from(schema_exports.utilisateurs).where((0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) return null;
  const jeton = jetonAleatoire(32);
  await db.insert(schema_exports.reinitialisations).values({ utilisateurId: u.id, jetonHash: sha256(jeton), expireLe: new Date(Date.now() + 36e5) });
  return jeton;
}
async function reinitialiserMotDePasse(jeton, motDePasse) {
  const [r] = await db.select().from(schema_exports.reinitialisations).where(
    (0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(schema_exports.reinitialisations.jetonHash, sha256(jeton)),
      (0, import_drizzle_orm6.isNull)(schema_exports.reinitialisations.utiliseLe),
      (0, import_drizzle_orm6.gt)(schema_exports.reinitialisations.expireLe, /* @__PURE__ */ new Date())
    )
  );
  if (!r) return false;
  await db.update(schema_exports.utilisateurs).set({ motDePasseHash: await hacherMotDePasse(motDePasse), majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm6.eq)(schema_exports.utilisateurs.id, r.utilisateurId));
  await db.update(schema_exports.reinitialisations).set({ utiliseLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm6.eq)(schema_exports.reinitialisations.id, r.id));
  await db.delete(schema_exports.sessions).where((0, import_drizzle_orm6.eq)(schema_exports.sessions.utilisateurId, r.utilisateurId));
  return true;
}
var import_node_crypto2, import_hash_wasm, import_drizzle_orm6, DUREE_SESSION_MS, empreinteFactice;
var init_service3 = __esm({
  "src/server/modules/auth/service.ts"() {
    "use strict";
    import_node_crypto2 = __toESM(require("node:crypto"));
    import_hash_wasm = require("hash-wasm");
    import_drizzle_orm6 = require("drizzle-orm");
    init_client();
    init_securite();
    DUREE_SESSION_MS = 12 * 36e5;
    empreinteFactice = null;
  }
});

// src/shared/texte.ts
function normaliser(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function cleDossier(client, produit, operation) {
  return [client, produit, operation].map(normaliser).filter(Boolean).join("|");
}
var init_texte = __esm({
  "src/shared/texte.ts"() {
    "use strict";
  }
});

// src/server/modules/comptes/service.ts
async function creerCompte(entree, auteur) {
  const code = (entree.code?.trim() || normaliser(entree.nom).replace(/ /g, "-")).slice(0, 60);
  if (!code) throw new ErreurHttp(400, "Le code du compte est obligatoire");
  const [existe] = await db.select({ id: schema_exports.comptesClients.id }).from(schema_exports.comptesClients).where((0, import_drizzle_orm7.eq)(schema_exports.comptesClients.code, code));
  if (existe) throw new ErreurHttp(409, `Un compte client existe deja avec le code \xAB ${code} \xBB`);
  const [compte] = await db.insert(schema_exports.comptesClients).values({
    nom: entree.nom.trim(),
    code,
    pays: entree.pays ?? null,
    ville: entree.ville ?? null,
    fuseau: entree.fuseau ?? "Europe/Madrid",
    donneurOrdreNom: entree.donneurOrdreNom ?? null,
    donneurOrdreEmail: entree.donneurOrdreEmail ?? null,
    managerId: entree.managerId ?? null,
    horaires: entree.horaires ?? null
  }).returning();
  await journaliser("compte_cree", { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: "compte", entiteId: compte.id, details: { code } });
  return compte;
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
var import_drizzle_orm7;
var init_service4 = __esm({
  "src/server/modules/comptes/service.ts"() {
    "use strict";
    import_drizzle_orm7 = require("drizzle-orm");
    init_client();
    init_http();
    init_evenements();
    init_texte();
    init_constantes();
  }
});

// src/server/modules/dossiers/service.ts
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
var import_drizzle_orm8;
var init_service5 = __esm({
  "src/server/modules/dossiers/service.ts"() {
    "use strict";
    import_drizzle_orm8 = require("drizzle-orm");
    init_client();
    init_http();
    init_evenements();
    init_texte();
    init_constantes();
  }
});

// src/server/modules/demandes/service.ts
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
var import_drizzle_orm9, AUTEUR_SYSTEME;
var init_service6 = __esm({
  "src/server/modules/demandes/service.ts"() {
    "use strict";
    import_drizzle_orm9 = require("drizzle-orm");
    init_client();
    init_http();
    init_evenements();
    init_parametres2();
    init_constantes();
    init_heures_ouvrees();
    AUTEUR_SYSTEME = { utilisateurId: null, type: "systeme" };
  }
});

// src/server/modules/evenements/service.ts
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
    const [deja] = await db.select().from(schema_exports.evenements).where((0, import_drizzle_orm10.eq)(schema_exports.evenements.messageId, entree.messageId));
    if (deja) {
      const demande2 = deja.demandeId ? await lireDemande(deja.demandeId) : null;
      return { evenement: deja, demande: demande2, demandeCreee: false, statutApplique: null, horsPerimetre: estHorsPerimetre(deja.famille) };
    }
  }
  let demande = entree.demandeId ? await lireDemande(entree.demandeId) : null;
  const dossierId = demande?.dossierId ?? entree.dossierId ?? null;
  if (!dossierId) throw new ErreurHttp(400, "Dossier introuvable pour cet evenement");
  const [dossier] = await db.select({ id: schema_exports.dossiers.id, compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm10.eq)(schema_exports.dossiers.id, dossierId));
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
      await db.update(schema_exports.demandes).set({ dernierEvenementLe: survenuLe, majLe: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm10.eq)(schema_exports.demandes.id, demande.id));
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
  const compteId = entree.dossierId ? (await db.select({ compteId: schema_exports.dossiers.compteId }).from(schema_exports.dossiers).where((0, import_drizzle_orm10.eq)(schema_exports.dossiers.id, entree.dossierId)))[0]?.compteId : void 0;
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
  const [demande] = await db.select().from(schema_exports.demandes).where((0, import_drizzle_orm10.eq)(schema_exports.demandes.id, id2));
  if (!demande) throw new ErreurHttp(404, "Demande introuvable");
  return demande;
}
var import_drizzle_orm10;
var init_service7 = __esm({
  "src/server/modules/evenements/service.ts"() {
    "use strict";
    import_drizzle_orm10 = require("drizzle-orm");
    init_client();
    init_http();
    init_evenements();
    init_service6();
    init_constantes();
  }
});

// src/server/db/seed.ts
var seed_exports = {};
__export(seed_exports, {
  seedDemo: () => seedDemo
});
function instant(jours) {
  return import_luxon2.DateTime.now().setZone(FUSEAU_CLIENT_DEFAUT).startOf("day").plus({ days: jours, hours: 10 }).toJSDate();
}
async function seedDemo() {
  await initialiserReferentiel();
  await initialiserChecklistsEtGrilles();
  const parEmail = /* @__PURE__ */ new Map();
  for (const u of UTILISATEURS_DEMO) {
    const [existe] = await db.select({ id: schema_exports.utilisateurs.id }).from(schema_exports.utilisateurs).where((0, import_drizzle_orm11.eq)(schema_exports.utilisateurs.email, u.email));
    if (existe) {
      parEmail.set(u.email, existe.id);
      continue;
    }
    const cree = await creerUtilisateur({ ...u, motDePasse: MOT_DE_PASSE_DEMO });
    parEmail.set(u.email, cree.id);
  }
  const bilan = { comptes: 0, postes: 0, dossiers: 0, demandes: 0, evenements: 0 };
  for (const c of COMPTES_DEMO) {
    const [existe] = await db.select().from(schema_exports.comptesClients).where((0, import_drizzle_orm11.eq)(schema_exports.comptesClients.code, c.code));
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
        managerId: parEmail.get("princy@azmg-solutions.com") ?? null
      },
      AUTEUR_SYSTEME
    );
    bilan.comptes++;
    const poste = await creerPoste({ compteId: compte.id, intitule: c.poste, collaborateurId: parEmail.get("elysa@azmg-solutions.com") ?? null }, AUTEUR_SYSTEME);
    bilan.postes++;
    const dossiers2 = [];
    for (const d of DOSSIERS_DEMO) {
      const { dossier } = await trouverOuCreerDossier({ compteId: compte.id, posteId: poste.id, ...d }, AUTEUR_SYSTEME);
      dossiers2.push(dossier.id);
      bilan.dossiers++;
    }
    const auteur = { utilisateurId: parEmail.get("elysa@azmg-solutions.com") ?? null, type: "humain" };
    for (const scenario of SCENARIOS) {
      let demandeId = null;
      for (const e of scenario.evenements) {
        const resultat = await ajouterEvenement(
          {
            demandeId,
            dossierId: dossiers2[scenario.dossier],
            sens: e.sens,
            nature: e.nature,
            famille: scenario.famille,
            interlocuteur: e.interlocuteur,
            source: "saisie",
            survenuLe: instant(e.jours),
            objet: scenario.objet,
            resume: e.resume
          },
          auteur
        );
        bilan.evenements++;
        if (resultat.demandeCreee) bilan.demandes++;
        if (resultat.demande) demandeId = resultat.demande.id;
        if ("cloturer" in e && e.cloturer && demandeId) {
          await changerStatut(demandeId, "termine", auteur, { motif: "dossier complet et archive", survenuLe: instant(e.jours) });
        }
        if ("bloquer" in e && e.bloquer && demandeId) {
          await changerStatut(demandeId, "bloque", auteur, { motif: "autorite injoignable", survenuLe: instant(e.jours) });
        }
      }
    }
    const aClasser = [
      {
        objet: "Suite a notre echange",
        resume: "Comme convenu, je reviens vers vous avec les elements.",
        expediteur: "contact@exemple-fictif.test",
        jours: -1
      },
      {
        objet: "Point sur le dossier",
        resume: "Quelques precisions apres notre appel de ce matin.",
        expediteur: "achats@client-fictif.test",
        jours: 0
      }
    ];
    for (const m of aClasser) {
      await ajouterEvenement(
        {
          dossierId: dossiers2[0],
          sens: "entrant",
          nature: "information",
          source: "mail",
          objet: m.objet,
          resume: m.resume,
          contenu: m.resume,
          expediteur: m.expediteur,
          survenuLe: instant(m.jours)
        },
        auteur,
        { typerAutomatiquement: true }
      );
      bilan.evenements++;
    }
    const echeancesDemo = [
      { dossier: 0, type: "cut_off", libelle: "Cut-off aerien", jours: 2 },
      { dossier: 0, type: "etd", libelle: "Depart prevu", jours: 3 },
      { dossier: 1, type: "eta", libelle: "Arrivee prevue a Tripoli", jours: 9 },
      { dossier: 2, type: "validite_offre", libelle: "Validite de la proforma", jours: 0 },
      { dossier: 4, type: "expiration_document", libelle: "Expiration du certificat de vente libre", jours: 21 }
    ];
    for (const e of echeancesDemo) {
      await db.insert(schema_exports.echeances).values({
        dossierId: dossiers2[e.dossier],
        type: e.type,
        libelle: e.libelle,
        echeanceLe: instant(e.jours)
      });
    }
  }
  return bilan;
}
var import_luxon2, import_drizzle_orm11, MOT_DE_PASSE_DEMO, COMPTES_DEMO, DOSSIERS_DEMO, SCENARIOS, UTILISATEURS_DEMO;
var init_seed = __esm({
  "src/server/db/seed.ts"() {
    "use strict";
    import_luxon2 = require("luxon");
    import_drizzle_orm11 = require("drizzle-orm");
    init_client();
    init_service3();
    init_service4();
    init_service5();
    init_service7();
    init_service6();
    init_referentiel();
    init_heures_ouvrees();
    MOT_DE_PASSE_DEMO = "DemoGpao2026!";
    COMPTES_DEMO = [
      {
        nom: "Masenz Group (demonstration)",
        code: "masenz-demo",
        pays: "Espagne",
        ville: "Barcelone",
        fuseau: FUSEAU_CLIENT_DEFAUT,
        donneurOrdreNom: "Responsable export (fictive)",
        donneurOrdreEmail: "do.demo@exemple-client.test",
        poste: "Assistante export et customer support"
      }
    ];
    DOSSIERS_DEMO = [
      { client: "Alpha Pharma", pays: "Algerie", produit: "Gelules vitamine C 180 kg", operation: "aerien vers Alger" },
      { client: "Beta Distrib", pays: "Libye", produit: "Sirop multivitamine 2 palettes", operation: "maritime LCL vers Tripoli" },
      { client: "Gamma Sante", pays: "Emirats arabes unis", produit: "Complement magnesium 400 kg", operation: "aerien vers Dubai" },
      { client: "Delta Medic", pays: "France", produit: "Comprimes zinc 90 kg", operation: "routier vers Lyon" },
      { client: "Epsilon Trade", pays: "Maroc", produit: "Huile de poisson 1 FCL", operation: "maritime FCL vers Casablanca" }
    ];
    SCENARIOS = [
      {
        dossier: 0,
        famille: "T01",
        objet: "Cotation fret aerien 180 kg vers Alger",
        evenements: [
          { jours: -6, sens: "entrant", nature: "demande_entrante", interlocuteur: "client", resume: "Le client demande une cotation aerienne pour 180 kg." },
          { jours: -6, sens: "sortant", nature: "envoi_livrable", interlocuteur: "transitaire", resume: "Demande de cotation envoyee a trois transitaires." },
          { jours: -4, sens: "entrant", nature: "reponse_tiers", interlocuteur: "transitaire", resume: "Deux offres recues, une troisieme attendue." },
          { jours: -3, sens: "sortant", nature: "demande_validation_do", interlocuteur: "do", resume: "Comparatif des deux offres transmis pour validation du transitaire et du prix." }
        ]
      },
      {
        dossier: 1,
        famille: "T02",
        objet: "Documents d\u2019expedition LCL vers Tripoli",
        evenements: [
          { jours: -9, sens: "entrant", nature: "consigne_do", interlocuteur: "do", resume: "Preparer le jeu de documents pour l\u2019expedition LCL." },
          { jours: -8, sens: "sortant", nature: "envoi_livrable", interlocuteur: "client", resume: "Projet de BL et packing list envoyes au client pour accord." },
          { jours: -5, sens: "entrant", nature: "reponse_tiers", interlocuteur: "client", resume: "Le client demande la correction du NIF sur le BL." },
          { jours: -4, sens: "sortant", nature: "envoi_livrable", interlocuteur: "client", resume: "BL corrige envoye, accord obtenu." },
          { jours: -2, sens: "interne", nature: "information", interlocuteur: "interne_azmg", resume: "Scan du BL archive dans le dossier.", cloturer: true }
        ]
      },
      {
        dossier: 2,
        famille: "T03",
        objet: "Proforma a modifier pour Gamma Sante",
        evenements: [
          { jours: -3, sens: "entrant", nature: "demande_entrante", interlocuteur: "client", resume: "Le client demande une proforma en dollars au lieu d\u2019euros." },
          { jours: -2, sens: "sortant", nature: "demande_validation_do", interlocuteur: "do", resume: "Modification de devise soumise a la validation de la DO." },
          { jours: -1, sens: "entrant", nature: "validation_do", interlocuteur: "do", resume: "La DO valide la proforma en dollars." }
        ]
      },
      {
        dossier: 3,
        famille: "T04",
        objet: "Relance du solde a payer",
        evenements: [
          { jours: -12, sens: "entrant", nature: "consigne_do", interlocuteur: "do", resume: "Suivre le reglement du solde et relancer le client." },
          { jours: -12, sens: "sortant", nature: "envoi_livrable", interlocuteur: "client", resume: "Facture definitive envoyee, solde attendu." },
          { jours: -7, sens: "sortant", nature: "relance_emise", interlocuteur: "client", resume: "Premiere relance sur le solde." },
          { jours: -3, sens: "sortant", nature: "relance_emise", interlocuteur: "client", resume: "Deuxieme relance, copie a la DO." }
        ]
      },
      {
        dossier: 4,
        famille: "T05",
        objet: "Legalisation du certificat de vente libre",
        evenements: [
          { jours: -15, sens: "entrant", nature: "consigne_do", interlocuteur: "do", resume: "Lancer la legalisation du certificat de vente libre." },
          { jours: -14, sens: "sortant", nature: "envoi_livrable", interlocuteur: "autorite", resume: "Dossier depose pour legalisation." },
          { jours: -5, sens: "entrant", nature: "relance_recue", interlocuteur: "client", resume: "Le client s\u2019inquiete du delai de legalisation." },
          { jours: -5, sens: "interne", nature: "information", interlocuteur: "interne_azmg", resume: "Autorite injoignable, dossier bloque en attente de creneau.", bloquer: true }
        ]
      },
      {
        dossier: 0,
        famille: "T14",
        objet: "Suivi du tracking express",
        evenements: [
          { jours: -1, sens: "entrant", nature: "demande_entrante", interlocuteur: "client", resume: "Le client demande le numero de suivi du colis echantillon." }
        ]
      },
      /** Hors perimetre : trace mais invisible dans le pilotage (regle T00). */
      {
        dossier: 3,
        famille: "T00",
        objet: "Newsletter d\u2019un salon professionnel",
        evenements: [{ jours: -2, sens: "entrant", nature: "information", interlocuteur: "prospect", resume: "Message promotionnel sans lien avec le poste." }]
      }
    ];
    UTILISATEURS_DEMO = [
      { email: "ceo@azmg-solutions.com", nom: "Jaona Rakotoniaina", role: "admin" },
      { email: "princy@azmg-solutions.com", nom: "Princy (manager de compte)", role: "manager" },
      { email: "elysa@azmg-solutions.com", nom: "Elysa (assistante export)", role: "collaborateur" }
    ];
  }
});

// src/server/charger-env.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var candidats = [process.env.AZMG_ENV_FILE, import_node_path.default.resolve(__dirname, "..", "..", ".env"), import_node_path.default.resolve(process.cwd(), ".env")].filter(Boolean);
var fichier = candidats.find((f) => import_node_fs.default.existsSync(f));
if (fichier && typeof process.loadEnvFile === "function" && !process.env.AZMG_ENV_CHARGE) {
  process.loadEnvFile(fichier);
  process.env.AZMG_ENV_CHARGE = "1";
}

// src/server/cli.ts
init_client();

// src/server/lib/file.ts
var import_drizzle_orm = require("drizzle-orm");
init_client();
init_journal();
init_evenements();
var gestionnaires = /* @__PURE__ */ new Map();
function enregistrerGestionnaire(type, fn) {
  gestionnaires.set(type, fn);
}
var DUREE_MAX_TRAITEMENT_MS = 2 * 6e4;

// src/server/modules/index.ts
init_journal();
enregistrerGestionnaire("ping", async (payload) => {
  journal.info("Tache ping traitee", { payload });
});

// src/server/cli.ts
init_referentiel();
init_service2();
init_config();
init_constantes();
async function principal() {
  const [commande, ...args] = process.argv.slice(2);
  if (commande === "migrate") {
    await migrer();
    const { ajoutees } = await initialiserReferentiel();
    await initialiserChecklistsEtGrilles();
    const regles = await initialiserRegles();
    console.log(`Migrations appliquees. Referentiels : ${ajoutees} entree(s), regles de typage : ${regles.ajoutees}.`);
  } else if (commande === "seed") {
    if (config.production && !process.env.FORCER_SEED) throw new Error("Le seed de demonstration est desactive en production.");
    const { seedDemo: seedDemo2 } = await Promise.resolve().then(() => (init_seed(), seed_exports));
    const bilan = await seedDemo2();
    console.log("Donnees de demonstration creees :", JSON.stringify(bilan));
  } else if (commande === "creer-admin" || commande === "creer-utilisateur") {
    const motDePasse = process.env.ADMIN_PASSWORD;
    if (!motDePasse || motDePasse.length < 10) throw new Error("ADMIN_PASSWORD manquant ou trop court (10 caracteres minimum)");
    let email;
    let role;
    let nom;
    if (commande === "creer-admin") {
      const [e, ...reste] = args;
      email = e ?? "";
      role = "admin";
      nom = reste.join(" ") || "Administrateur";
    } else {
      const [e, r, ...reste] = args;
      email = e ?? "";
      if (!ROLES.includes(r)) throw new Error(`Role inconnu : ${r}. Attendu : ${ROLES.join(", ")}`);
      role = r;
      nom = reste.join(" ") || email || "Utilisateur";
    }
    if (!email) throw new Error('Usage : ADMIN_PASSWORD=... npm run cli creer-admin email@domaine "Nom"');
    const { creerUtilisateur: creerUtilisateur2 } = await Promise.resolve().then(() => (init_service3(), service_exports2));
    await creerUtilisateur2({ email, nom, role, motDePasse });
    console.log(`Compte cree : ${email} (${role})`);
  } else {
    console.error("Commandes : migrate, seed, creer-admin, creer-utilisateur");
    process.exitCode = 1;
  }
}
principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}).finally(() => fermerDb());
//# sourceMappingURL=cli.js.map
