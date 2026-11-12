import { execSync } from 'node:child_process';
import { Client } from 'pg';
import fs from 'node:fs';
import { E2E } from '../playwright.config';

/** Base e2e repartant de zero, migrations rejouees, comptes de parcours crees. */
export default async function () {
  const c = new Client({ connectionString: E2E.db });
  await c.connect();
  await c.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await c.end();
  fs.rmSync('storage/e2e', { recursive: true, force: true });

  const env = { ...process.env, NODE_ENV: 'development', DATABASE_URL: E2E.db, STORAGE_DIR: 'storage/e2e' };
  execSync('node dist/server/cli.js migrate', { env, stdio: 'inherit' });

  const comptes: [string, string, string][] = [
    ['ceo@azmg-solutions.com', 'Jaona', 'admin'],
    ['elysa@azmg-solutions.com', 'Elysa', 'collaborateur'],
  ];
  for (const [email, nom, role] of comptes) {
    execSync(`node dist/server/cli.js creer-utilisateur ${email} ${role} "${nom}"`, {
      env: { ...env, ADMIN_PASSWORD: 'MotDePasseE2E2026' },
      stdio: 'pipe',
    });
  }

  // Le compte client et le poste ne sont PAS crees ici : c'est le premier parcours qui les cree
  // par l'interface. Les creer en base masquait l'ecran du premier demarrage, ou l'application
  // arrive vide, et aucun test ne voyait donc ce chemin.
}
