/** Routes du typage : regles, propositions, et API agent de la file IA. */
import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { config } from '../../config';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { egaliteConstante } from '../../lib/securite';
import { exigerConnexion, exigerRole } from '../auth/middleware';
import { accepterRegle, proposerRegle, refuserRegle, reglesProposees, sortieTypageSchema, typerMessage } from './service';
import { enregistrerResultat, etatFileIa, tachesEnAttente } from '../../ai/service';
import { CODES_FAMILLES, INTERLOCUTEURS, NATURES, SENS } from '@shared/constantes';

export const routesTypage = Router();
routesTypage.use(exigerConnexion);

/** Essai de typage, sans rien enregistrer : sert a comprendre pourquoi un message est classe ainsi. */
routesTypage.post('/essai', async (req, res) => {
  const d = valider(
    z.object({
      objet: z.string().trim().max(300).optional(),
      corps: z.string().trim().max(10_000).optional(),
      expediteur: z.string().trim().max(320).optional(),
      sens: z.enum(SENS).optional(),
      compteId: z.number().int().positive().optional(),
    }),
    req.body,
  );
  const resultat = await typerMessage(d, { compteId: d.compteId });
  res.json({ typage: resultat.typage, applicable: resultat.applicable });
});

routesTypage.get('/regles', async (_req, res) => {
  const lignes = await db.select().from(schema.reglesTypage).orderBy(asc(schema.reglesTypage.priorite), asc(schema.reglesTypage.id));
  res.json(lignes);
});

routesTypage.get('/regles/proposees', async (_req, res) => {
  res.json(await reglesProposees());
});

routesTypage.post('/regles/:id/accepter', exigerRole('admin', 'manager'), async (req, res) => {
  res.json(await accepterRegle(idParam(req), auteurDe(req)));
});

routesTypage.post('/regles/:id/refuser', exigerRole('admin', 'manager'), async (req, res) => {
  res.json(await refuserRegle(idParam(req), auteurDe(req)));
});

routesTypage.post('/regles', exigerRole('admin'), async (req, res) => {
  const d = valider(
    z.object({
      libelle: z.string().trim().min(3).max(200),
      domaine: z.string().trim().max(200).nullish(),
      motsCles: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
      famille: z.enum(CODES_FAMILLES as [string, ...string[]]).nullish(),
      nature: z.enum(NATURES).nullish(),
      interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
      priorite: z.number().int().min(1).max(999).default(70),
      compteId: z.number().int().positive().nullish(),
    }),
    req.body,
  );
  const [regle] = await db
    .insert(schema.reglesTypage)
    .values({ ...d, actif: true, proposee: false, creeParId: req.utilisateur!.id })
    .returning();
  res.status(201).json(regle);
});

routesTypage.patch('/regles/:id', exigerRole('admin'), async (req, res) => {
  const d = valider(
    z.object({
      libelle: z.string().trim().min(3).max(200).optional(),
      motsCles: z.array(z.string().trim().min(2).max(80)).max(30).optional(),
      famille: z.enum(CODES_FAMILLES as [string, ...string[]]).nullish(),
      nature: z.enum(NATURES).nullish(),
      interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
      priorite: z.number().int().min(1).max(999).optional(),
      actif: z.boolean().optional(),
    }),
    req.body,
  );
  const [maj] = await db.update(schema.reglesTypage).set({ ...d, majLe: new Date() }).where(eq(schema.reglesTypage.id, idParam(req))).returning();
  if (!maj) throw new ErreurHttp(404, 'Regle introuvable');
  res.json(maj);
});

/** Etat de la file IA, pour le tableau de bord. */
routesTypage.get('/ia/etat', async (_req, res) => {
  res.json(await etatFileIa());
});

/** Propose explicitement une regle depuis un evenement deja corrige. */
routesTypage.post('/regles/proposer/:evenementId', exigerRole('admin', 'manager'), async (req, res) => {
  const evenementId = idParam(req, 'evenementId');
  const [evenement] = await db.select().from(schema.evenements).where(eq(schema.evenements.id, evenementId));
  if (!evenement) throw new ErreurHttp(404, 'Evenement introuvable');
  const proposition = await proposerRegle(
    evenementId,
    { famille: evenement.famille ?? undefined, nature: evenement.nature, interlocuteur: evenement.interlocuteur },
    auteurDe(req),
  );
  if (!proposition) throw new ErreurHttp(409, 'Aucune regle exploitable : objet trop court ou regle deja proposee');
  res.status(201).json(proposition);
});

// ---------------------------------------------------------------------------
// API agent : la routine Claude Code releve les taches IA et rend leurs resultats
// ---------------------------------------------------------------------------

export const routesAgent = Router();
routesAgent.use(rateLimit({ windowMs: 60_000, limit: config.test ? 10_000 : 120, standardHeaders: true, legacyHeaders: false }));
routesAgent.use(express.json({ limit: '2mb' }));

/** Authentification par jeton dedie, distinct de celui du connecteur Claude. */
routesAgent.use((req, res, next) => {
  const attendu = config.agent.jeton;
  if (!attendu) {
    res.status(503).json({ erreur: 'API agent non configuree (AGENT_API_TOKEN)' });
    return;
  }
  const entete = String(req.headers.authorization ?? '');
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : '';
  if (!jeton || !egaliteConstante(jeton, attendu)) {
    res.status(401).json({ erreur: 'Jeton de l’API agent invalide' });
    return;
  }
  next();
});

routesAgent.get('/ia/taches', async (req, res) => {
  const q = valider(z.object({ limite: z.coerce.number().int().min(1).max(200).optional() }), req.query);
  res.json({ taches: await tachesEnAttente(q.limite ?? 50) });
});

routesAgent.post('/ia/taches/:id/resultat', async (req, res) => {
  const id = idParam(req);
  const [tache] = await db.select().from(schema.aiTasks).where(eq(schema.aiTasks.id, id));
  if (!tache) throw new ErreurHttp(404, 'Tache IA introuvable');

  const corps = valider(
    z.object({ resultat: z.record(z.string(), z.unknown()).nullish(), erreur: z.string().trim().max(1000).nullish() }),
    req.body,
  );

  if (!corps.resultat) {
    const bilan = await enregistrerResultat(id, null, corps.erreur ?? 'aucun resultat');
    return res.json(bilan);
  }

  // La sortie est validee contre le schema zod de la tache : une sortie invalide repart en file.
  if (tache.type === 'typer_evenement') {
    const valide = sortieTypageSchema.safeParse(corps.resultat);
    if (!valide.success) {
      const bilan = await enregistrerResultat(id, null, valide.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; '));
      return res.status(422).json({ ...bilan, erreur: 'Sortie invalide, la tache repart en file' });
    }
    return res.json(await enregistrerResultat(id, valide.data));
  }

  res.json(await enregistrerResultat(id, corps.resultat as Record<string, unknown>));
});

export { and, desc };
