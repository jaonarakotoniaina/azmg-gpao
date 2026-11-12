/** Utilitaires partages par les tests : base propre, comptes, requetes HTTP authentifiees. */
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { db, schema } from '../src/server/db/client';
import { creerUtilisateur } from '../src/server/modules/auth/service';
import { creerCompte, creerPoste } from '../src/server/modules/comptes/service';
import { initialiserChecklistsEtGrilles, initialiserReferentiel } from '../src/server/db/referentiel';
import { viderCacheParametres } from '../src/server/lib/parametres';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';
import type { Role } from '../src/shared/constantes';

export const MOT_DE_PASSE = 'MotDePasseDesTests2026';

/** Vide toutes les tables metier et restaure les referentiels. */
export async function baseVierge() {
  await db.execute(sql`
    TRUNCATE comptes_clients, utilisateurs, dossiers, demandes, evenements, transitions_statut,
      echeances, pieces, controles_envoi, controles_qualite, regles_typage, journal_actions,
      jobs_queue, ai_tasks, imports, sessions, reinitialisations, parametres, cron_runs,
      checklists, grilles_qualite, postes
    RESTART IDENTITY CASCADE`);
  viderCacheParametres();
  await initialiserReferentiel();
  await initialiserChecklistsEtGrilles();
}

export async function creerCompteDeTest(nom = 'Client de test', code = 'test') {
  return creerCompte({ nom, code, pays: 'Espagne', ville: 'Barcelone', fuseau: FUSEAU_CLIENT_DEFAUT }, AUTEUR_SYSTEME);
}

export async function creerPosteDeTest(compteId: number, collaborateurId: number | null = null) {
  return creerPoste({ compteId, intitule: 'Assistante export', collaborateurId }, AUTEUR_SYSTEME);
}

export async function creerUtilisateurDeTest(email: string, role: Role, nom = 'Utilisateur de test') {
  return creerUtilisateur({ email, nom, role, motDePasse: MOT_DE_PASSE });
}

export interface SessionTest {
  cookies: string[];
  csrf: string;
  utilisateurId: number;
}

/** Ouvre une session HTTP et renvoie de quoi signer les requetes qui ecrivent. */
export async function connecter(app: Express, email: string): Promise<SessionTest> {
  const r = await request(app).post('/api/auth/connexion').send({ email, motDePasse: MOT_DE_PASSE }).expect(200);
  const brut = r.headers['set-cookie'];
  const cookies = Array.isArray(brut) ? brut : [brut as unknown as string];
  return { cookies: cookies.map((c) => c.split(';')[0]), csrf: r.body.csrf, utilisateurId: r.body.utilisateur.id };
}

export function avecSession(requete: request.Test, session: SessionTest) {
  return requete.set('Cookie', session.cookies).set('x-csrf-token', session.csrf);
}

export { db, schema, request };
