/**
 * Route du connecteur Claude (MCP) : POST /mcp, messages JSON-RPC du connecteur personnalisé claude.ai.
 * Authentification par en-tête fixe `Authorization: Bearer <AZMG_MCP_TOKEN>`, distinct du jeton de
 * l'agent. Clé absente ou trop courte côté serveur : le connecteur reste fermé.
 */
import express, { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { egaliteConstante } from '../../lib/securite';
import { journal as journalApp, messageErreur } from '../../lib/journal';
import { traiterMessage } from './service';

export const LONGUEUR_MIN_JETON = 32;

// Derniers appels recus (lisibles dans /health) : jamais la clé, pour diagnostiquer à distance un
// connecteur que claude.ai n'arrive pas à joindre.
const appels: { le: string; http: string; chemin: string; statut: number; rpc: string | null; auth: string | null; agent: string }[] = [];

export function noterAppel(req: Request, statut: number, detail: string | null) {
  const corps = req.body as unknown;
  const rpc = Array.isArray(corps) ? corps.map((m) => (m as { method?: string })?.method).join(',') : ((corps as { method?: string } | undefined)?.method ?? null);
  appels.unshift({ le: new Date().toISOString(), http: req.method, chemin: req.originalUrl.slice(0, 120), statut, rpc, auth: detail, agent: String(req.headers['user-agent'] ?? '').slice(0, 80) });
  appels.length = Math.min(appels.length, 15);
}

export function etatMcp() {
  return { configure: config.mcp.jeton.length >= LONGUEUR_MIN_JETON, derniers_appels: appels };
}

export const routesMcp = Router();
routesMcp.use(rateLimit({ windowMs: 60_000, limit: config.test ? 10_000 : 120, standardHeaders: true, legacyHeaders: false }));
routesMcp.use(express.json({ limit: '1mb' }));

routesMcp.use((req, res, next) => {
  const attendu = config.mcp.jeton;
  if (attendu.length < LONGUEUR_MIN_JETON) {
    noterAppel(req, 503, 'non configuré');
    res.status(503).json({ erreur: 'Connecteur Claude non configuré (AZMG_MCP_TOKEN)' });
    return;
  }
  const entete = String(req.headers.authorization ?? '');
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : '';
  if (!jeton || !egaliteConstante(jeton, attendu)) {
    // Forme de l'en-tête reçu (jamais sa valeur).
    const forme = !entete ? 'en-tête absent' : !entete.startsWith('Bearer ') ? `sans « Bearer » (${entete.length} car.)` : `jeton refusé (${jeton.length} car. recus, ${attendu.length} attendus)`;
    noterAppel(req, 401, forme);
    res.status(401).json({ erreur: 'Jeton du connecteur invalide' });
    return;
  }
  noterAppel(req, 200, 'ok');
  next();
});

routesMcp.post('/', async (req, res) => {
  const corps = req.body as unknown;
  try {
    if (Array.isArray(corps)) {
      const reponses = (await Promise.all(corps.map((m) => traiterMessage(m)))).filter(Boolean);
      if (reponses.length) res.json(reponses);
      else res.status(202).end();
      return;
    }
    const reponse = await traiterMessage(corps as Parameters<typeof traiterMessage>[0]);
    if (reponse) res.json(reponse);
    else res.status(202).end();
  } catch (e) {
    journalApp.error('Connecteur Claude en échec', { erreur: messageErreur(e) });
    const id = (corps as { id?: unknown } | undefined)?.id;
    res.status(500).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32603, message: 'Erreur interne de la GPAO' } });
  }
});

// Pas de flux SSE ni de session : chaque requête reçoit sa réponse JSON.
routesMcp.get('/', (_req, res) => {
  res.set('Allow', 'POST').status(405).json({ erreur: 'POST uniquement' });
});
routesMcp.delete('/', (_req, res) => {
  res.set('Allow', 'POST').status(405).json({ erreur: 'POST uniquement' });
});
