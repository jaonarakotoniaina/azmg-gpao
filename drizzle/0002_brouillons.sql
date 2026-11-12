CREATE TABLE "brouillons" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"compte_id" bigint NOT NULL,
	"type" text NOT NULL,
	"dossier_id" bigint,
	"demande_id" bigint,
	"titre" text NOT NULL,
	"contenu" text NOT NULL,
	"donnees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statut" text DEFAULT 'prepare' NOT NULL,
	"niveau" integer,
	"cle_unicite" text NOT NULL,
	"prepare_le" timestamp with time zone DEFAULT now() NOT NULL,
	"decide_le" timestamp with time zone,
	"decide_par_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brouillons_cle_unicite_unique" UNIQUE("cle_unicite")
);
--> statement-breakpoint
ALTER TABLE "brouillons" ADD CONSTRAINT "brouillons_compte_id_comptes_clients_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brouillons" ADD CONSTRAINT "brouillons_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brouillons" ADD CONSTRAINT "brouillons_demande_id_demandes_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brouillons" ADD CONSTRAINT "brouillons_decide_par_id_utilisateurs_id_fk" FOREIGN KEY ("decide_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brouillons_compte_statut_idx" ON "brouillons" USING btree ("compte_id","statut","type");--> statement-breakpoint
CREATE INDEX "brouillons_demande_idx" ON "brouillons" USING btree ("demande_id");