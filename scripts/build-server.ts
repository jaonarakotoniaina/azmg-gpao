/**
 * Build de production du serveur : bundle CommonJS (compatible Phusion Passenger) dans dist/server,
 * dépendances npm laissées externes (installées avec `npm ci --omit=dev` sur le serveur),
 * copie des ressources (polices, logo, fichiers publics).
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const racine = path.resolve(__dirname, '..');
const sortie = path.join(racine, 'dist', 'server');

async function principal() {
  fs.rmSync(sortie, { recursive: true, force: true });
  await build({
    entryPoints: ['src/server/index.ts', 'src/server/cron.ts', 'src/server/cli.ts'].map((f) => path.join(racine, f)),
    outdir: sortie,
    bundle: true,
    platform: 'node',
    target: 'node20',
    // @shared est resolu par le tsconfig : esbuild le lit via le champ paths.
    format: 'cjs',
    packages: 'external',
    sourcemap: 'linked',
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION ?? new Date().toISOString().slice(0, 16)) },
    logLevel: 'warning',
  });
  // Ressources servies par le serveur (dossier facultatif tant qu'il est vide).
  for (const nom of ['assets', 'public']) {
    const source = path.join(racine, 'src', 'server', nom);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(sortie, nom), { recursive: true });
  }
  console.log('Serveur compilé dans dist/server');
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
