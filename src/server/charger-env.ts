/**
 * Chargement du fichier .env pour les scripts lancés par cron ou en ligne de commande
 * (Passenger le charge via app.js). Doit être importé en premier.
 */
import fs from 'node:fs';
import path from 'node:path';

const candidats = [process.env.AZMG_ENV_FILE, path.resolve(__dirname, '..', '..', '.env'), path.resolve(process.cwd(), '.env')].filter(Boolean) as string[];
const fichier = candidats.find((f) => fs.existsSync(f));
if (fichier && typeof (process as any).loadEnvFile === 'function' && !process.env.AZMG_ENV_CHARGE) {
  (process as any).loadEnvFile(fichier);
  process.env.AZMG_ENV_CHARGE = '1';
}
