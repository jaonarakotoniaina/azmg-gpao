/** Route du tableau de bord. */
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, valider } from '../../lib/http';
import { compteParDefaut, exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion } from '../auth/middleware';
import { tableauDeBord } from './service';

export const routesIndicateurs = Router();
routesIndicateurs.use(exigerConnexion);

routesIndicateurs.get('/tableau-de-bord', async (req, res) => {
  const q = valider(
    z.object({
      compteId: z.coerce.number().int().positive().optional(),
      posteId: z.coerce.number().int().positive().optional(),
      jours: z.coerce.number().int().min(1).max(365).optional(),
    }),
    req.query,
  );
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);
  if (q.posteId) {
    const [poste] = await db.select({ compteId: schema.postes.compteId }).from(schema.postes).where(eq(schema.postes.id, q.posteId));
    if (!poste) throw new ErreurHttp(404, 'Poste introuvable');
    exigerCompte(p, poste.compteId);
  }

  // Sans compte precis, un utilisateur non administrateur reste borne a son perimetre.
  // Avec plusieurs comptes et aucun choix, on refuse plutot que de melanger des comptes clients.
  let compteId = q.compteId;
  if (!compteId && p.comptes !== null) {
    compteId = compteParDefaut(p) ?? undefined;
    if (!compteId) {
      if (!p.comptes.length) return res.json({ aucunCompte: true });
      throw new ErreurHttp(400, 'Choisissez un compte client : les indicateurs ne se cumulent pas entre comptes');
    }
  }

  res.json(await tableauDeBord(q.jours ?? 7, { compteId, posteId: q.posteId }));
});
