/**
 * Dossiers : client x produit x operation. Un dossier regroupe les demandes, les evenements,
 * les echeances et les pieces d'une meme operation.
 *
 * Le rapprochement se fait sur une cle normalisee (client|produit|operation) unique par compte :
 * c'est ce qui rend l'import d'un classeur rejouable sans creer de doublon.
 */
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { cleDossier, normaliser } from '@shared/texte';
import { FAMILLE_HORS_PERIMETRE, LIBELLES_ECHEANCES, libelleStatut, type StatutDossier, type TypeEcheance } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

export type Dossier = typeof schema.dossiers.$inferSelect;

export interface EntreeDossier {
  compteId: number;
  posteId?: number | null;
  client: string;
  pays?: string | null;
  produit?: string | null;
  operation?: string | null;
  libelle?: string;
  statut?: StatutDossier;
  references?: Record<string, unknown>;
  notes?: string | null;
}

/** Libelle lisible par defaut : « LAM (Algerie) / Gelules 272 kg / aerien vers Alger ». */
export function libelleParDefaut(e: Pick<EntreeDossier, 'client' | 'pays' | 'produit' | 'operation'>): string {
  const tete = e.pays ? `${e.client} (${e.pays})` : e.client;
  return [tete, e.produit, e.operation].map((m) => m?.trim()).filter(Boolean).join(' / ');
}

/**
 * Cree le dossier s'il n'existe pas, le renvoie sinon.
 * Les champs vides d'un dossier existant sont completes par ceux de l'entree (enrichissement
 * progressif a l'import), mais un champ deja renseigne n'est jamais ecrase.
 */
export async function trouverOuCreerDossier(entree: EntreeDossier, auteur: Auteur): Promise<{ dossier: Dossier; cree: boolean }> {
  const client = entree.client.trim();
  if (!client) throw new ErreurHttp(400, 'Le client du dossier est obligatoire');
  const cle = cleDossier(client, entree.produit ?? '', entree.operation ?? '');
  if (!cle) throw new ErreurHttp(400, 'Le dossier doit porter au moins un client identifiable');

  const [existant] = await db
    .select()
    .from(schema.dossiers)
    .where(and(eq(schema.dossiers.compteId, entree.compteId), eq(schema.dossiers.cleRapprochement, cle)));

  if (existant) {
    const complements: Partial<Dossier> = {};
    if (!existant.pays && entree.pays) complements.pays = entree.pays;
    if (!existant.produit && entree.produit) complements.produit = entree.produit;
    if (!existant.operation && entree.operation) complements.operation = entree.operation;
    if (!existant.posteId && entree.posteId) complements.posteId = entree.posteId;
    if (entree.references && Object.keys(entree.references).length) {
      complements.references = { ...(existant.references as Record<string, unknown>), ...entree.references };
    }
    if (!Object.keys(complements).length) return { dossier: existant, cree: false };
    const [maj] = await db
      .update(schema.dossiers)
      .set({ ...complements, majLe: new Date() })
      .where(eq(schema.dossiers.id, existant.id))
      .returning();
    return { dossier: maj, cree: false };
  }

  const [dossier] = await db
    .insert(schema.dossiers)
    .values({
      compteId: entree.compteId,
      posteId: entree.posteId ?? null,
      client,
      pays: entree.pays ?? null,
      produit: entree.produit ?? null,
      operation: entree.operation ?? null,
      cleRapprochement: cle,
      libelle: entree.libelle?.trim() || libelleParDefaut({ ...entree, client }),
      statut: entree.statut ?? 'ouvert',
      references: entree.references ?? {},
      notes: entree.notes ?? null,
    })
    .returning();

  await journaliser('dossier_cree', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'dossier',
    entiteId: dossier.id,
    details: { client, produit: entree.produit ?? null, operation: entree.operation ?? null },
  });
  return { dossier, cree: true };
}

/**
 * Dossiers d'un compte dont le client et le produit correspondent, quelle que soit l'operation.
 *
 * Le classeur de suivi ne porte pas de colonne « operation » : un rapprochement strict sur
 * client|produit|operation creerait un second dossier a cote de celui que le poste a ouvert a la
 * saisie. On rapproche donc sur le prefixe client|produit, et l'import ne reutilise un dossier
 * que si la correspondance est unique (sinon il vaut mieux creer que se tromper de dossier).
 */
