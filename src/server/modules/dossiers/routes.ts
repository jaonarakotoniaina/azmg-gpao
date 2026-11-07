/** Routes des dossiers : recherche, fiche, chronologie, echeances, pieces. */
import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { journaliser } from '../../lib/evenements';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerEcriture } from '../auth/middleware';
import { chercherDossiers, chronologieDossier, lireDossier, modifierDossier, trouverOuCreerDossier } from './service';
import { demandesDuDossier, tempsDemande } from '../demandes/service';
import { dossierSchema, echeanceSchema, modificationDossierSchema, modificationEcheanceSchema } from '@shared/validation';
import { FAMILLE_HORS_PERIMETRE } from '@shared/constantes';

export const routesDossiers = Router();
routesDossiers.use(exigerConnexion);

routesDossiers.get('/', async (req, res) => {
  const q = valider(
    z.object({ q: z.string().trim().max(200).optional(), compteId: z.coerce.number().int().positive().optional(), limite: z.coerce.number().int().min(1).max(100).optional() }),
    req.query,
  );
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);
  const lignes = await chercherDossiers(q.q ?? '', { compteId: q.compteId, limite: q.limite });
  if (p.comptes === null) return res.json(lignes);
  // Sans compte precise, on restreint au perimetre de l'utilisateur.
  const autorises = new Set(p.comptes);
  const ids = lignes.map((l) => l.id);
  if (!ids.length) return res.json([]);
  const comptes = await db
    .select({ id: schema.dossiers.id, compteId: schema.dossiers.compteId })
    .from(schema.dossiers)
    .where(inArray(schema.dossiers.id, ids));
  const parId = new Map(comptes.map((c) => [c.id, c.compteId]));
  res.json(lignes.filter((l) => autorises.has(parId.get(l.id) ?? -1)));
});

routesDossiers.post('/', exigerEcriture, async (req, res) => {
  const d = valider(dossierSchema, req.body);
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, d.compteId);
  const { dossier, cree } = await trouverOuCreerDossier(d as never, auteurDe(req));
  res.status(cree ? 201 : 200).json({ dossier, cree });
});

routesDossiers.get('/:id', async (req, res) => {
  const id = idParam(req);
  const dossier = await lireDossier(id);
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, dossier.compteId);

  const demandes = await demandesDuDossier(id);
  const avecTemps = await Promise.all(
    demandes.map(async (d) => ({ ...d, temps: await tempsDemande(d) })),
  );
  const echeancesDossier = await db
    .select()
    .from(schema.echeances)
    .where(and(eq(schema.echeances.dossierId, id), eq(schema.echeances.annulee, false)))
    .orderBy(asc(schema.echeances.echeanceLe));
  const piecesDossier = await db.select().from(schema.pieces).where(eq(schema.pieces.dossierId, id)).orderBy(desc(schema.pieces.creeLe));

  res.json({ dossier, demandes: avecTemps, echeances: echeancesDossier, pieces: piecesDossier });
});

routesDossiers.get('/:id/chronologie', async (req, res) => {
  const id = idParam(req);
  const dossier = await lireDossier(id);
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  res.json(await chronologieDossier(id));
});

routesDossiers.patch('/:id', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const dossier = await lireDossier(id);
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  res.json(await modifierDossier(id, valider(modificationDossierSchema, req.body) as never, auteurDe(req)));
});

// ---------------------------------------------------------------------------
// Echeances
// ---------------------------------------------------------------------------

export const routesEcheances = Router();
routesEcheances.use(exigerConnexion);

/** Echeances a venir, toutes familles de pilotage confondues, pour l'echeancier et les alertes. */
routesEcheances.get('/', async (req, res) => {
  const q = valider(
    z.object({ jours: z.coerce.number().int().min(0).max(365).optional(), compteId: z.coerce.number().int().positive().optional() }),
    req.query,
  );
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);
  const horizon = new Date(Date.now() + (q.jours ?? 30) * 86_400_000);
  const conditions = [eq(schema.echeances.annulee, false), gte(schema.echeances.echeanceLe, new Date(Date.now() - 7 * 86_400_000))];
  if (q.compteId) conditions.push(eq(schema.dossiers.compteId, q.compteId));
  const lignes = await db
    .select({
      echeance: schema.echeances,
      dossierId: schema.dossiers.id,
      dossier: schema.dossiers.libelle,
      client: schema.dossiers.client,
      compteId: schema.dossiers.compteId,
    })
    .from(schema.echeances)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.echeances.dossierId))
    .where(and(...conditions, lte(schema.echeances.echeanceLe, horizon)))
    .orderBy(asc(schema.echeances.echeanceLe))
    .limit(300);
  res.json(p.comptes === null ? lignes : lignes.filter((l) => p.comptes!.includes(l.compteId)));
});

routesEcheances.post('/', exigerEcriture, async (req, res) => {
  const d = valider(echeanceSchema, req.body);
  const dossier = await lireDossier(d.dossierId);
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema.demandes.dossierId, famille: schema.demandes.famille }).from(schema.demandes).where(eq(schema.demandes.id, d.demandeId));
    if (!demande || demande.dossierId !== d.dossierId) throw new ErreurHttp(400, 'La demande indiquee n’appartient pas a ce dossier');
    if (demande.famille === FAMILLE_HORS_PERIMETRE) throw new ErreurHttp(400, 'Une demande hors perimetre ne porte pas d’echeance');
  }
  const [echeance] = await db
    .insert(schema.echeances)
    .values({ ...d, creeParId: req.utilisateur!.id })
    .returning();
  await journaliser('echeance_creee', { utilisateurId: req.utilisateur!.id, entite: 'echeance', entiteId: echeance.id, details: { type: d.type, dossierId: d.dossierId } });
  res.status(201).json(echeance);
});

routesEcheances.patch('/:id', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const d = valider(modificationEcheanceSchema, req.body);
  const [existe] = await db
    .select({ echeance: schema.echeances, compteId: schema.dossiers.compteId })
    .from(schema.echeances)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.echeances.dossierId))
    .where(eq(schema.echeances.id, id));
  if (!existe) throw new ErreurHttp(404, 'Echeance introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), existe.compteId);
  const valeurs: Record<string, unknown> = { majLe: new Date() };
  if (d.libelle !== undefined) valeurs.libelle = d.libelle;
  if (d.echeanceLe !== undefined) valeurs.echeanceLe = d.echeanceLe;
  if (d.annulee !== undefined) valeurs.annulee = d.annulee;
  if (d.honoree !== undefined) valeurs.honoreeLe = d.honoree ? new Date() : null;
  const [maj] = await db.update(schema.echeances).set(valeurs).where(eq(schema.echeances.id, id)).returning();
  res.json(maj);
});
