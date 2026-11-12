CREATE TABLE "ai_tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"version_prompt" text NOT NULL,
	"entree" jsonb NOT NULL,
	"empreinte_entree" text NOT NULL,
	"sortie" jsonb,
	"contexte" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"statut" text DEFAULT 'en_attente' NOT NULL,
	"priorite" integer DEFAULT 50 NOT NULL,
	"fournisseur" text,
	"essais" integer DEFAULT 0 NOT NULL,
	"essais_max" integer DEFAULT 3 NOT NULL,
	"erreur" text,
	"verrouille_jusqua" timestamp with time zone,
	"termine_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint,
	"code" text NOT NULL,
	"libelle" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"familles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comptes_clients" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"code" text NOT NULL,
	"pays" text,
	"ville" text,
	"fuseau" text DEFAULT 'Europe/Madrid' NOT NULL,
	"donneur_ordre_nom" text,
	"donneur_ordre_email" text,
	"manager_id" bigint,
	"horaires" jsonb,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comptes_clients_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "controles_envoi" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"demande_id" bigint NOT NULL,
	"checklist_id" bigint,
	"evenement_id" bigint,
	"reponses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conforme" boolean NOT NULL,
	"commentaire" text,
	"controle_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controles_qualite" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"grille_id" bigint,
	"demande_id" bigint NOT NULL,
	"semaine" text,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" numeric(5, 2),
	"reprise" boolean DEFAULT false NOT NULL,
	"bon_du_premier_coup" boolean,
	"commentaire" text,
	"controle_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"tache" text PRIMARY KEY NOT NULL,
	"dernier_passage_le" timestamp with time zone,
	"dernier_statut" text,
	"derniere_erreur" text,
	"duree_ms" integer,
	"derniere_periode" text
);
--> statement-breakpoint
CREATE TABLE "demandes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dossier_id" bigint NOT NULL,
	"compte_id" bigint NOT NULL,
	"poste_id" bigint,
	"famille" text NOT NULL,
	"objet" text NOT NULL,
	"origine" text DEFAULT 'saisie' NOT NULL,
	"statut" text DEFAULT 'nouveau' NOT NULL,
	"acteur_attendu" text DEFAULT 'poste' NOT NULL,
	"priorite" text DEFAULT 'normale' NOT NULL,
	"echeance_le" timestamp with time zone,
	"sla_heures" double precision,
	"sla_echeance_le" timestamp with time zone,
	"niveau_relance" integer DEFAULT 0 NOT NULL,
	"derniere_relance_le" timestamp with time zone,
	"ouverte_le" timestamp with time zone DEFAULT now() NOT NULL,
	"premiere_reponse_le" timestamp with time zone,
	"dernier_evenement_le" timestamp with time zone,
	"terminee_le" timestamp with time zone,
	"minutes_par_statut" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"minutes_par_acteur" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"cree_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint NOT NULL,
	"poste_id" bigint,
	"client" text NOT NULL,
	"pays" text,
	"produit" text,
	"operation" text,
	"cle_rapprochement" text NOT NULL,
	"libelle" text NOT NULL,
	"statut" text DEFAULT 'ouvert' NOT NULL,
	"resume" text,
	"references" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"montants_approuves" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"cloture_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "echeances" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dossier_id" bigint NOT NULL,
	"demande_id" bigint,
	"type" text NOT NULL,
	"libelle" text,
	"echeance_le" timestamp with time zone NOT NULL,
	"phrase_source" text,
	"honoree_le" timestamp with time zone,
	"annulee" boolean DEFAULT false NOT NULL,
	"cree_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evenements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"demande_id" bigint,
	"dossier_id" bigint,
	"compte_id" bigint NOT NULL,
	"sens" text NOT NULL,
	"famille" text,
	"nature" text NOT NULL,
	"interlocuteur" text,
	"source" text NOT NULL,
	"fil_id" text,
	"message_id" text,
	"survenu_le" timestamp with time zone NOT NULL,
	"objet" text,
	"resume" text,
	"contenu" text,
	"confiance_typage" double precision,
	"corrige_par_id" bigint,
	"corrige_le" timestamp with time zone,
	"justificatifs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cree_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grilles_qualite" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint,
	"code" text NOT NULL,
	"libelle" text NOT NULL,
	"familles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criteres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint NOT NULL,
	"nom_fichier" text NOT NULL,
	"empreinte" text NOT NULL,
	"bilan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"jour_debut" date,
	"jour_fin" date,
	"importe_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"statut" text DEFAULT 'pending' NOT NULL,
	"priorite" integer DEFAULT 50 NOT NULL,
	"executer_a" timestamp with time zone DEFAULT now() NOT NULL,
	"essais" integer DEFAULT 0 NOT NULL,
	"essais_max" integer DEFAULT 5 NOT NULL,
	"derniere_erreur" text,
	"cle_dedoublonnage" text,
	"verrouille_le" timestamp with time zone,
	"verrouille_par" text,
	"termine_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_queue_cle_dedoublonnage_unique" UNIQUE("cle_dedoublonnage")
);
--> statement-breakpoint
CREATE TABLE "journal_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"utilisateur_id" bigint,
	"auteur_type" text DEFAULT 'humain' NOT NULL,
	"entite" text,
	"entite_id" bigint,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametres" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" jsonb NOT NULL,
	"modifie_par" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pieces" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dossier_id" bigint NOT NULL,
	"demande_id" bigint,
	"evenement_id" bigint,
	"type" text NOT NULL,
	"reference" text,
	"nom_fichier" text,
	"chemin" text,
	"taille_octets" integer,
	"empreinte" text,
	"archive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint NOT NULL,
	"intitule" text NOT NULL,
	"collaborateur_id" bigint,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referentiels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"libelle" text NOT NULL,
	"attributs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regles_typage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint,
	"libelle" text NOT NULL,
	"domaine" text,
	"mots_cles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"famille" text,
	"nature" text,
	"interlocuteur" text,
	"priorite" integer DEFAULT 50 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"proposee" boolean DEFAULT false NOT NULL,
	"cree_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reinitialisations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"utilisateur_id" bigint NOT NULL,
	"jeton_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reinitialisations_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"utilisateur_id" bigint NOT NULL,
	"jeton_csrf" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transitions_statut" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"demande_id" bigint NOT NULL,
	"statut_avant" text,
	"statut_apres" text NOT NULL,
	"acteur_avant" text,
	"acteur_apres" text NOT NULL,
	"survenu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"minutes_ouvrees" integer DEFAULT 0 NOT NULL,
	"motif" text,
	"evenement_id" bigint,
	"auteur_id" bigint,
	"auteur_type" text DEFAULT 'humain' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nom" text NOT NULL,
	"role" text NOT NULL,
	"mot_de_passe_hash" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"derniere_connexion_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptes_clients" ADD CONSTRAINT "comptes_clients_manager_id_utilisateurs_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_envoi" ADD CONSTRAINT "controles_envoi_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_envoi" ADD CONSTRAINT "controles_envoi_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_envoi" ADD CONSTRAINT "controles_envoi_evenement_id_evenements_id_fk" FOREIGN KEY ("evenement_id") REFERENCES "public"."evenements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_envoi" ADD CONSTRAINT "controles_envoi_controle_par_id_utilisateurs_id_fk" FOREIGN KEY ("controle_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_qualite" ADD CONSTRAINT "controles_qualite_grille_id_grilles_qualite_id_fk" FOREIGN KEY ("grille_id") REFERENCES "public"."grilles_qualite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_qualite" ADD CONSTRAINT "controles_qualite_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controles_qualite" ADD CONSTRAINT "controles_qualite_controle_par_id_utilisateurs_id_fk" FOREIGN KEY ("controle_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_corrige_par_id_utilisateurs_id_fk" FOREIGN KEY ("corrige_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grilles_qualite" ADD CONSTRAINT "grilles_qualite_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_importe_par_id_utilisateurs_id_fk" FOREIGN KEY ("importe_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_actions" ADD CONSTRAINT "journal_actions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_evenement_id_evenements_id_fk" FOREIGN KEY ("evenement_id") REFERENCES "public"."evenements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postes" ADD CONSTRAINT "postes_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postes" ADD CONSTRAINT "postes_collaborateur_id_utilisateurs_id_fk" FOREIGN KEY ("collaborateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regles_typage" ADD CONSTRAINT "regles_typage_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regles_typage" ADD CONSTRAINT "regles_typage_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reinitialisations" ADD CONSTRAINT "reinitialisations_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions_statut" ADD CONSTRAINT "transitions_statut_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions_statut" ADD CONSTRAINT "transitions_statut_evenement_id_evenements_id_fk" FOREIGN KEY ("evenement_id") REFERENCES "public"."evenements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions_statut" ADD CONSTRAINT "transitions_statut_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_tasks_file_idx" ON "ai_tasks" USING btree ("statut","priorite","created_at");--> statement-breakpoint
CREATE INDEX "controles_envoi_demande_idx" ON "controles_envoi" USING btree ("demande_id");--> statement-breakpoint
CREATE INDEX "controles_qualite_demande_idx" ON "controles_qualite" USING btree ("demande_id");--> statement-breakpoint
CREATE INDEX "controles_qualite_semaine_idx" ON "controles_qualite" USING btree ("semaine");--> statement-breakpoint
CREATE INDEX "demandes_dossier_idx" ON "demandes" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "demandes_file_idx" ON "demandes" USING btree ("compte_id","statut","echeance_le");--> statement-breakpoint
CREATE INDEX "demandes_poste_statut_idx" ON "demandes" USING btree ("poste_id","statut");--> statement-breakpoint
CREATE INDEX "demandes_famille_idx" ON "demandes" USING btree ("famille");--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_cle_idx" ON "dossiers" USING btree ("compte_id","cle_rapprochement");--> statement-breakpoint
CREATE INDEX "dossiers_compte_statut_idx" ON "dossiers" USING btree ("compte_id","statut");--> statement-breakpoint
CREATE INDEX "dossiers_client_idx" ON "dossiers" USING btree ("client");--> statement-breakpoint
CREATE INDEX "echeances_dossier_idx" ON "echeances" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "echeances_date_idx" ON "echeances" USING btree ("echeance_le","annulee");--> statement-breakpoint
CREATE INDEX "evenements_demande_idx" ON "evenements" USING btree ("demande_id","survenu_le");--> statement-breakpoint
CREATE INDEX "evenements_dossier_idx" ON "evenements" USING btree ("dossier_id","survenu_le");--> statement-breakpoint
CREATE UNIQUE INDEX "evenements_message_idx" ON "evenements" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "evenements_compte_date_idx" ON "evenements" USING btree ("compte_id","survenu_le");--> statement-breakpoint
CREATE INDEX "jobs_queue_file_idx" ON "jobs_queue" USING btree ("statut","priorite","executer_a");--> statement-breakpoint
CREATE INDEX "journal_actions_date_idx" ON "journal_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "journal_actions_entite_idx" ON "journal_actions" USING btree ("entite","entite_id");--> statement-breakpoint
CREATE INDEX "pieces_dossier_idx" ON "pieces" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "postes_compte_idx" ON "postes" USING btree ("compte_id");--> statement-breakpoint
CREATE INDEX "postes_collaborateur_idx" ON "postes" USING btree ("collaborateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referentiels_type_code_idx" ON "referentiels" USING btree ("type","code");--> statement-breakpoint
CREATE INDEX "regles_typage_priorite_idx" ON "regles_typage" USING btree ("actif","priorite");--> statement-breakpoint
CREATE INDEX "sessions_utilisateur_idx" ON "sessions" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "transitions_demande_idx" ON "transitions_statut" USING btree ("demande_id","survenu_le");