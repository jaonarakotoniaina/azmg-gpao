/** Route d'export du reporting : le classeur de destination est fourni par l'utilisateur. */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../../config';
import { ErreurHttp, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerRole } from '../auth/middleware';
import { construireBlocJour, exporterReporting } from './service';

const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.tailleMaxImportOctets, files: 1 },
  fileFilter: (_req, fichier, callback) => {
    if (!/\.xlsx$/i.test(fichier.originalname)) return callback(new ErreurHttp(400, 'Seuls les classeurs .xlsx sont acceptes'));
    callback(null, true);
  },
});

const jourSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Jour attendu au format AAAA-MM-JJ');

export const routesExport = Router();
routesExport.use(exigerConnexion);

/** Apercu des lignes qui seront ecrites, sans toucher au classeur. */
routesExport.get('/apercu', async (req, res) => {
  const q = valider(z.object({ compteId: z.coerce.number().int().positive(), jour: jourSchema }), req.query);
  exigerCompte(await perimetreDe(req.utilisateur!), q.compteId);
  res.json(await construireBlocJour(q.compteId, q.jour));
});

/**
 * Ecrit dans le classeur fourni et renvoie le fichier modifie.
 * Le classeur d'origine n'est jamais conserve ni ecrase : l'utilisateur telecharge une copie.
 */
routesExport.post('/reporting', exigerRole('admin', 'manager'), envoi.single('fichier'), async (req, res) => {
  if (!req.file) throw new ErreurHttp(400, 'Aucun classeur recu (champ « fichier » attendu)');
  const d = valider(
    z.object({
      compteId: z.coerce.number().int().positive(),
      jours: z.string().min(10),
      ongletSemaine: z.enum(['0', '1', 'true', 'false']).optional(),
    }),
    req.body,
  );
  exigerCompte(await perimetreDe(req.utilisateur!), d.compteId);

  const jours = d.jours.split(',').map((j) => j.trim()).filter(Boolean);
  for (const j of jours) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j)) throw new ErreurHttp(400, `Jour invalide : ${j}. Format attendu AAAA-MM-JJ.`);
  }

  const { fichier, bilan } = await exporterReporting(
    req.file.buffer,
    { compteId: d.compteId, jours, ongletSemaine: d.ongletSemaine === '1' || d.ongletSemaine === 'true' },
    auteurDe(req),
  );

  res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('content-disposition', `attachment; filename="${req.file.originalname.replace(/\.xlsx$/i, '')}-complete.xlsx"`);
  // Le bilan accompagne le fichier dans un en-tete, pour que l'interface puisse l'afficher.
  res.setHeader('x-bilan-export', encodeURIComponent(JSON.stringify(bilan)));
  res.send(fichier);
});
