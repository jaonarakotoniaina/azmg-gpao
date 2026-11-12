/** Comptes clients et postes places. */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { normaliser } from '@shared/texte';
import { FAMILLE_HORS_PERIMETRE, FAMILLES_PAR_METIER, type Metier } from '@shared/constantes';
import type { Auteur } from '../demandes/service';
import type { HorairesOuvres } from '@shared/heures-ouvrees';

export type CompteClient = typeof schema.comptesClients.$inferSelect;
export type Poste = typeof schema.postes.$inferSelect;

export interface EntreeCompte {
  nom: string;
  code?: string;
  pays?: string | null;
  ville?: string | null;
  fuseau?: string;
  donneurOrdreNom?: string | null;
  donneurOrdreEmail?: string | null;
  managerId?: number | null;
  horaires?: HorairesOuvres | null;
}

export async function creerCompte(entree: EntreeCompte, auteur: Auteur): Promise<CompteClient> {
  const code = (entree.code?.trim() || normaliser(entree.nom).replace(/ /g, '-')).slice(0, 60);
  if (!code) throw new ErreurHttp(400, 'Le code du compte est obligatoire');
  const [existe] = await db.select({ id: schema.comptesClients.id }).from(schema.comptesClients).where(eq(schema.comptesClients.code, code));
  if (existe) throw new ErreurHttp(409, `Un compte client existe deja avec le code « ${code} »`);
  const [compte] = await db
    .insert(schema.comptesClients)
    .values({
      nom: entree.nom.trim(),
      code,
      pays: entree.pays ?? null,
      ville: entree.ville ?? null,
      fuseau: entree.fuseau ?? 'Europe/Madrid',
      donneurOrdreNom: entree.donneurOrdreNom ?? null,
      donneurOrdreEmail: entree.donneurOrdreEmail ?? null,
      managerId: entree.managerId ?? null,
      horaires: entree.horaires ?? null,
    })
    .returning();
  await journaliser('compte_cree', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'compte', entiteId: compte.id, details: { code } });
  return compte;
}

export async function modifierCompte(id: number, modifs: Partial<EntreeCompte> & { actif?: boolean }, auteur: Auteur): Promise<CompteClient> {
  const valeurs: Record<string, unknown> = { majLe: new Date() };
  for (const champ of ['nom', 'pays', 'ville', 'fuseau', 'donneurOrdreNom', 'donneurOrdreEmail', 'managerId', 'horaires', 'actif'] as const) {
    if (modifs[champ as keyof typeof modifs] !== undefined) valeurs[champ] = modifs[champ as keyof typeof modifs];
  }
  const [maj] = await db.update(schema.comptesClients).set(valeurs).where(eq(schema.comptesClients.id, id)).returning();
  if (!maj) throw new ErreurHttp(404, 'Compte client introuvable');
  await journaliser('compte_modifie', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'compte', entiteId: id, details: { champs: Object.keys(valeurs) } });
  return maj;
}

export async function listerComptes(comptes: number[] | null) {
  const lignes = await db
    .select({
      id: schema.comptesClients.id,
      nom: schema.comptesClients.nom,
      code: schema.comptesClients.code,
      pays: schema.comptesClients.pays,
      ville: schema.comptesClients.ville,
      fuseau: schema.comptesClients.fuseau,
      donneurOrdreNom: schema.comptesClients.donneurOrdreNom,
      donneurOrdreEmail: schema.comptesClients.donneurOrdreEmail,
      managerId: schema.comptesClients.managerId,
      actif: schema.comptesClients.actif,
      dossiersOuverts: sql<number>`(
        SELECT count(*)::int FROM dossiers d WHERE d.compte_id = ${schema.comptesClients.id} AND d.statut = 'ouvert'
      )`.as('dossiers_ouverts'),
      demandesOuvertes: sql<number>`(
        SELECT count(*)::int FROM demandes de
        WHERE de.compte_id = ${schema.comptesClients.id} AND de.statut NOT IN ('termine', 'annule') AND de.famille <> ${FAMILLE_HORS_PERIMETRE}
      )`.as('demandes_ouvertes'),
    })
    .from(schema.comptesClients)
    .orderBy(asc(schema.comptesClients.nom));
  return comptes === null ? lignes : lignes.filter((l) => comptes.includes(l.id));
}

export async function creerPoste(
  entree: { compteId: number; intitule: string; collaborateurId?: number | null; metier?: Metier; adresses?: string[]; familles?: string[] },
  auteur: Auteur,
): Promise<Poste> {
  const metier: Metier = entree.metier ?? 'export';
  const [poste] = await db
    .insert(schema.postes)
    .values({
      compteId: entree.compteId,
      intitule: entree.intitule.trim(),
      collaborateurId: entree.collaborateurId ?? null,
      metier,
      adresses: entree.adresses ?? [],
      // Le perimetre est pre-rempli d'apres le metier, puis ajustable dans Parametres.
      familles: entree.familles ?? [...FAMILLES_PAR_METIER[metier]],
    })
    .returning();
  await journaliser('poste_cree', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'poste', entiteId: poste.id, details: { compteId: entree.compteId } });
  return poste;
}

export async function modifierPoste(
  id: number,
  modifs: { intitule?: string; collaborateurId?: number | null; metier?: Metier; adresses?: string[]; familles?: string[]; actif?: boolean },
  auteur: Auteur,
): Promise<Poste> {
  const valeurs: Record<string, unknown> = { majLe: new Date() };
  for (const champ of ['intitule', 'collaborateurId', 'metier', 'adresses', 'familles', 'actif'] as const) {
    if (modifs[champ] !== undefined) valeurs[champ] = modifs[champ];
  }
  const [maj] = await db.update(schema.postes).set(valeurs).where(eq(schema.postes.id, id)).returning();
  if (!maj) throw new ErreurHttp(404, 'Poste introuvable');
  await journaliser('poste_modifie', { utilisateurId: auteur.utilisateurId, auteurType: auteur.type, entite: 'poste', entiteId: id, details: { champs: Object.keys(valeurs) } });
  return maj;
}

export async function listerPostes(comptes: number[] | null) {
  const lignes = await db
    .select({
      id: schema.postes.id,
      compteId: schema.postes.compteId,
      compte: schema.comptesClients.nom,
      intitule: schema.postes.intitule,
      collaborateurId: schema.postes.collaborateurId,
      collaborateur: schema.utilisateurs.nom,
      metier: schema.postes.metier,
      adresses: schema.postes.adresses,
      familles: schema.postes.familles,
      actif: schema.postes.actif,
    })
    .from(schema.postes)
    .innerJoin(schema.comptesClients, eq(schema.comptesClients.id, schema.postes.compteId))
    .leftJoin(schema.utilisateurs, eq(schema.utilisateurs.id, schema.postes.collaborateurId))
    .orderBy(asc(schema.comptesClients.nom), asc(schema.postes.intitule));
  return comptes === null ? lignes : lignes.filter((l) => comptes.includes(l.compteId));
}

export async function lireCompte(id: number): Promise<CompteClient> {
  const [compte] = await db.select().from(schema.comptesClients).where(eq(schema.comptesClients.id, id));
  if (!compte) throw new ErreurHttp(404, 'Compte client introuvable');
  return compte;
}

export { and };
