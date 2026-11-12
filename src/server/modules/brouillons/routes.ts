/**
 * Routes des brouillons (phase 5).
 *
 * Aucune route n'envoie quoi que ce soit : elles preparent des textes et enregistrent la decision
 * du poste (utilise ou ecarte). L'envoi reste manuel, depuis le client de messagerie.
 */
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerEcriture } from '../auth/middleware';
import {
  deciderBrouillon,
  listerBrouillons,
  preparerComparatifCotations,
  preparerDaily,
  preparerLeMatin,
  preparerRelances,
  preparerSemaine,
  preparerSituationClient,
  relancesAPreparer,
  type TypeBrouillon,
} from './service';

const typeSchema = z.enum(['relance', 'daily', 'semaine', 'situation_client', 'comparatif_cotations']);
const jourSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const routesBrouillons = Router();
routesBrouillons.use(exigerConnexion);

routesBrouillons.get('/', async (req, res) => {
  const q = valider(
    z.object({
      compteId: z.coerce.number().int().positive(),
      statut: z.enum(['prepare', 'utilise', 'ecarte']).optional(),
      type: typeSchema.optional(),
      limite: z.coerce.number().int().min(1).max(300).optional(),
    }),
    req.query,
  );
  exigerCompte(await perimetreDe(req.utilisateur!), q.compteId);
  res.json(await listerBrouillons(q.compteId, { statut: q.statut ?? 'prepare', type: q.type as TypeBrouillon | undefined, limite: q.limite }));
});

/** Apercu des relances qui seraient preparees, sans rien enregistrer. */
routesBrouillons.get('/relances-a-preparer', async (req, res) => {
  const q = valider(z.object({ compteId: z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur!), q.compteId);
  const relances = await relancesAPreparer(q.compteId);
  res.json(
    relances.map((r) => ({
      demandeId: r.demande.id,
      objet: r.demande.objet,
      dossier: r.dossier,
      niveau: r.niveau,
      minutesAttente: r.minutesAttente,
      destinataire: r.destinataire,
      sources: r.sources,
    })),
  );
});

routesBrouillons.post('/relances', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  res.status(201).json(await preparerRelances(d.compteId, auteurDe(req)));
});

routesBrouillons.post('/daily', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive(), jour: jourSchema }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  res.status(201).json(await preparerDaily(d.compteId, d.jour, auteurDe(req)));
});

routesBrouillons.post('/semaine', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive(), jour: jourSchema }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  res.status(201).json(await preparerSemaine(d.compteId, d.jour, auteurDe(req)));
});

routesBrouillons.post('/situation-client', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive(), client: z.string().trim().min(1).max(200) }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  res.status(201).json(await preparerSituationClient(d.compteId, d.client, auteurDe(req)));
});

routesBrouillons.post('/comparatif-cotations', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ dossierId: z.number().int().positive() }), req.body);
  const [dossier] = await db.select({ compteId: schema.dossiers.compteId }).from(schema.dossiers).where(eq(schema.dossiers.id, d.dossierId));
  if (!dossier) throw new ErreurHttp(404, 'Dossier introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  res.status(201).json(await preparerComparatifCotations(d.dossierId, auteurDe(req)));
});

/** Preparation du matin a la demande, en complement du cron. */
routesBrouillons.post('/matin', exigerEcriture, async (req, res) => {
  const d = valider(z.object({ compteId: z.number().int().positive() }), req.body);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  res.status(201).json(await preparerLeMatin(d.compteId, auteurDe(req)));
});

routesBrouillons.post('/:id/decision', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const d = valider(z.object({ statut: z.enum(['utilise', 'ecarte']) }), req.body);
  const [brouillon] = await db.select({ compteId: schema.brouillons.compteId }).from(schema.brouillons).where(eq(schema.brouillons.id, id));
  if (!brouillon) throw new ErreurHttp(404, 'Brouillon introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), brouillon.compteId);
  res.json(await deciderBrouillon(id, d.statut, auteurDe(req)));
});
