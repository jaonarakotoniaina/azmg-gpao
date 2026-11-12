/**
 * Produit un classeur exporte a partir des donnees de demonstration, pour verifier a l'oeil
 * que la mise en forme du classeur d'origine est bien preservee.
 *
 *   npm run db:seed
 *   npx tsx scripts/exporter-demonstration.ts /tmp/export.xlsx
 *
 * Le classeur source est le classeur fictif de test : aucune donnee reelle n'est manipulee.
 */
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { exporterReporting } from '../src/server/modules/export/service';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { db, schema } from '../src/server/db/client';

const SOURCE = 'tests/fixtures/SUIVI_MENSUEL_FICTIF_07-11.xlsx';

async function principal() {
  const sortie = process.argv[2];
  if (!sortie) throw new Error('Usage : npx tsx scripts/exporter-demonstration.ts <fichier de sortie .xlsx>');
  const [compte] = await db.select().from(schema.comptesClients).where(eq(schema.comptesClients.code, 'masenz-demo'));
  if (!compte) throw new Error('Compte de demonstration absent : lancez d’abord « npm run db:seed ».');

  const jours = Array.from({ length: 7 }, (_, n) => DateTime.now().minus({ days: n }).toISODate()!);
  const { fichier, bilan } = await exporterReporting(fs.readFileSync(SOURCE), { compteId: compte.id, jours }, AUTEUR_SYSTEME);
  fs.writeFileSync(sortie, fichier);
  console.log(`Classeur ecrit : ${sortie}`);
  console.log(JSON.stringify(bilan, null, 2));
}

principal()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
