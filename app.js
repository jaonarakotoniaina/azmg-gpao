// Point d'entree Phusion Passenger (cPanel « Setup Node.js App », fichier de demarrage : app.js).
// Charge le fichier .env situe hors du dossier public, puis demarre le serveur compile.
const path = require('node:path');
const fs = require('node:fs');
const fichierEnv = process.env.AZMG_ENV_FILE || path.join(__dirname, '.env');
if (fs.existsSync(fichierEnv) && typeof process.loadEnvFile === 'function') process.loadEnvFile(fichierEnv);
require('./dist/server/index.js');
