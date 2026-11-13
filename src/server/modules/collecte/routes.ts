/** Routes de la collecte : webhook Apps Script signe, import de fichiers, telechargement des pieces. */
import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { config } from '../../config';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { journal, messageErreur } from '../../lib/journal';
import { cheminAbsolu, fichierExiste } from '../../lib/stockage';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerRole } from '../auth/middleware';
import { adaptateurCollecte, analyserMessage, decouperMbox, verifierSignature, type MessageCollecte } from '../../adapters/collecte-mail';
import { enregistrerLot, exigerCompteCollecte } from './service';
import { AUTEUR_SYSTEME } from '../demandes/service';

/** Taille maximale d'un fichier importe (.eml ou .mbox d'historique). */
const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 20 },
  fileFilter: (_req, fichier, callback) => {
    if (!/\.(eml|mbox|txt)$/i.test(fichier.originalname)) {
      return callback(new ErreurHttp(400, 'Seuls les fichiers .eml et .mbox sont acceptes'));
    }
    callback(null, true);
  },
});

export const routesCollecte = Router();
routesCollecte.use(exigerConnexion);

/** Etat de la collecte, affiche dans l'interface. */
routesCollecte.get('/etat', async (_req, res) => {
  const [dernier] = await db
    .select({ creeLe: schema.journalActions.creeLe, details: schema.journalActions.details })
    .from(schema.journalActions)
    .where(eq(schema.journalActions.action, 'mails_collectes'))
    .orderBy(desc(schema.journalActions.creeLe))
    .limit(1);
  res.json({
    mode: adaptateurCollecte().mode,
    webhookConfigure: Boolean(config.collecte.secretAppsScript),
    dernierePasse: dernier ? { le: dernier.creeLe, bilan: dernier.details } : null,
  });
});

/** Import ponctuel de fichiers `.eml` ou `.mbox`, pour reprendre l'historique. */
routesCollecte.post('/import', exigerRole('admin', 'manager'), envoi.array('fichiers', 20), async (req, res) => {
  const fichiers = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!fichiers.length) throw new ErreurHttp(400, 'Aucun fichier recu (champ « fichiers » attendu)');
  const d = valider(
    z.object({
      compteId: z.coerce.number().int().positive(),
      posteId: z.coerce.number().int().positive().optional(),
      dossierId: z.coerce.number().int().positive().optional(),
    }),
    req.body,
  );
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);

  const messages: MessageCollecte[] = [];
  const illisibles: { fichier: string; raison: string }[] = [];
  for (const fichier of fichiers) {
    const bruts = /\.mbox$/i.test(fichier.originalname) ? decouperMbox(fichier.buffer) : [fichier.buffer];
    for (const brut of bruts) {
      try {
        messages.push(await analyserMessage(brut));
      } catch (e) {
        illisibles.push({ fichier: path.basename(fichier.originalname), raison: messageErreur(e).slice(0, 200) });
      }
    }
  }

  const bilan = await enregistrerLot(
    messages,
    { compteId: d.compteId, posteId: d.posteId ?? null, dossierParDefautId: d.dossierId ?? null, source: 'import' },
    auteurDe(req),
  );
  res.status(201).json({ bilan, illisibles });
});

/** Relevage manuel de la boite, quand le mode `imap` est actif. */
routesCollecte.post('/relever', exigerRole('admin', 'manager'), async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive(), limite: z.number().int().min(1).max(200).optional() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  const adaptateur = adaptateurCollecte();
  if (adaptateur.mode === 'mock') {
    throw new ErreurHttp(409, 'La collecte des mails est en mode simule : renseignez APPS_SCRIPT_SECRET ou IMAP_* pour l’activer');
  }
  const messages = await adaptateur.relever(d.limite ?? 50);
  res.json({ mode: adaptateur.mode, bilan: await enregistrerLot(messages, { compteId: d.compteId }, auteurDe(req)) });
});

/**
 * Telechargement d'une piece jointe.
 * Les fichiers sont ranges hors du dossier public : c'est la seule porte d'entree, et elle exige
 * une session valide et le compte dans le perimetre de l'utilisateur.
 */
