ALTER TABLE "demandes" ADD COLUMN "cause" text;--> statement-breakpoint
ALTER TABLE "demandes" ADD COLUMN "reprise" boolean DEFAULT false NOT NULL;