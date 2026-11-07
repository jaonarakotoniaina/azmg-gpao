/**
 * Point d'entree des taches planifiees (cron cPanel).
 *   node dist/server/cron.js tick        toutes les 5 minutes
 *   node dist/server/cron.js <tache>     execution ponctuelle
 */
import './charger-env';
import { fermerDb } from './db/client';
import { tick, executerTache, TACHES } from './taches-periodiques';

/** Garde-fou : un passage qui ne se termine pas libere son verrou au lieu de bloquer les suivants. */
const DUREE_MAX_PASSAGE_MS = 8 * 60_000;

async function principal() {
  const commande = process.argv[2] ?? 'tick';
  setTimeout(() => {
    console.error(JSON.stringify({ niveau: 'error', message: 'Cron arrete : duree maximale depassee', commande }));
    process.exit(1);
  }, DUREE_MAX_PASSAGE_MS).unref();
  if (commande === 'tick') await tick();
  else if (commande in TACHES) await executerTache(commande as keyof typeof TACHES);
  else {
    console.error(`Commande inconnue : ${commande}. Disponibles : tick, ${Object.keys(TACHES).join(', ')}`);
    process.exitCode = 1;
  }
}

principal()
  .catch((e) => {
    console.error(JSON.stringify({ niveau: 'error', message: 'Echec du cron', erreur: String(e?.message ?? e) }));
    process.exitCode = 1;
  })
  .finally(() => fermerDb());
