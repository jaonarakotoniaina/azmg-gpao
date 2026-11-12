import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { config } from '../../config';
import { ErreurHttp, idParam, valider } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { journal } from '../../lib/journal';
import { connexionSchema, creationUtilisateurSchema, modificationUtilisateurSchema, motDePasseSchema, emailSchema } from '@shared/validation';
import {
  authentifier,
  creerUtilisateur,
  demanderReinitialisation,
  DUREE_SESSION_MS,
  fermerSession,
  hacherMotDePasse,
  ouvrirSession,
  reinitialiserMotDePasse,
  verifierMotDePasse,
} from './service';
import { COOKIE_CSRF, COOKIE_SESSION, exigerConnexion, exigerRole, lireCookies } from './middleware';

function poserCookies(res: Response, jeton: string, csrf: string) {
  const commun = { sameSite: 'lax' as const, secure: config.production, path: '/', maxAge: DUREE_SESSION_MS };
  res.cookie(COOKIE_SESSION, jeton, { ...commun, httpOnly: true });
  res.cookie(COOKIE_CSRF, csrf, { ...commun, httpOnly: false });
}

const limiteConnexion = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.test ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, reessayez dans 15 minutes' },
});

export const routesAuth = Router();

routesAuth.post('/connexion', limiteConnexion, async (req, res) => {
  const { email, motDePasse } = valider(connexionSchema, req.body);
  const u = await authentifier(email, motDePasse);
  if (!u) throw new ErreurHttp(401, 'Email ou mot de passe incorrect');
  const { jeton, csrf } = await ouvrirSession(u.id);
  poserCookies(res, jeton, csrf);
  await journaliser('connexion', { utilisateurId: u.id, entite: 'utilisateur', entiteId: u.id });
  res.json({ utilisateur: { id: u.id, email: u.email, nom: u.nom, role: u.role }, csrf });
});

routesAuth.post('/deconnexion', async (req, res) => {
  await fermerSession(lireCookies(req)[COOKIE_SESSION]);
  res.clearCookie(COOKIE_SESSION, { path: '/' });
  res.clearCookie(COOKIE_CSRF, { path: '/' });
  res.json({ ok: true });
});

routesAuth.get('/moi', (req, res) => {
  if (!req.utilisateur) throw new ErreurHttp(401, 'Non connecte');
  res.json({ utilisateur: req.utilisateur, csrf: req.csrfAttendu });
});

routesAuth.post('/mot-de-passe-oublie', limiteConnexion, async (req, res) => {
  const { email } = valider(z.object({ email: emailSchema }), req.body);
  const jeton = await demanderReinitialisation(email);
  // Adaptateur SMTP en mode simule : le lien est trace dans le journal applicatif, jamais renvoye au client.
  if (jeton && config.smtp.mode === 'mock') {
    journal.info('Lien de reinitialisation prepare (envoi des emails en mode simule)', { lien: `${config.url}/reinitialiser?jeton=${jeton}` });
  }
  res.json({ ok: true, message: 'Si un compte existe pour cette adresse, un lien de reinitialisation vient d’etre prepare.' });
});

routesAuth.post('/reinitialiser', limiteConnexion, async (req, res) => {
  const { jeton, motDePasse } = valider(z.object({ jeton: z.string().min(10), motDePasse: motDePasseSchema }), req.body);
  if (!(await reinitialiserMotDePasse(jeton, motDePasse))) throw new ErreurHttp(400, 'Lien invalide ou expire');
  res.json({ ok: true });
});

routesAuth.post('/changer-mot-de-passe', exigerConnexion, async (req, res) => {
  const { actuel, nouveau } = valider(z.object({ actuel: z.string(), nouveau: motDePasseSchema }), req.body);
  const [u] = await db.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.id, req.utilisateur!.id));
  if (!u || !(await verifierMotDePasse(actuel, u.motDePasseHash))) throw new ErreurHttp(400, 'Mot de passe actuel incorrect');
  await db.update(schema.utilisateurs).set({ motDePasseHash: await hacherMotDePasse(nouveau), majLe: new Date() }).where(eq(schema.utilisateurs.id, u.id));
  res.json({ ok: true });
});

// Gestion des comptes utilisateurs
export const routesUtilisateurs = Router();
routesUtilisateurs.use(exigerConnexion);

routesUtilisateurs.get('/', exigerRole('admin', 'manager'), async (_req, res) => {
  const liste = await db
    .select({
      id: schema.utilisateurs.id,
      email: schema.utilisateurs.email,
      nom: schema.utilisateurs.nom,
      role: schema.utilisateurs.role,
      actif: schema.utilisateurs.actif,
      derniereConnexionLe: schema.utilisateurs.derniereConnexionLe,
    })
    .from(schema.utilisateurs)
    .orderBy(asc(schema.utilisateurs.nom));
  res.json(liste);
});

routesUtilisateurs.post('/', exigerRole('admin'), async (req, res) => {
  const d = valider(creationUtilisateurSchema, req.body);
  const [existe] = await db.select({ id: schema.utilisateurs.id }).from(schema.utilisateurs).where(eq(schema.utilisateurs.email, d.email));
  if (existe) throw new ErreurHttp(409, 'Un compte existe deja pour cet email');
  const u = await creerUtilisateur(d);
  await journaliser('utilisateur_cree', { utilisateurId: req.utilisateur!.id, entite: 'utilisateur', entiteId: u.id, details: { role: d.role } });
  res.status(201).json({ id: u.id });
});

routesUtilisateurs.patch('/:id', exigerRole('admin'), async (req, res) => {
  const id = idParam(req);
  const d = valider(modificationUtilisateurSchema, req.body);
  if (id === req.utilisateur!.id && (d.actif === false || (d.role && d.role !== 'admin'))) {
    throw new ErreurHttp(400, 'Vous ne pouvez pas retirer vos propres droits d’administrateur');
  }
  const [maj] = await db.update(schema.utilisateurs).set({ ...d, majLe: new Date() }).where(eq(schema.utilisateurs.id, id)).returning();
  if (!maj) throw new ErreurHttp(404, 'Utilisateur introuvable');
  if (d.actif === false) await db.delete(schema.sessions).where(eq(schema.sessions.utilisateurId, id));
  await journaliser('utilisateur_modifie', { utilisateurId: req.utilisateur!.id, entite: 'utilisateur', entiteId: id, details: d });
  res.json({ ok: true });
});
