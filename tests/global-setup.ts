import { Client } from 'pg';
import { execSync } from 'node:child_process';

/** Base de test repartant de zero : les migrations sont rejouees sur une base vide a chaque execution. */
export default async function () {
  process.env.NODE_ENV = 'test';
  const url = process.env.DATABASE_URL_TEST ?? 'postgresql://azmg:azmg@localhost:5432/azmg_gpao_test';
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await c.end();
  execSync('npx tsx src/server/cli.ts migrate', { env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url }, stdio: 'inherit' });
}