export async function dossiersParClientProduit(compteId: number, client: string, produit: string | null): Promise<Dossier[]> {
  const prefixe = cleDossier(client, produit ?? '', '');
  if (!prefixe) return [];
  return db
    .select()
    .from(schema.dossiers)
    .where(
      and(
        eq(schema.dossiers.compteId, compteId),
        // Le prefixe exact, ou le prefixe suivi du separateur d'operation.
        or(eq(schema.dossiers.cleRapprochement, prefixe), sql`${schema.dossiers.cleRapprochement} LIKE ${`${prefixe}|%`}`),
      ),
    );
}

export async function lireDossier(id: number): Promise<Dossier> {
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, id));
  if (!dossier) throw new ErreurHttp(404, 'Dossier introuvable');
  return dossier;
}

export async function modifierDossier(id: number, modifs: Partial<EntreeDossier> & { resume?: string | null }, auteur: Auteur): Promise<Dossier> {
  const dossier = await lireDossier(id);
  const valeurs: Record<string, unknown> = { majLe: new Date() };
  for (const champ of ['pays', 'produit', 'operation', 'libelle', 'statut', 'notes', 'resume', 'posteId'] as const) {
    if (modifs[champ as keyof typeof modifs] !== undefined) valeurs[champ] = modifs[champ as keyof typeof modifs];
  }
  if (modifs.client) {
    valeurs.client = modifs.client.trim();
    valeurs.cleRapprochement = cleDossier(
      String(valeurs.client),
      (modifs.produit ?? dossier.produit) ?? '',
      (modifs.operation ?? dossier.operation) ?? '',
    );
  } else if (modifs.produit !== undefined || modifs.operation !== undefined) {
    valeurs.cleRapprochement = cleDossier(dossier.client, (modifs.produit ?? dossier.produit) ?? '', (modifs.operation ?? dossier.operation) ?? '');
  }
  if (modifs.references) valeurs.references = { ...(dossier.references as Record<string, unknown>), ...modifs.references };
  if (modifs.statut === 'clos' || modifs.statut === 'annule') valeurs.clotureLe = new Date();
  if (modifs.statut === 'ouvert') valeurs.clotureLe = null;

  // Renommer un dossier peut le faire entrer en collision avec un dossier existant du meme
  // compte : on le dit clairement plutot que de laisser remonter une violation de contrainte.
  if (valeurs.cleRapprochement && valeurs.cleRapprochement !== dossier.cleRapprochement) {
    const [collision] = await db
      .select({ id: schema.dossiers.id, libelle: schema.dossiers.libelle })
      .from(schema.dossiers)
      .where(and(eq(schema.dossiers.compteId, dossier.compteId), eq(schema.dossiers.cleRapprochement, String(valeurs.cleRapprochement))));
    if (collision && collision.id !== id) {
      throw new ErreurHttp(409, `Un dossier identique existe deja sur ce compte : « ${collision.libelle} »`);
    }
  }

  const [maj] = await db.update(schema.dossiers).set(valeurs).where(eq(schema.dossiers.id, id)).returning();
  await journaliser('dossier_modifie', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'dossier',
    entiteId: id,
    details: { champs: Object.keys(valeurs).filter((c) => c !== 'majLe') },
  });
  return maj;
}

/**
 * Recherche de dossiers pour le rattachement en saisie rapide.
 * Un seul appel, resultat trie par pertinence puis fraicheur, pour une saisie en moins de 30 secondes.
 */
