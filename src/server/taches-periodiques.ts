/**
 * Cron « tick » (toutes les 5 minutes via cPanel) : un seul point d'entree, verrou consultatif
 * PostgreSQL, taches periodiques memorisees dans `cron_runs` (jamais executees deux fois pour
 * la meme periode).
 */
import { eq } from 'drizzle-orm';
import './modules';
import { db, getPool, schema } from './db/client';
import { journal, messageErreur } from './lib/journal';
import { traiterFile } from './lib/file';
import { maintenantTana } from '@shared/dates';

const CLE_VERROU = 7340242;

type Periodicite = { toutesLesMinutes: number } | { chaqueJourA: number };

async function periodique(nom: string, periodicite: Periodicite, fn: () => Promise<unknown>, forcer = false) {
  const [etat] = await db.select().from(schema.cronRuns).where(eq(schema.cronRuns.tache, nom));
  const maintenant = new Date();
  let cle: string | null = null;
  if (!forcer) {
    if ('toutesLesMinutes' in periodicite) {
      if (etat?.dernierPassageLe && maintenant.getTime() - etat.dernierPassageLe.getTime() < periodicite.toutesLesMinutes * 60_000 - 30_000) return;
    } else {
      const { jour, heure } = maintenantTana();
      if (heure < periodicite.chaqueJourA || etat?.dernierePeriode === jour) return;
      cle = jour;
    }
  }
  const debut = Date.now();
  let statut = 'succes';
  let erreur: string | null = null;
  let resultat: unknown;
  try {
    resultat = await fn();
  } catch (e) {
    statut = 'echec';
    erreur = messageErreur(e).slice(0, 1000);
    journal.error('Tache periodique en echec', { tache: nom, erreur });
  }
  const valeurs = {
    dernierPassageLe: maintenant,
    dernierStatut: statut,
    derniereErreur: erreur,
    dureeMs: Date.now() - debut,
    ...(cle ? { dernierePeriode: cle } : {}),
  };
  await db.insert(schema.cronRuns).values({ tache: nom, ...valeurs }).onConflictDoUpdate({ target: schema.cronRuns.tache, set: valeurs });
  return resultat;
}

/**
 * Taches planifiees. Les traitements des phases suivantes (relances, digest DO, daily,
 * collecte des mails, echantillon qualite) viennent s'ajouter ici.
 */
export const TACHES = {
  /** Controle de sante de la chaine asynchrone : trace le dernier passage reussi. */
  sante: async () => ({ file: await traiterFile({ limite: 1, budgetMs: 5_000 }) }),
};

export async function tick(opts: { budgetMs?: number } = {}) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [CLE_VERROU]);
    if (!rows[0].ok) {
      journal.info('Tick deja en cours, passage ignore');
      return { ignore: true };
    }
    const fin = Date.now() + (opts.budgetMs ?? 4 * 60_000);
    // Une erreur de la file ne doit jamais empecher les taches periodiques du passage.
    const file = await traiterFile({ budgetMs: Math.max(10_000, fin - Date.now() - 20_000) }).catch((e) => {
      journal.error('Traitement de la file en echec', { erreur: messageErreur(e) });
      return null;
    });
    journal.info('Tick termine', { file });
    return { ignore: false, file };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [CLE_VERROU]).catch(() => undefined);
    client.release();
  }
}

export async function executerTache(nom: keyof typeof TACHES) {
  return periodique(nom, { toutesLesMinutes: 0 }, TACHES[nom], true);
}
