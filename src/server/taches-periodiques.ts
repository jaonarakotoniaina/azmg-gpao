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
import { preparerLeMatin } from './modules/brouillons/service';
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

/** Taches planifiees, declenchees par le tick et executables une a une en ligne de commande. */
export const TACHES = {
  /** Controle de sante de la chaine asynchrone : trace le dernier passage reussi. */
  sante: async () => ({ file: await traiterFile({ limite: 1, budgetMs: 5_000 }) }),

  /**
   * Preparation du matin : relances, daily de la veille et, le lundi, onglet de la semaine.
   * Rien n'est envoye, tout est enregistre en brouillon (phase 5).
   */
  preparation_matin: async () => {
    const comptes = await db.select({ id: schema.comptesClients.id }).from(schema.comptesClients).where(eq(schema.comptesClients.actif, true));
    const bilans: Record<number, unknown> = {};
    for (const compte of comptes) {
      // Un compte en echec ne doit pas priver les autres de leurs brouillons.
      try {
        bilans[compte.id] = await preparerLeMatin(compte.id, { type: 'systeme', utilisateurId: null });
      } catch (e) {
        journal.error('Preparation du matin en echec', { compteId: compte.id, erreur: messageErreur(e) });
        bilans[compte.id] = { erreur: true };
      }
    }
    return bilans;
  },
};

/** Periodicite de chaque tache. L'heure est celle d'Antananarivo, avant la journee du poste. */
const PERIODICITES: Record<keyof typeof TACHES, Periodicite> = {
  sante: { toutesLesMinutes: 60 },
  preparation_matin: { chaqueJourA: 6 },
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
    const file = await traiterFile({ budgetMs: Math.max(10_000, fin - Date.now() - 60_000) }).catch((e) => {
      journal.error('Traitement de la file en echec', { erreur: messageErreur(e) });
      return null;
    });
    const taches: string[] = [];
    for (const nom of Object.keys(TACHES) as (keyof typeof TACHES)[]) {
      if (Date.now() > fin) break;
      // `periodique` decide elle-meme si la periode est due et absorbe ses propres erreurs.
      if ((await periodique(nom, PERIODICITES[nom], TACHES[nom])) !== undefined) taches.push(nom);
    }
    journal.info('Tick termine', { file, taches });
    return { ignore: false, file, taches };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [CLE_VERROU]).catch(() => undefined);
    client.release();
  }
}

export async function executerTache(nom: keyof typeof TACHES) {
  return periodique(nom, { toutesLesMinutes: 0 }, TACHES[nom], true);
}
