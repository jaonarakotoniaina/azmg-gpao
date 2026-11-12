/**
 * Enregistrement des gestionnaires de la file de traitements.
 * Importe par l'application, le cron et la ligne de commande : un seul endroit ou declarer un type.
 */
import { enregistrerGestionnaire } from '../lib/file';
import { journal } from '../lib/journal';

/** Tache de controle de la chaine asynchrone, utilisee par les tests et le diagnostic. */
enregistrerGestionnaire('ping', async (payload) => {
  journal.info('Tache ping traitee', { payload });
});
