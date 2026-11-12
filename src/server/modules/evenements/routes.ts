/** Routes des evenements : ajout, file « A classer », correction du typage. */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { lireParametres } from '../../lib/parametres';
import { exigerCompte, perimetreDe } from '../../lib/perimetre';
import { exigerConnexion, exigerEcriture } from '../auth/middleware';
import { aClasser, ajouterEvenement, corrigerTypage } from './service';
import { lireDossier } from '../dossiers/service';
import { correctionTypageSchema, evenementSchema } from '@shared/validation';

export const routesEvenements = Router();
routesEvenements.use(exigerConnexion);

routesEvenements.post('/', exigerEcriture, async (req, res) => {
  const d = valider(evenementSchema, req.body);
  const p = await perimetreDe(req.utilisateur!);
  if (d.demandeId) {
    const [demande] = await db.select({ compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
    exigerCompte(p, demande.compteId);
  } else {
    const dossier = await lireDossier(d.dossierId!);
    exigerCompte(p, dossier.compteId);
  }
  // Le typage automatique ne comble que les trous : un champ saisi par un humain prime toujours.
  const resultat = await ajouterEvenement(d as never, auteurDe(req), { typerAutomatiquement: true });
  res.status(201).json({
    evenement: resultat.evenement,
    demande: resultat.demande,
    demandeCreee: resultat.demandeCreee,
    statutApplique: resultat.statutApplique,
    horsPerimetre: resultat.horsPerimetre,
  });
});

/** File « A classer » : typage sous le seuil de confiance ou famille absente. */
routesEvenements.get('/a-classer', async (req, res) => {
  const p = await perimetreDe(req.utilisateur!);
  const parametres = await lireParametres();
  const lignes = await aClasser(parametres.seuilConfianceTypage);
  res.json(p.comptes === null ? lignes : lignes.filter((l) => p.comptes!.includes(l.evenement.compteId)));
});

routesEvenements.post('/:id/typage', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const [evenement] = await db.select({ compteId: schema.evenements.compteId }).from(schema.evenements).where(eq(schema.evenements.id, id));
  if (!evenement) throw new ErreurHttp(404, 'Evenement introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), evenement.compteId);
  res.json(await corrigerTypage(id, valider(correctionTypageSchema, req.body) as never, auteurDe(req)));
});
