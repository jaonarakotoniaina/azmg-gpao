ALTER TABLE "evenements" ADD COLUMN "expediteur" text;--> statement-breakpoint
ALTER TABLE "evenements" ADD COLUMN "destinataires" jsonb DEFAULT '[]'::jsonb NOT NULL;