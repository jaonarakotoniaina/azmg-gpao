/** Routes des demandes : file du jour, fiche, transitions, saisie rapide. */
import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { auteurDe } from '../../lib/auteur';
import { journaliser } from '../../lib/evenements';
import { lireParametres } from '../../lib/parametres';
import { compteParDefaut, exigerCompte, perimetreDe, posteSurCompte } from '../../lib/perimetre';
import { exigerConnexion, exigerEcriture } from '../auth/middleware';
import { calculerSla, changerStatut, creerDemande, demandesDuDossier, enregistrerRelance, fileDuJour, tempsDemande, tempsDesDemandes } from './service';
import { evenementsDeLaDemande, ajouterEvenement } from '../evenements/service';
import { lireDossier, trouverOuCreerDossier } from '../dossiers/service';
import { changementStatutSchema, demandeSchema, filtresFileSchema, modificationDemandeSchema, saisieRapideSchema } from '@shared/validation';
import { estHorsPerimetre, FAMILLE_HORS_PERIMETRE } from '@shared/constantes';

export const routesDemandes = Router();
routesDemandes.use(exigerConnexion);

/**
 * File de travail. Sans `posteId` ni `compteId`, un collaborateur voit ses propres postes :
 * c'est sa file du jour. Un manager ou un administrateur voit tout son perimetre.
 */
routesDemandes.get('/file', async (req, res) => {
  const q = valider(filtresFileSchema, req.query);
  const p = await perimetreDe(req.utilisateur!);
  if (q.compteId) exigerCompte(p, q.compteId);

  const posteId = q.posteId ?? (!q.compteId && req.utilisateur!.role === 'collaborateur' && p.postes.length === 1 ? p.postes[0] : undefined);
  if (q.posteId) {
    const [poste] = await db.select({ compteId: schema.postes.compteId }).from(schema.postes).where(eq(schema.postes.id, q.posteId));
    if (!poste) throw new ErreurHttp(404, 'Poste introuvable');
    exigerCompte(p, poste.compteId);
  }

  const lignes = await fileDuJour({
    compteId: q.compteId ?? (!posteId ? (compteParDefaut(p) ?? undefined) : undefined),
    posteId,
    familles: q.famille ? [q.famille] : undefined,
    acteurs: q.acteur ? [q.acteur] : undefined,
    statuts: q.statut ? [q.statut] : undefined,
    risqueSeulement: q.risque === '1' || q.risque === 'true',
    limite: q.limite,
  });
  // Dernier filet : un collaborateur sans poste ni compte ne voit rien plutot que tout.
  const visibles = p.comptes === null ? lignes : await filtrerParPerimetre(lignes, p.comptes);
  res.json(visibles);
});

async function filtrerParPerimetre<T extends { id: number }>(lignes: T[], comptes: number[]): Promise<T[]> {
  if (!lignes.length) return [];
  if (!comptes.length) return [];
  const rattachements = await db
    .select({ id: schema.demandes.id, compteId: schema.demandes.compteId })
    .from(schema.demandes)
    .where(and(inArray(schema.demandes.id, lignes.map((l) => l.id)), inArray(schema.demandes.compteId, comptes)));
  const autorises = new Set(rattachements.map((r) => r.id));
  return lignes.filter((l) => autorises.has(l.id));
}

routesDemandes.get('/:id', async (req, res) => {
  const id = idParam(req);
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, id));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  if (estHorsPerimetre(demande.famille)) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);

  const dossier = await lireDossier(demande.dossierId);
  const transitions = await db
    .select()
    .from(schema.transitionsStatut)
    .where(eq(schema.transitionsStatut.demandeId, id))
    .orderBy(schema.transitionsStatut.survenuLe);
  res.json({
    demande,
    dossier,
    temps: await tempsDemande(demande),
    transitions,
    evenements: await evenementsDeLaDemande(id),
  });
});

routesDemandes.post('/', exigerEcriture, async (req, res) => {
  const d = valider(demandeSchema, req.body);
  const dossier = await lireDossier(d.dossierId);
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  const demande = await creerDemande(d as never, auteurDe(req));
  res.status(201).json(demande);
});

routesDemandes.patch('/:id', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const d = valider(modificationDemandeSchema, req.body);
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, id));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
  if (d.famille && estHorsPerimetre(d.famille)) {
    throw new ErreurHttp(400, `Une demande ne peut pas passer en famille ${FAMILLE_HORS_PERIMETRE} : supprimez-la ou reclassez l’evenement`);
  }

  const valeurs: Record<string, unknown> = { majLe: new Date() };
  for (const champ of ['objet', 'famille', 'priorite', 'echeanceLe', 'notes', 'posteId'] as const) {
    if (d[champ] !== undefined) valeurs[champ] = d[champ];
  }
  // Un changement de famille redefinit la cible SLA.
  if (d.famille && d.famille !== demande.famille) {
    const sla = await calculerSla(demande.compteId, d.famille, demande.ouverteLe);
    valeurs.slaHeures = sla.heures;
    valeurs.slaEcheanceLe = sla.echeance;
  }
  const [maj] = await db.update(schema.demandes).set(valeurs).where(eq(schema.demandes.id, id)).returning();
  await journaliser('demande_modifiee', { utilisateurId: req.utilisateur!.id, entite: 'demande', entiteId: id, details: { champs: Object.keys(valeurs) } });
  res.json(maj);
});

