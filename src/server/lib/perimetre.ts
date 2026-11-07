/**
 * Perimetre de visibilite par role (section 5 de CLAUDE.md).
 *
 *  - admin           : tous les comptes ;
 *  - manager         : les comptes qu'il pilote ;
 *  - collaborateur   : les comptes ou il tient un poste (sa file, ses dossiers) ;
 *  - client_lecture  : les comptes ou il est declare, en lecture seule.
 */
import { eq, or } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { ErreurHttp } from './http';
import type { Utilisateur } from '../modules/auth/service';

export interface Perimetre {
  /** `null` : acces a tous les comptes (administrateur). */
  comptes: number[] | null;
  /** Postes tenus par l'utilisateur, pour filtrer sa propre file. */
  postes: number[];
  /** Postes tenus, avec leur compte : sert a rattacher un dossier cree a la volee au bon poste. */
  postesParCompte: { id: number; compteId: number }[];
  lectureSeule: boolean;
}

export async function perimetreDe(u: Utilisateur): Promise<Perimetre> {
  if (u.role === 'admin') {
    const postes = await db
      .select({ id: schema.postes.id, compteId: schema.postes.compteId })
      .from(schema.postes)
      .where(eq(schema.postes.collaborateurId, u.id));
    return { comptes: null, postes: postes.map((p) => p.id), postesParCompte: postes, lectureSeule: false };
  }

  const postes = await db
    .select({ id: schema.postes.id, compteId: schema.postes.compteId })
    .from(schema.postes)
    .where(eq(schema.postes.collaborateurId, u.id));
  const comptesGeres = await db
    .select({ id: schema.comptesClients.id })
    .from(schema.comptesClients)
    .where(eq(schema.comptesClients.managerId, u.id));

  const comptes = [...new Set([...postes.map((p) => p.compteId), ...comptesGeres.map((c) => c.id)])];
  return { comptes, postes: postes.map((p) => p.id), postesParCompte: postes, lectureSeule: u.role === 'client_lecture' };
}

/** Verifie l'acces a un compte, et le refuse avec un 403 explicite sinon. */
export function exigerCompte(perimetre: Perimetre, compteId: number) {
  if (perimetre.comptes === null) return;
  if (!perimetre.comptes.includes(compteId)) throw new ErreurHttp(403, "Ce compte client n'est pas dans votre perimetre");
}

/** Poste tenu par l'utilisateur sur un compte donne, s'il en tient un. */
export function posteSurCompte(perimetre: Perimetre, compteId: number): number | null {
  return perimetre.postesParCompte.find((p) => p.compteId === compteId)?.id ?? null;
}

/** Compte utilisable par defaut : l'unique compte du perimetre, sinon aucun. */
export function compteParDefaut(perimetre: Perimetre): number | null {
  if (perimetre.comptes && perimetre.comptes.length === 1) return perimetre.comptes[0];
  return null;
}

export { or };
