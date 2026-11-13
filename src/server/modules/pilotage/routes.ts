/** Routes de pilotage : comptes clients, postes, parametres, referentiels. */
import { Router } from 'express';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { integrationsSimulees } from '../../config';
import { enregistrerParametres, lireParametres } from '../../lib/parametres';
import { perimetreDe, exigerCompte } from '../../lib/perimetre';
import { exigerConnexion, exigerRole } from '../auth/middleware';
import { creerCompte, creerPoste, listerComptes, listerPostes, modifierCompte, modifierPoste } from '../comptes/service';
import { accompagnement, ecartsPriorite } from './accompagnement';
import { compteSchema, modificationCompteSchema, modificationPosteSchema, posteSchema } from '@shared/validation';
import { parametresSchema } from '@shared/parametres';
import { auteurDe } from '../../lib/auteur';
import { FAMILLES, DEFINITIONS_NATURES, DEFINITIONS_STATUTS, INTERLOCUTEURS, LIBELLES_INTERLOCUTEURS } from '@shared/constantes';

export const routesComptes = Router();
routesComptes.use(exigerConnexion);

routesComptes.get('/', async (req, res) => {
  const p = await perimetreDe(req.utilisateur!);
  res.json(await listerComptes(p.comptes));
});

routesComptes.post('/', exigerRole('admin'), async (req, res) => {
  const d = valider(compteSchema, req.body);
  const compte = await creerCompte({ ...d, donneurOrdreEmail: d.donneurOrdreEmail || null }, auteurDe(req));
  res.status(201).json(compte);
});

routesComptes.patch('/:id', exigerRole('admin', 'manager'), async (req, res) => {
  const id = idParam(req);
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, id);
  const d = valider(modificationCompteSchema, req.body);
  res.json(await modifierCompte(id, d as never, auteurDe(req)));
});

export const routesPostes = Router();
routesPostes.use(exigerConnexion);

routesPostes.get('/', async (req, res) => {
  const p = await perimetreDe(req.utilisateur!);
  res.json(await listerPostes(p.comptes));
});

routesPostes.post('/', exigerRole('admin', 'manager'), async (req, res) => {
  const d = valider(posteSchema, req.body);
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, d.compteId);
  res.status(201).json(await creerPoste(d, auteurDe(req)));
});

routesPostes.patch('/:id', exigerRole('admin', 'manager'), async (req, res) => {
  const id = idParam(req);
  const [poste] = await db.select({ compteId: schema.postes.compteId }).from(schema.postes).where(eq(schema.postes.id, id));
  if (!poste) throw new ErreurHttp(404, 'Poste introuvable');
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, poste.compteId);
  res.json(await modifierPoste(id, valider(modificationPosteSchema, req.body), auteurDe(req)));
});

/**
 * Accompagnement d'un collaborateur : la pente entre deux semaines, pas une photographie.
 */
routesPostes.get('/:id/accompagnement', async (req, res) => {
  const id = idParam(req);
  const [poste] = await db.select({ compteId: schema.postes.compteId }).from(schema.postes).where(eq(schema.postes.id, id));
  if (!poste) throw new ErreurHttp(404, 'Poste introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), poste.compteId);

  const q = valider(
    z.object({
      debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
    req.query,
  );
  const fin = q.fin ? new Date(`${q.fin}T23:59:59.999Z`) : new Date();
  const debut = q.debut ? new Date(`${q.debut}T00:00:00.000Z`) : new Date(fin.getTime() - 28 * 86_400_000);
  const [bilan, ecarts] = await Promise.all([accompagnement(id, { debut, fin }), ecartsPriorite(id)]);
  res.json({ ...bilan, ecartsPriorite: ecarts });
});

export const routesParametres = Router();
routesParametres.use(exigerConnexion);

routesParametres.get('/', async (req, res) => {
  const p = await perimetreDe(req.utilisateur!);
  res.json({
    parametres: await lireParametres(),
    integrationsSimulees: integrationsSimulees(),
    perimetre: { comptes: p.comptes, postes: p.postes, lectureSeule: p.lectureSeule },
  });
});

routesParametres.put('/', exigerRole('admin'), async (req, res) => {
  const valides = valider(parametresSchema, req.body);
  res.json({ parametres: await enregistrerParametres(valides, req.utilisateur!.id) });
});

/** Referentiels : la base fait foi, les listes de code servent de secours au premier demarrage. */
export const routesReferentiels = Router();
routesReferentiels.use(exigerConnexion);

routesReferentiels.get('/', async (_req, res) => {
  const lignes = await db
    .select()
    .from(schema.referentiels)
    .where(eq(schema.referentiels.actif, true))
    .orderBy(asc(schema.referentiels.type), asc(schema.referentiels.ordre));
  if (lignes.length) {
    const parType: Record<string, typeof lignes> = {};
    for (const l of lignes) (parType[l.type] ??= []).push(l);
    return res.json(parType);
  }
  res.json({
    famille: FAMILLES.map((f, i) => ({ type: 'famille', code: f.code, libelle: f.libelle, attributs: f, ordre: i, actif: true })),
    nature: DEFINITIONS_NATURES.map((n, i) => ({ type: 'nature', code: n.code, libelle: n.libelle, attributs: n, ordre: i, actif: true })),
    statut: DEFINITIONS_STATUTS.map((s, i) => ({ type: 'statut', code: s.code, libelle: s.libelle, attributs: s, ordre: i, actif: true })),
    interlocuteur: INTERLOCUTEURS.map((c, i) => ({ type: 'interlocuteur', code: c, libelle: LIBELLES_INTERLOCUTEURS[c], attributs: {}, ordre: i, actif: true })),
  });
});

routesReferentiels.patch('/:id', exigerRole('admin'), async (req, res) => {
  const id = idParam(req);
  const d = valider(
    z.object({ libelle: z.string().trim().min(1).max(200).optional(), attributs: z.record(z.string(), z.unknown()).optional(), actif: z.boolean().optional(), ordre: z.number().int().optional() }),
    req.body,
  );
  const [maj] = await db.update(schema.referentiels).set({ ...d, majLe: new Date() }).where(eq(schema.referentiels.id, id)).returning();
  if (!maj) throw new ErreurHttp(404, 'Entree de referentiel introuvable');
  res.json(maj);
});

routesReferentiels.post('/', exigerRole('admin'), async (req, res) => {
  const d = valider(
    z.object({
      type: z.enum(['famille', 'nature', 'statut', 'interlocuteur', 'source', 'echeance']),
      code: z.string().trim().min(1).max(40),
      libelle: z.string().trim().min(1).max(200),
      attributs: z.record(z.string(), z.unknown()).optional(),
      ordre: z.number().int().optional(),
    }),
    req.body,
  );
  const [ligne] = await db
    .insert(schema.referentiels)
    .values({ ...d, attributs: d.attributs ?? {}, ordre: d.ordre ?? 100 })
    .onConflictDoNothing()
    .returning();
  if (!ligne) throw new ErreurHttp(409, 'Ce code existe deja pour ce type de referentiel');
  res.status(201).json(ligne);
});