routesDemandes.post('/:id/statut', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const d = valider(changementStatutSchema, req.body);
  const [demande] = await db.select({ compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, id));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
  const maj = await changerStatut(id, d.statut, auteurDe(req), { motif: d.motif ?? null, acteurAttendu: d.acteurAttendu });
  res.json({ demande: maj, temps: await tempsDemande(maj) });
});

routesDemandes.post('/:id/relance', exigerEcriture, async (req, res) => {
  const id = idParam(req);
  const [demande] = await db.select({ compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, id));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
  res.json(await enregistrerRelance(id, auteurDe(req)));
});

// ---------------------------------------------------------------------------
// Saisie rapide : un seul appel pour tenir l'objectif des 30 secondes
// ---------------------------------------------------------------------------

export const routesSaisie = Router();
routesSaisie.use(exigerConnexion);

/**
 * Cree, en une requete : le dossier s'il n'existe pas, la demande si la nature l'ouvre,
 * et l'evenement qui porte la consigne. Renvoie de quoi afficher immediatement le resultat.
 */
routesSaisie.post('/rapide', exigerEcriture, async (req, res) => {
  const d = valider(saisieRapideSchema, req.body);
  const p = await perimetreDe(req.utilisateur!);
  exigerCompte(p, d.compteId);
  const auteur = auteurDe(req);

  if (estHorsPerimetre(d.famille)) {
    throw new ErreurHttp(400, `La famille ${FAMILLE_HORS_PERIMETRE} est hors perimetre du poste : rien n'est enregistre dans le pilotage`);
  }

  let dossierId = d.dossierId ?? null;
  let dossierCree = false;
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema.demandes.dossierId, compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
    exigerCompte(p, demande.compteId);
    dossierId = demande.dossierId;
  } else if (!dossierId) {
    const n = d.nouveauDossier!;
    // Sans poste explicite, le dossier est rattache au poste que l'utilisateur tient sur ce compte :
    // sans cela, la demande n'apparaitrait pas dans sa propre file du jour.
    const { dossier, cree } = await trouverOuCreerDossier(
      {
        compteId: d.compteId,
        posteId: n.posteId ?? posteSurCompte(p, d.compteId),
        client: n.client!,
        pays: n.pays ?? null,
        produit: n.produit ?? null,
        operation: n.operation ?? null,
        libelle: n.libelle,
        references: n.references,
      },
      auteur,
    );
    dossierId = dossier.id;
    dossierCree = cree;
  } else {
    const dossier = await lireDossier(dossierId);
    exigerCompte(p, dossier.compteId);
  }

  const resultat = await ajouterEvenement(
    {
      demandeId: d.demandeId ?? null,
      dossierId,
      sens: d.sens,
      nature: d.nature,
      famille: d.famille,
      interlocuteur: d.interlocuteur ?? null,
      source: d.source,
      survenuLe: d.survenuLe,
      objet: d.objet,
      resume: d.resume ?? null,
      contenu: d.contenu ?? null,
      priorite: d.priorite,
      echeanceLe: d.echeanceLe ?? null,
    },
    auteur,
  );

  res.status(201).json({
    dossierId,
    dossierCree,
    demande: resultat.demande,
    demandeCreee: resultat.demandeCreee,
    evenementId: resultat.evenement.id,
    statutApplique: resultat.statutApplique,
  });
});

/** Note libre sur un dossier ou une demande : trace sans effet sur le statut. */
routesSaisie.post('/note', exigerEcriture, async (req, res) => {
  const d = valider(
    z.object({
      dossierId: z.number().int().positive().nullish(),
      demandeId: z.number().int().positive().nullish(),
      texte: z.string().trim().min(1, 'La note est vide').max(5000),
    }).refine((v) => Boolean(v.dossierId || v.demandeId), { message: 'Rattachez la note a un dossier ou a une demande' }),
    req.body,
  );
  const auteur = auteurDe(req);
  let dossierId = d.dossierId ?? null;
  if (d.demandeId) {
    const [demande] = await db.select({ dossierId: schema.demandes.dossierId, compteId: schema.demandes.compteId }).from(schema.demandes).where(eq(schema.demandes.id, d.demandeId));
    if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
    exigerCompte(await perimetreDe(req.utilisateur!), demande.compteId);
    dossierId = demande.dossierId;
  } else {
    const dossier = await lireDossier(dossierId!);
    exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  }
  const resultat = await ajouterEvenement(
    { demandeId: d.demandeId ?? null, dossierId, sens: 'interne', nature: 'information', source: 'saisie', objet: 'Note interne', resume: d.texte },
    auteur,
  );
  res.status(201).json({ evenementId: resultat.evenement.id });
});

/** Demandes d'un dossier, avec les temps calcules (utilise par la fiche dossier). */
routesDemandes.get('/dossier/:id/liste', async (req, res) => {
  const id = idParam(req);
  const dossier = await lireDossier(id);
  exigerCompte(await perimetreDe(req.utilisateur!), dossier.compteId);
  const demandes = await demandesDuDossier(id);
  const temps = await tempsDesDemandes(demandes);
  res.json(demandes.map((d) => ({ ...d, temps: temps.get(d.id) })));
});

export { lireParametres };
