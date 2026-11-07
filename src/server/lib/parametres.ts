/** Lecture et ecriture des parametres, avec fusion des valeurs par defaut et cache court. */
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { AUTOMATISATIONS, parametresParDefaut, parametresSchema, type Parametres } from '@shared/parametres';
import type { HorairesOuvres } from '@shared/heures-ouvrees';

const CLE = 'parametres';
let cache: { valeur: Parametres; lu: number } | null = null;

/** Fusionne les parametres enregistres avec les valeurs par defaut (nouvelles cles incluses). */
function fusionner(enregistres: Partial<Parametres> | undefined): Parametres {
  const defaut = parametresParDefaut();
  if (!enregistres) return defaut;
  const fusion = { ...defaut, ...enregistres } as Parametres;
  fusion.automatisations = { ...defaut.automatisations, ...(enregistres.automatisations ?? {}) };
  fusion.horaires = { ...defaut.horaires, ...(enregistres.horaires ?? {}) };
  fusion.sla = {
    ...defaut.sla,
    ...(enregistres.sla ?? {}),
    parFamille: { ...defaut.sla.parFamille, ...(enregistres.sla?.parFamille ?? {}) },
    relances: { ...defaut.sla.relances, ...(enregistres.sla?.relances ?? {}) },
  };
  fusion.alertes = { ...defaut.alertes, ...(enregistres.alertes ?? {}) };
  fusion.qualite = { ...defaut.qualite, ...(enregistres.qualite ?? {}) };
  for (const a of AUTOMATISATIONS) fusion.automatisations[a.cle] ??= { mode: a.defaut, actif: true };
  return fusion;
}

export async function lireParametres(): Promise<Parametres> {
  if (cache && Date.now() - cache.lu < 2000) return cache.valeur;
  const [ligne] = await db.select().from(schema.parametres).where(eq(schema.parametres.cle, CLE));
  const valeur = fusionner(ligne?.valeur as Partial<Parametres> | undefined);
  cache = { valeur, lu: Date.now() };
  return valeur;
}

export async function enregistrerParametres(nouveaux: unknown, utilisateurId: number | null): Promise<Parametres> {
  const valides = fusionner(parametresSchema.parse(nouveaux));
  await db
    .insert(schema.parametres)
    .values({ cle: CLE, valeur: valides, modifiePar: utilisateurId })
    .onConflictDoUpdate({ target: schema.parametres.cle, set: { valeur: valides, modifiePar: utilisateurId, majLe: new Date() } });
  cache = null;
  return valides;
}

export async function modifierParametres(modif: (p: Parametres) => void, utilisateurId: number | null = null) {
  const p = structuredClone(await lireParametres());
  modif(p);
  return enregistrerParametres(p, utilisateurId);
}

export function viderCacheParametres() {
  cache = null;
}

/**
 * Horaires ouvres applicables a un compte client : ceux du compte s'ils sont definis,
 * sinon les horaires generaux des parametres.
 */
export async function horairesDuCompte(compteId: number | null | undefined): Promise<HorairesOuvres> {
  const p = await lireParametres();
  if (!compteId) return p.horaires;
  const [compte] = await db
    .select({ horaires: schema.comptesClients.horaires })
    .from(schema.comptesClients)
    .where(eq(schema.comptesClients.id, compteId));
  const propres = compte?.horaires as HorairesOuvres | null | undefined;
  if (!propres) return p.horaires;
  return { ...p.horaires, ...propres };
}
