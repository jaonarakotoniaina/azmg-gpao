ALTER TABLE "postes" ADD COLUMN "metier" text DEFAULT 'export' NOT NULL;--> statement-breakpoint
ALTER TABLE "postes" ADD COLUMN "adresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "postes" ADD COLUMN "familles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
--> Les adresses saisies au niveau du compte rejoignent son premier poste, pour qu'une valeur
--> deja enregistree ne soit pas perdue en passant du compte au poste.
UPDATE "postes" SET "adresses" = c."adresses_poste"
FROM "comptes_clients" c
WHERE c."id" = "postes"."compte_id"
  AND c."adresses_poste" <> '[]'::jsonb
  AND "postes"."id" = (SELECT min(p2."id") FROM "postes" p2 WHERE p2."compte_id" = c."id");--> statement-breakpoint
ALTER TABLE "comptes_clients" DROP COLUMN "adresses_poste";