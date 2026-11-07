import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import * as schema from './schema';
import { config } from '../config';

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let instance: Db | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: config.production ? 5 : 10,
    });
    pool.on('error', () => {
      /* connexion inactive perdue : le pool en recrée une */
    });
  }
  return pool;
}

export function getDb(): Db {
  if (!instance) instance = drizzle(getPool(), { schema });
  return instance;
}

/** Raccourci d'usage courant. */
export const db = new Proxy({} as Db, {
  get(_cible, prop) {
    return (getDb() as any)[prop];
  },
});

export async function fermerDb() {
  if (pool) await pool.end();
  pool = null;
  instance = null;
}

export async function migrer() {
  await migrate(getDb(), { migrationsFolder: path.join(config.racine, 'drizzle') });
}

export { schema };
