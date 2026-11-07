/** Routes des check-lists avant envoi, du controle qualite et du digest DO. */
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerEcriture, exigerRole } from '../auth/middleware';
import {
  checklistsPourFamille,
  cleSemaine,
  controlesDeLaSemaine,
  controlesEnvoiDeLaDemande,
  enregistrerControleEnvoi,
  indicateursQualite,
  noterControle,
  tirerEchantillon,
} from './service';
import { construireDigest } from '../digest/service';

const semaineSchema = z.string().regex(/^\d{4}-W\d{2}$/, 'Semaine attendue au format AAAA-Www');

export const routesQualite = Router();
routesQualite.use(exigerConnexion);

/** Check-lists applicables a une demande, avec les controles deja enregistres. */
routesQualite.get('/checklists/:demandeId', async (req, res) => {
  const demandeId = idParam(req, 'demandeId');
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, demandeId));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
  res.json({
    checklists: await checklistsPourFamille(demande.famille, demande.compteId),
    controles: await controlesEnvoiDeLaDemande(demandeId),
  });
});

routesQualite.post('/controle-envoi', exigerEcriture, async (req, res) => {
  const d = valider(
    z.object({
      demandeId: z.number().int().positive(),
      checklistId: z.number().int().positive(),
      reponses: z.record(z.string(), z.boolean()),
      commentaire: z.string().trim().max(1000).nullish(),
      evenementId: z.number().int().positive().nullish(),
    }),
    req.body,
  );
  const [demande] = await db.select({ compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, d.demandeId));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
  res.status(201).json(await enregistrerControleEnvoi(d, auteurDe(req)));
});

/** Echantillon qualite d'une semaine : tirage et liste des controles a noter. */
routesQualite.get('/echantillon', async (req, res) => {
  const q = valider(
    z.object({ semaine: semaineSchema.optional(), compteId: z.coerce.number().int().positive().optional() }),
    req.query,
  );
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);
  const semaine = q.semaine ?? cleSemaine(new Date());
  const controles = await controlesDeLaSemaine(semaine, q.compteId);
  res.json({
    semaine,
    controles: p.comptes === null ? controles : controles.filter((c) => p.comptes!.includes(c.demande.compteId)),
  });
});

routesQualite.post('/echantillon', exigerRole('admin', 'manager'), async (req, res) => {
  const d = valider(
    z.object({
      semaine: semaineSchema.optional(),
      compteId: z.number().int().positive(),
      taux: z.number().min(0).max(1).optional(),
      grilleId: z.number().int().positive().optional(),
    }),
    req.body,
  );
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  const semaine = d.semaine ?? cleSemaine(new Date());
  res.status(201).json(await tirerEchantillon(semaine, { compteId: d.compteId, taux: d.taux, grilleId: d.grilleId }, auteurDe(req)));
});

routesQualite.post('/controle/:id/note', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const d = valider(
    z.object({
      notes: z.record(z.string(), z.number().min(0).max(100)),
      reprise: z.boolean().optional(),
      bonDuPremierCoup: z.boolean().nullish(),
      commentaire: z.string().trim().max(1000).nullish(),
    }),
    req.body,
  );
  const [ligne] = await db
    .select({ compteId: schema.demandes.compteId })
    .from(schema.controlesQualite)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.controlesQualite.demandeId))
    .where(eq(schema.controlesQualite.id, id));
  if (!ligne) throw new ErreurHttp(404, 'Controle qualite introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), ligne.compteId);
  res.json(await noterControle(id, d, auteurDe(req)));
});

routesQualite.get('/indicateurs', async (req, res) => {
  const q = valider(
    z.object({ compteId: z.coerce.number().int().positive().optional(), jours: z.coerce.number().int().min(1).max(365).optional() }),
    req.query,
  );
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);
  const jours = q.jours ?? 30;
  const fin = new Date();
  const debut = new Date(fin.getTime() - jours * 86_400_000);
  res.json(await indicateursQualite({ debut, fin }, { compteId: q.compteId }));
});

routesQualite.get('/grilles', async (_req, res) => {
  res.json(await db.select().from(schema.grillesQualite).where(eq(schema.grillesQualite.actif, true)));
});

// ---------------------------------------------------------------------------
// Digest de validation DO : brouillon seulement, aucun envoi
// ---------------------------------------------------------------------------

export const routesDigest = Router();
routesDigest.use(exigerConnexion);

routesDigest.get('/validation-do', async (req, res) => {
  const q = valider(z.object({ compteId: z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur!), q.compteId);
  // Aucun envoi : la reponse est un brouillon a relire, puis a copier dans le canal choisi.
  res.json(await construireDigest(q.compteId));
});
