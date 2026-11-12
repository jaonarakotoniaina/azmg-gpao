/** Application Express : API de pilotage et application React. */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';
import './modules';
import { getPool } from './db/client';
import { gestionErreurs } from './lib/http';
import { chargerSession } from './modules/auth/middleware';
import { routesAuth, routesUtilisateurs } from './modules/auth/routes';
import { routesComptes, routesParametres, routesPostes, routesReferentiels } from './modules/pilotage/routes';
import { routesDossiers, routesEcheances } from './modules/dossiers/routes';
import { routesDemandes, routesSaisie } from './modules/demandes/routes';
import { routesEvenements } from './modules/evenements/routes';
import { routesImport } from './modules/import/routes';
import { routesIndicateurs } from './modules/indicateurs/routes';
import { routesDigest, routesQualite } from './modules/qualite/routes';
import { routesExport } from './modules/export/routes';
import { etatMigrations } from './lib/migrations';
import { etatMcp, noterAppel, routesMcp } from './modules/mcp/routes';
import { routesAgent, routesTypage } from './modules/typage/routes';
import { routesCollecte, routesWebhookCollecte } from './modules/collecte/routes';
import { routesBrouillons } from './modules/brouillons/routes';

export function creerApplication() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  // Compression des reponses texte : le poste travaille parfois sur une connexion lente.
  app.use(compression({ threshold: 1024 }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'script-src': ["'self'"],
          'frame-src': ["'self'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': config.production ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );

  // Commit de la branche release, ecrit par auto-deploy.sh, qui verifie ensuite sur /health
  // que c'est bien la nouvelle version qui repond.
  const deploiement = lireCommitDeploye();
  app.get('/health', async (_req, res) => {
    try {
      await getPool().query('SELECT 1');
      // mcp : connecteur Claude configure ou non, et les derniers appels recus (jamais la cle).
      // migrations : une mise en ligne peut servir le bon code sur une base restee en arriere.
      res.json({
        statut: 'ok',
        service: 'AZMG GPAO',
        version: process.env.APP_VERSION ?? 'dev',
        deploiement,
        migrations: await etatMigrations(),
        mcp: etatMcp(),
      });
    } catch {
      res.status(503).json({ statut: 'erreur', service: 'AZMG GPAO' });
    }
  });

  const dossierPublic = [path.join(__dirname, 'public'), path.join(config.racine, 'src', 'server', 'public')].find((d) => fs.existsSync(d));
  if (dossierPublic) app.use('/public', express.static(dossierPublic, { maxAge: config.production ? '7d' : 0 }));

  // API agent : la routine Claude Code releve les taches IA. Jeton dedie, hors session.
  app.use('/api/agent', routesAgent);

  // Webhook de collecte des mails : authentifie par signature HMAC, hors session (phase 4).
  // Monte sur son chemin exact, pour que son analyseur de corps brut ne consomme pas le corps
  // multipart de la route d'import, montee plus bas sur /api/collecte.
  app.use('/api/collecte/apps-script', routesWebhookCollecte);

  // Connecteur Claude (MCP) : conversation claude.ai, cle AZMG_MCP_TOKEN en en-tete fixe
  // (docs/connecteur-claude.md). Monte avant la session : il s'authentifie par son propre jeton.
  app.use('/mcp', routesMcp);
  // Pas d'OAuth : les adresses de decouverte repondent 404 en JSON, et non la page de
  // l'application avec un 200, que claude.ai prendrait pour un serveur d'autorisation.
  app.use('/.well-known', (req, res) => {
    noterAppel(req, 404, 'decouverte OAuth');
    res.status(404).json({ erreur: 'Introuvable' });
  });

  app.use(chargerSession);
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api/auth', routesAuth);
  app.use('/api/utilisateurs', routesUtilisateurs);
  app.use('/api/comptes', routesComptes);
  app.use('/api/postes', routesPostes);
  app.use('/api/parametres', routesParametres);
  app.use('/api/referentiels', routesReferentiels);
  app.use('/api/dossiers', routesDossiers);
  app.use('/api/demandes', routesDemandes);
  app.use('/api/evenements', routesEvenements);
  app.use('/api/echeances', routesEcheances);
  app.use('/api/saisie', routesSaisie);
  app.use('/api/import', routesImport);
  app.use('/api/indicateurs', routesIndicateurs);
  app.use('/api/qualite', routesQualite);
  app.use('/api/digest', routesDigest);
  app.use('/api/export', routesExport);
  app.use('/api/typage', routesTypage);
  app.use('/api/collecte', routesCollecte);
  app.use('/api/brouillons', routesBrouillons);
  app.use('/api', (_req, res) => res.status(404).json({ erreur: 'Route inconnue' }));

  // Application React de pilotage.
  const dossierWeb = path.join(config.racine, 'dist', 'web');
  if (fs.existsSync(dossierWeb)) {
    app.use(express.static(dossierWeb, { index: false, maxAge: config.production ? '30d' : 0 }));
    app.get(/^\/(?!api\/|public\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('cache-control', 'no-cache');
      res.sendFile(path.join(dossierWeb, 'index.html'));
    });
  }

  app.use(gestionErreurs);
  return app;
}

function lireCommitDeploye() {
  try {
    return fs.readFileSync(path.join(config.racine, '.release-commit'), 'utf8').trim();
  } catch {
    return null; // developpement ou premier clone manuel
  }
}