export async function chercherDossiers(terme: string, opts: { compteId?: number; limite?: number } = {}) {
  const motif = `%${terme.trim()}%`;
  const normalise = normaliser(terme);
  const conditions: SQL[] = [];
  if (opts.compteId) conditions.push(eq(schema.dossiers.compteId, opts.compteId));
  if (terme.trim()) {
    const recherche = or(
      ilike(schema.dossiers.libelle, motif),
      ilike(schema.dossiers.client, motif),
      ilike(schema.dossiers.produit, motif),
      ilike(schema.dossiers.operation, motif),
      ilike(schema.dossiers.pays, motif),
      normalise ? ilike(schema.dossiers.cleRapprochement, `%${normalise}%`) : undefined,
    );
    if (recherche) conditions.push(recherche);
  }
  return db
    .select({
      id: schema.dossiers.id,
      libelle: schema.dossiers.libelle,
      client: schema.dossiers.client,
      pays: schema.dossiers.pays,
      produit: schema.dossiers.produit,
      operation: schema.dossiers.operation,
      statut: schema.dossiers.statut,
      resume: schema.dossiers.resume,
      majLe: schema.dossiers.majLe,
      demandesOuvertes: sql<number>`(
        SELECT count(*)::int FROM demandes d
        WHERE d.dossier_id = ${schema.dossiers.id} AND d.statut NOT IN ('termine', 'annule') AND d.famille <> ${FAMILLE_HORS_PERIMETRE}
      )`.as('demandes_ouvertes'),
    })
    .from(schema.dossiers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.dossiers.majLe))
    .limit(Math.min(opts.limite ?? 20, 100));
}

/**
 * Chronologie complete d'un dossier : evenements, transitions, echeances et pieces,
 * fusionnes et tries par instant. Les evenements hors perimetre (T00) sont exclus.
 */
export interface LigneChronologie {
  type: 'evenement' | 'transition' | 'echeance' | 'piece';
  survenuLe: Date;
  titre: string;
  detail?: string | null;
  demandeId?: number | null;
  meta?: Record<string, unknown>;
}

export async function chronologieDossier(dossierId: number): Promise<LigneChronologie[]> {
  const evenements = await db
    .select()
    .from(schema.evenements)
    .where(and(eq(schema.evenements.dossierId, dossierId), sql`coalesce(${schema.evenements.famille}, '') <> ${FAMILLE_HORS_PERIMETRE}`))
    .orderBy(desc(schema.evenements.survenuLe))
    .limit(500);

  const transitions = await db
    .select({ t: schema.transitionsStatut, objet: schema.demandes.objet })
    .from(schema.transitionsStatut)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.transitionsStatut.demandeId))
    .where(and(eq(schema.demandes.dossierId, dossierId), sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`))
    .orderBy(desc(schema.transitionsStatut.survenuLe))
    .limit(500);

  const echeances = await db.select().from(schema.echeances).where(eq(schema.echeances.dossierId, dossierId)).limit(200);
  const pieces = await db.select().from(schema.pieces).where(eq(schema.pieces.dossierId, dossierId)).limit(200);

  const lignes: LigneChronologie[] = [
    ...evenements.map((e) => ({
      type: 'evenement' as const,
      survenuLe: e.survenuLe,
      titre: e.objet ?? e.resume ?? 'Evenement',
      detail: e.resume,
      demandeId: e.demandeId,
      meta: { sens: e.sens, nature: e.nature, interlocuteur: e.interlocuteur, source: e.source, famille: e.famille, confiance: e.confianceTypage },
    })),
    ...transitions.map((l) => ({
      type: 'transition' as const,
      survenuLe: l.t.survenuLe,
      titre: l.t.statutAvant
        ? `${l.objet} : ${libelleStatut(l.t.statutAvant)} vers ${libelleStatut(l.t.statutApres)}`
        : `${l.objet} : ouverture en ${libelleStatut(l.t.statutApres)}`,
      detail: l.t.motif,
      demandeId: l.t.demandeId,
      meta: { statutAvant: l.t.statutAvant, statutApres: l.t.statutApres, minutesOuvrees: l.t.minutesOuvrees, auteurType: l.t.auteurType },
    })),
    ...echeances.map((e) => ({
      type: 'echeance' as const,
      survenuLe: e.echeanceLe,
      titre: `${LIBELLES_ECHEANCES[e.type as TypeEcheance] ?? e.type}${e.libelle ? ` : ${e.libelle}` : ''}`,
      detail: e.phraseSource,
      demandeId: e.demandeId,
      meta: { honoreeLe: e.honoreeLe, annulee: e.annulee },
    })),
    ...pieces.map((p) => ({
      type: 'piece' as const,
      survenuLe: p.creeLe,
      titre: `${p.type}${p.reference ? ` ${p.reference}` : ''}`,
      detail: p.nomFichier,
      demandeId: p.demandeId,
      meta: { archive: p.archive },
    })),
  ];
  return lignes.sort((a, b) => b.survenuLe.getTime() - a.survenuLe.getTime());
}
