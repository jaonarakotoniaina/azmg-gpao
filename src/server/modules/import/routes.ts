/** Route d'import du classeur de suivi (onglet « Suivi Quotidien »). */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { config } from '../../config';
import { ErreurHttp, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerRole } from '../auth/middleware';
import { importerClasseur } from './service';

const TYPES_ACCEPTES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

/** Le classeur reste en memoire : il n'est pas conserve sur le disque, seul son bilan l'est. */
const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.tailleMaxImportOctets, files: 1 },
  fileFilter: (_req, fichier, callback) => {
    const extensionOk = /\.xlsx$/i.test(fichier.originalname);
    if (!extensionOk || !TYPES_ACCEPTES.has(fichier.mimetype)) {
      return callback(new ErreurHttp(400, 'Seuls les classeurs .xlsx sont acceptes'));
    }
    callback(null, true);
  },
});

export const routesImport = Router();
routesImport.use(exigerConnexion);

routesImport.post('/classeur', exigerRole('admin', 'manager'), envoi.single('fichier'), async (req, res) => {
  if (!req.file) throw new ErreurHttp(400, 'Aucun classeur recu (champ « fichier » attendu)');
  const d = valider(
    z.object({ compteId: z.coerce.number().int().positive(), posteId: z.coerce.number().int().positive().optional() }),
    req.body,
  );
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  const { bilan, dossiers } = await importerClasseur(
    req.file.buffer,
    { compteId: d.compteId, posteId: d.posteId ?? null, nomFichier: req.file.originalname },
    auteurDe(req),
  );
  res.status(201).json({ bilan, dossiers: dossiers.map((x) => ({ id: x.id, libelle: x.libelle, statut: x.statut, resume: x.resume })) });
});

/** Historique des imports d'un compte. */
routesImport.get('/', async (req, res) => {
  const d = valider(z.object({ compteId: z.coerce.number().int().positive() }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);
  const lignes = await db
    .select({
      id: schema.imports.id,
      nomFichier: schema.imports.nomFichier,
      bilan: schema.imports.bilan,
      jourDebut: schema.imports.jourDebut,
      jourFin: schema.imports.jourFin,
      creeLe: schema.imports.creeLe,
    })
    .from(schema.imports)
    .where(eq(schema.imports.compteId, d.compteId))
    .orderBy(desc(schema.imports.creeLe))
    .limit(50);
  res.json(lignes);
});