routesCollecte.get('/piece/:id', async (req, res) => {
  const id = idParam(req);
  const [ligne] = await db
    .select({ piece: schema.pieces, compteId: schema.dossiers.compteId })
    .from(schema.pieces)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.pieces.dossierId))
    .where(eq(schema.pieces.id, id));
  if (!ligne?.piece.chemin) throw new ErreurHttp(404, 'Piece introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), ligne.compteId);
  if (!(await fichierExiste(ligne.piece.chemin))) throw new ErreurHttp(404, 'Fichier absent du stockage');

  // Le nom d'origine est rendu au telechargement, mais jamais utilise comme chemin sur le disque.
  const nom = (ligne.piece.nomFichier ?? 'piece').replace(/["\\\r\n]/g, '_');
  res.setHeader('content-disposition', `attachment; filename="${nom}"`);
  res.setHeader('x-content-type-options', 'nosniff');
  res.sendFile(cheminAbsolu(ligne.piece.chemin));
});

// ---------------------------------------------------------------------------
// Webhook Apps Script : hors session, authentifie par signature HMAC
// ---------------------------------------------------------------------------

/**
 * Monte sur `/api/collecte/apps-script` **exactement**, et non sur `/api/collecte` : son
 * analyseur de corps brut consommerait sinon le corps multipart de la route d'import, qui
 * echouerait avec « Unexpected end of form ».
 */
export const routesWebhookCollecte = Router();
routesWebhookCollecte.use(rateLimit({ windowMs: 60_000, limit: config.test ? 10_000 : 300, standardHeaders: true, legacyHeaders: false }));
// Le corps brut est necessaire pour verifier la signature : elle porte sur les octets recus.
routesWebhookCollecte.use(express.text({ type: '*/*', limit: '25mb' }));

const chargeSchema = z.object({
  compteId: z.number().int().positive(),
  posteId: z.number().int().positive().nullish(),
  messages: z
    .array(
      z.object({
        /** Message complet au format RFC 5322, tel que Gmail le fournit. */
        brut: z.string().min(10).optional(),
        /** Ou bien les champs deja extraits par le script. */
        messageId: z.string().min(3).optional(),
        filId: z.string().optional(),
        expediteur: z.string().optional(),
        destinataires: z.array(z.string()).optional(),
        objet: z.string().optional(),
        corps: z.string().optional(),
        survenuLe: z.string().optional(),
        /** Lien vers le message dans sa boite d'origine, construit par le script. */
        lienExterne: z.string().url().max(2000).optional(),
      }),
    )
    .max(100),
});

routesWebhookCollecte.post('/', async (req, res) => {
  const secret = config.collecte.secretAppsScript;
  if (!secret) {
    res.status(503).json({ erreur: 'Collecte Apps Script non configuree (APPS_SCRIPT_SECRET)' });
    return;
  }
  const corpsBrut = typeof req.body === 'string' ? req.body : '';
  const signature = String(req.headers['x-azmg-signature'] ?? '');
  if (!verifierSignature(corpsBrut, signature, secret)) {
    journal.warn('Webhook de collecte refuse : signature invalide');
    res.status(401).json({ erreur: 'Signature invalide' });
    return;
  }

  let charge: z.infer<typeof chargeSchema>;
  try {
    charge = chargeSchema.parse(JSON.parse(corpsBrut));
  } catch (e) {
    res.status(400).json({ erreur: `Charge invalide : ${messageErreur(e).slice(0, 200)}` });
    return;
  }

  // Le compte doit exister et etre actif AVANT de toucher au moindre message : voir
  // `exigerCompteCollecte`, qui explique pourquoi un refus franc vaut mieux qu'un bilan en erreur.
  try {
    await exigerCompteCollecte(charge.compteId);
  } catch (e) {
    journal.warn('Webhook de collecte refuse : compte inconnu ou inactif', { compteId: charge.compteId });
    res.status(404).json({ erreur: messageErreur(e) });
    return;
  }

  const messages: MessageCollecte[] = [];
  for (const m of charge.messages) {
    if (m.brut) {
      const analyse = await analyserMessage(Buffer.from(m.brut, 'utf8'));
      messages.push(m.lienExterne ? { ...analyse, lienExterne: m.lienExterne } : analyse);
      continue;
    }
    if (!m.messageId) continue;
    messages.push({
      messageId: m.messageId,
      filId: m.filId || m.messageId,
      expediteur: (m.expediteur ?? '').toLowerCase(),
      destinataires: (m.destinataires ?? []).map((d) => d.toLowerCase()),
      objet: m.objet ?? '',
      corps: m.corps ?? '',
      survenuLe: m.survenuLe ? new Date(m.survenuLe) : new Date(),
      lienExterne: m.lienExterne,
      pieces: [],
    });
  }

  // Le webhook agit au nom du systeme : aucun utilisateur n'est connecte.
  const bilan = await enregistrerLot(messages, { compteId: charge.compteId, posteId: charge.posteId ?? null }, AUTEUR_SYSTEME);
  res.json({ bilan });
});
