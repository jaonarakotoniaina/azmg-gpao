/** Demarrage du serveur (Phusion Passenger en production : le port est fourni par Passenger). */
import { creerApplication } from './app';
import { config } from './config';
import { journal } from './lib/journal';
import { tick } from './taches-periodiques';

if (config.production && (!config.sessionSecret || config.sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET absent ou trop court (32 caracteres minimum)');
}

const app = creerApplication();
const serveur = app.listen(config.port, () => {
  journal.info('AZMG GPAO demarre', { port: config.port, env: config.env, ia: config.ia.fournisseur, collecte: config.collecte.mode });
});

// Developpement uniquement : cron simule dans le processus (en production, cron cPanel).
if (config.cronEnProcessus && !config.production) {
  setInterval(() => {
    tick({ budgetMs: 50_000 }).catch((e) => journal.error('Tick en echec', { erreur: String(e) }));
  }, 60_000);
}

process.on('SIGTERM', () => serveur.close());
