/** Authentification : mots de passe argon2id, sessions en base, reinitialisation par jeton. */
import crypto from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { jetonAleatoire, sha256 } from '../../lib/securite';
import type { Role } from '@shared/constantes';

export const DUREE_SESSION_MS = 12 * 3600_000;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return argon2id({
    password: motDePasse,
    salt: crypto.randomBytes(16),
    parallelism: 1,
    iterations: 3,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verifierMotDePasse(motDePasse: string, hache: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: motDePasse, hash: hache });
  } catch {
    return false;
  }
}

export interface Utilisateur {
  id: number;
  email: string;
  nom: string;
  role: Role;
}

export async function creerUtilisateur(u: { email: string; nom: string; role: Role; motDePasse: string }) {
  const [ligne] = await db
    .insert(schema.utilisateurs)
    .values({ email: u.email.trim().toLowerCase(), nom: u.nom, role: u.role, motDePasseHash: await hacherMotDePasse(u.motDePasse) })
    .returning();
  return ligne;
}

// Empreinte factice : meme cout de calcul si l'email est inconnu (pas de fuite par le temps de reponse).
let empreinteFactice: string | null = null;

export async function authentifier(email: string, motDePasse: string) {
  const [u] = await db.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) {
    empreinteFactice ??= await hacherMotDePasse('mot-de-passe-factice');
    await verifierMotDePasse(motDePasse, empreinteFactice);
    return null;
  }
  if (!(await verifierMotDePasse(motDePasse, u.motDePasseHash))) return null;
  await db.update(schema.utilisateurs).set({ derniereConnexionLe: new Date() }).where(eq(schema.utilisateurs.id, u.id));
  return u;
}

export async function ouvrirSession(utilisateurId: number) {
  const jeton = jetonAleatoire(32);
  const csrf = jetonAleatoire(24);
  await db.delete(schema.sessions).where(lt(schema.sessions.expireLe, new Date()));
  await db.insert(schema.sessions).values({ id: sha256(jeton), utilisateurId, jetonCsrf: csrf, expireLe: new Date(Date.now() + DUREE_SESSION_MS) });
  return { jeton, csrf };
}

export async function lireSession(jeton: string | undefined) {
  if (!jeton) return null;
  const [ligne] = await db
    .select({ session: schema.sessions, utilisateur: schema.utilisateurs })
    .from(schema.sessions)
    .innerJoin(schema.utilisateurs, eq(schema.utilisateurs.id, schema.sessions.utilisateurId))
    .where(and(eq(schema.sessions.id, sha256(jeton)), gt(schema.sessions.expireLe, new Date()), eq(schema.utilisateurs.actif, true)));
  if (!ligne) return null;
  // Session glissante : prolongee si plus de la moitie de sa duree est ecoulee.
  if (ligne.session.expireLe.getTime() - Date.now() < DUREE_SESSION_MS / 2) {
    await db.update(schema.sessions).set({ expireLe: new Date(Date.now() + DUREE_SESSION_MS) }).where(eq(schema.sessions.id, ligne.session.id));
  }
  return {
    utilisateur: { id: ligne.utilisateur.id, email: ligne.utilisateur.email, nom: ligne.utilisateur.nom, role: ligne.utilisateur.role } as Utilisateur,
    csrf: ligne.session.jetonCsrf,
  };
}

export async function fermerSession(jeton: string | undefined) {
  if (jeton) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(jeton)));
}

/**
 * Prepare une reinitialisation de mot de passe et renvoie le lien.
 * L'envoi du mail passe par l'adaptateur SMTP (mode `mock` tant que le serveur n'est pas fourni) :
 * en mode simule, le lien est seulement trace dans le journal applicatif.
 */
export async function demanderReinitialisation(email: string): Promise<string | null> {
  const [u] = await db.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email.trim().toLowerCase()));
  if (!u || !u.actif) return null; // reponse identique cote API : aucune enumeration des comptes
  const jeton = jetonAleatoire(32);
  await db.insert(schema.reinitialisations).values({ utilisateurId: u.id, jetonHash: sha256(jeton), expireLe: new Date(Date.now() + 3600_000) });
  return jeton;
}

export async function reinitialiserMotDePasse(jeton: string, motDePasse: string): Promise<boolean> {
  const [r] = await db
    .select()
    .from(schema.reinitialisations)
    .where(
      and(
        eq(schema.reinitialisations.jetonHash, sha256(jeton)),
        isNull(schema.reinitialisations.utiliseLe),
        gt(schema.reinitialisations.expireLe, new Date()),
      ),
    );
  if (!r) return false;
  await db
    .update(schema.utilisateurs)
    .set({ motDePasseHash: await hacherMotDePasse(motDePasse), majLe: new Date() })
    .where(eq(schema.utilisateurs.id, r.utilisateurId));
  await db.update(schema.reinitialisations).set({ utiliseLe: new Date() }).where(eq(schema.reinitialisations.id, r.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.utilisateurId, r.utilisateurId));
  return true;
}
