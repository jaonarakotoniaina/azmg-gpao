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

  // Compte client et poste du parcours, crees directement en base pour un demarrage rapide.
  const c2 = new Client({ connectionString: E2E.db });
  await c2.connect();
  const { rows } = await c2.query("SELECT id FROM utilisateurs WHERE email = 'elysa@azmg-solutions.com'");
  const compte = await c2.query(
    `INSERT INTO comptes_clients (nom, code, pays, ville, fuseau, donneur_ordre_nom)
     VALUES ('Compte de parcours', 'parcours', 'Espagne', 'Barcelone', 'Europe/Madrid', 'Responsable export (fictive)')
     RETURNING id`,
  );
  await c2.query(`INSERT INTO postes (compte_id, intitule, collaborateur_id) VALUES ($1, 'Assistante export', $2)`, [
    compte.rows[0].id,
    rows[0].id,
  ]);
  await c2.end();
}
