/**
 * API HTTP : authentification, roles, perimetre de visibilite, saisie rapide, import.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { avecSession, baseVierge, connecter, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db, MOT_DE_PASSE, request, schema } from './aide';
import { creerApplication } from '../src/server/app';
import { creerPoste } from '../src/server/modules/comptes/service';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';

const app = creerApplication();
const CLASSEUR = path.resolve(__dirname, 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');

let compteA: number;
let compteB: number;
let idCollaborateur: number;

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, utilisateurs, dossiers, demandes, evenements, transitions_statut, echeances, imports, sessions, journal_actions, postes RESTART IDENTITY CASCADE`,
  );
  await creerUtilisateurDeTest('ceo@azmg-solutions.com', 'admin', 'Le CEO');
  const manager = await creerUtilisateurDeTest('manager@azmg-solutions.com', 'manager', 'Le manager');
  idCollaborateur = (await creerUtilisateurDeTest('collab@azmg-solutions.com', 'collaborateur', 'La collaboratrice')).id;
  await creerUtilisateurDeTest('client@exemple-client.test', 'client_lecture', 'La DO');

  compteA = (await creerCompteDeTest('Compte A', 'compte-a')).id;
  compteB = (await creerCompteDeTest('Compte B', 'compte-b')).id;
  await creerPosteDeTest(compteA, idCollaborateur);
  // Le manager pilote seulement le compte A.
  await db.update(schema.comptesClients).set({ managerId: manager.id }).where(sql`id = ${compteA}`);
  await creerPoste({ compteId: compteB, intitule: 'Autre poste', collaborateurId: null }, AUTEUR_SYSTEME);
});

describe('authentification', () => {
  it('refuse l’acces sans session', async () => {
    await request(app).get('/api/demandes/file').expect(401);
    await request(app).get('/api/auth/moi').expect(401);
  });

  it('ouvre une session et pose les deux cookies', async () => {
    const r = await request(app).post('/api/auth/connexion').send({ email: 'ceo@azmg-solutions.com', motDePasse: MOT_DE_PASSE }).expect(200);
    const cookies = (r.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toContain('azmg_gpao_session');
    expect(cookies).toContain('azmg_gpao_csrf');
    expect(cookies).toContain('HttpOnly');
    expect(r.body.utilisateur.role).toBe('admin');
  });

  it('refuse un mot de passe incorrect sans reveler si le compte existe', async () => {
    const connu = await request(app).post('/api/auth/connexion').send({ email: 'ceo@azmg-solutions.com', motDePasse: 'faux' }).expect(401);
    const inconnu = await request(app).post('/api/auth/connexion').send({ email: 'personne@exemple.test', motDePasse: 'faux' }).expect(401);
    expect(connu.body.erreur).toBe(inconnu.body.erreur);
  });

  it('exige le jeton CSRF sur une ecriture', async () => {
    const session = await connecter(app, 'ceo@azmg-solutions.com');
    // Sans l'en-tete, la requete est refusee meme avec un cookie de session valide.
    await request(app).post('/api/saisie/rapide').set('Cookie', session.cookies).send({}).expect(403);
  });

  it('ferme la session a la deconnexion', async () => {
    const session = await connecter(app, 'ceo@azmg-solutions.com');
    await avecSession(request(app).post('/api/auth/deconnexion'), session).expect(200);
    await request(app).get('/api/auth/moi').set('Cookie', session.cookies).expect(401);
  });

  it('ne revele pas si une adresse existe lors d’une demande de reinitialisation', async () => {
    const a = await request(app).post('/api/auth/mot-de-passe-oublie').send({ email: 'ceo@azmg-solutions.com' }).expect(200);
    const b = await request(app).post('/api/auth/mot-de-passe-oublie').send({ email: 'personne@exemple.test' }).expect(200);
    expect(a.body.message).toBe(b.body.message);
  });
});

describe('roles et perimetre', () => {
  it('l’administrateur voit tous les comptes', async () => {
    const session = await connecter(app, 'ceo@azmg-solutions.com');
    const r = await request(app).get('/api/comptes').set('Cookie', session.cookies).expect(200);
    expect(r.body).toHaveLength(2);
  });

  it('le manager ne voit que les comptes qu’il pilote', async () => {
    const session = await connecter(app, 'manager@azmg-solutions.com');
    const r = await request(app).get('/api/comptes').set('Cookie', session.cookies).expect(200);
    expect(r.body.map((c: { id: number }) => c.id)).toEqual([compteA]);
  });

  it('le collaborateur ne voit que les comptes ou il tient un poste', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const r = await request(app).get('/api/comptes').set('Cookie', session.cookies).expect(200);
    expect(r.body.map((c: { id: number }) => c.id)).toEqual([compteA]);
  });

  it('refuse l’acces a un dossier hors perimetre', async () => {
    const admin = await connecter(app, 'ceo@azmg-solutions.com');
    const creation = await avecSession(request(app).post('/api/dossiers'), admin)
      .send({ compteId: compteB, client: 'Client du compte B', produit: 'Produit' })
      .expect(201);
    const dossierId = creation.body.dossier.id;

    const collab = await connecter(app, 'collab@azmg-solutions.com');
    await request(app).get(`/api/dossiers/${dossierId}`).set('Cookie', collab.cookies).expect(403);
  });

  it('refuse a un collaborateur la creation d’un compte client', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    await avecSession(request(app).post('/api/comptes'), session).send({ nom: 'Nouveau compte' }).expect(403);
  });

  it('refuse au role de lecture seule toute ecriture', async () => {
    const session = await connecter(app, 'client@exemple-client.test');
    await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, famille: 'T01', objet: 'Essai', nouveauDossier: { client: 'Essai' } })
      .expect(403);
  });

  it('refuse a un non administrateur la modification des parametres', async () => {
    const session = await connecter(app, 'manager@azmg-solutions.com');
    const lecture = await request(app).get('/api/parametres').set('Cookie', session.cookies).expect(200);
    await avecSession(request(app).put('/api/parametres'), session).send(lecture.body.parametres).expect(403);
  });
});

describe('saisie rapide', () => {
  it('cree le dossier, la demande et l’evenement en un seul appel', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const r = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({
        compteId: compteA,
        nouveauDossier: { client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg', operation: 'aerien vers Alger' },
        famille: 'T01',
        objet: 'Cotation fret aerien',
        sens: 'entrant',
        nature: 'demande_entrante',
        interlocuteur: 'client',
        source: 'whatsapp',
        resume: 'Le client demande une cotation.',
      })
      .expect(201);

    expect(r.body.dossierCree).toBe(true);
    expect(r.body.demandeCreee).toBe(true);
    expect(r.body.demande.statut).toBe('nouveau');
    expect(r.body.evenementId).toBeGreaterThan(0);

    const file = await request(app).get('/api/demandes/file').set('Cookie', session.cookies).expect(200);
    expect(file.body).toHaveLength(1);
    expect(file.body[0].objet).toBe('Cotation fret aerien');
  });

  it('reutilise un dossier identique au lieu d’en creer un second', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const corps = {
      compteId: compteA,
      nouveauDossier: { client: 'Alpha Pharma', produit: 'Gelules 180 kg' },
      famille: 'T01',
      objet: 'Premiere demande',
      sens: 'entrant',
      nature: 'demande_entrante',
      source: 'saisie',
    };
    const a = await avecSession(request(app).post('/api/saisie/rapide'), session).send(corps).expect(201);
    const b = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ ...corps, objet: 'Deuxieme demande' })
      .expect(201);
    expect(b.body.dossierId).toBe(a.body.dossierId);
    expect(b.body.dossierCree).toBe(false);
    const dossiers = await db.select().from(schema.dossiers);
    expect(dossiers).toHaveLength(1);
  });

  it('refuse une saisie en famille hors perimetre', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const r = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, nouveauDossier: { client: 'Spam' }, famille: 'T00', objet: 'Newsletter', sens: 'entrant', nature: 'demande_entrante', source: 'mail' })
      .expect(400);
    expect(r.body.erreur).toMatch(/hors perimetre/i);
  });

  it('refuse une saisie sans dossier identifiable', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, famille: 'T01', objet: 'Sans dossier', sens: 'entrant', nature: 'demande_entrante', source: 'saisie' })
      .expect(400);
  });

  it('enregistre une note sans toucher au statut', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const saisie = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, nouveauDossier: { client: 'Alpha' }, famille: 'T01', objet: 'Cotation', sens: 'entrant', nature: 'demande_entrante', source: 'saisie' })
      .expect(201);
    const avant = saisie.body.demande.statut;
    await avecSession(request(app).post('/api/saisie/note'), session)
      .send({ demandeId: saisie.body.demande.id, texte: 'Transitaire rappele, reponse attendue demain.' })
      .expect(201);
    const fiche = await request(app).get(`/api/demandes/${saisie.body.demande.id}`).set('Cookie', session.cookies).expect(200);
    expect(fiche.body.demande.statut).toBe(avant);
    expect(fiche.body.evenements.some((e: { resume: string }) => e.resume?.includes('Transitaire rappele'))).toBe(true);
  });
});

describe('changement de statut par l’API', () => {
  it('horodate la transition et renvoie les temps', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const saisie = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, nouveauDossier: { client: 'Alpha' }, famille: 'T01', objet: 'Cotation', sens: 'entrant', nature: 'demande_entrante', source: 'saisie' })
      .expect(201);
    const r = await avecSession(request(app).post(`/api/demandes/${saisie.body.demande.id}/statut`), session)
      .send({ statut: 'attente_do', motif: 'validation du prix' })
      .expect(200);
    expect(r.body.demande.statut).toBe('attente_do');
    expect(r.body.demande.acteurAttendu).toBe('do');
    expect(r.body.temps).toHaveProperty('parActeur');

    const fiche = await request(app).get(`/api/demandes/${saisie.body.demande.id}`).set('Cookie', session.cookies).expect(200);
    expect(fiche.body.transitions).toHaveLength(2);
    expect(fiche.body.transitions[1].motif).toBe('validation du prix');
  });

  it('refuse un statut inconnu', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const saisie = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, nouveauDossier: { client: 'Alpha' }, famille: 'T01', objet: 'Cotation', sens: 'entrant', nature: 'demande_entrante', source: 'saisie' })
      .expect(201);
    await avecSession(request(app).post(`/api/demandes/${saisie.body.demande.id}/statut`), session).send({ statut: 'inconnu' }).expect(400);
  });
});

describe('import par l’API', () => {
  it('importe le classeur fictif et le rejoue sans doublon', async () => {
    const session = await connecter(app, 'ceo@azmg-solutions.com');
    const premier = await avecSession(request(app).post('/api/import/classeur'), session)
      .field('compteId', String(compteA))
      .attach('fichier', fs.readFileSync(CLASSEUR), 'SUIVI_MENSUEL_FICTIF_07-11.xlsx')
      .expect(201);
    expect(premier.body.bilan.dossiersCrees).toBe(6);

    const second = await avecSession(request(app).post('/api/import/classeur'), session)
      .field('compteId', String(compteA))
      .attach('fichier', fs.readFileSync(CLASSEUR), 'SUIVI_MENSUEL_FICTIF_07-11.xlsx')
      .expect(201);
    expect(second.body.bilan.dossiersCrees).toBe(0);

    const dossiers = await db.select().from(schema.dossiers);
    expect(dossiers).toHaveLength(6);
  });

  it('refuse un fichier qui n’est pas un .xlsx', async () => {
    const session = await connecter(app, 'ceo@azmg-solutions.com');
    await avecSession(request(app).post('/api/import/classeur'), session)
      .field('compteId', String(compteA))
      .attach('fichier', Buffer.from('texte'), 'notes.txt')
      .expect(400);
  });

  it('refuse l’import a un collaborateur', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    await avecSession(request(app).post('/api/import/classeur'), session)
      .field('compteId', String(compteA))
      .attach('fichier', fs.readFileSync(CLASSEUR), 'fictif.xlsx')
      .expect(403);
  });
});

describe('journal des actions', () => {
  it('trace la creation et le changement de statut avec leur auteur', async () => {
    const session = await connecter(app, 'collab@azmg-solutions.com');
    const saisie = await avecSession(request(app).post('/api/saisie/rapide'), session)
      .send({ compteId: compteA, nouveauDossier: { client: 'Alpha' }, famille: 'T01', objet: 'Cotation', sens: 'entrant', nature: 'demande_entrante', source: 'saisie' })
      .expect(201);
    await avecSession(request(app).post(`/api/demandes/${saisie.body.demande.id}/statut`), session).send({ statut: 'en_cours' }).expect(200);

    const lignes = await db.select().from(schema.journalActions);
    const actions = lignes.map((l) => l.action);
    expect(actions).toContain('dossier_cree');
    expect(actions).toContain('demande_creee');
    expect(actions).toContain('statut_change');
    // Les actions passees par l'API sont signees « humain » ; seules celles de la preparation
    // du jeu de donnees (comptes et postes crees par le service) portent « systeme ».
    const parApi = lignes.filter((l) => ['dossier_cree', 'demande_creee', 'statut_change', 'evenement_ajoute', 'connexion'].includes(l.action));
    expect(parApi.every((l) => l.auteurType === 'humain')).toBe(true);
    expect(parApi.every((l) => l.utilisateurId === idCollaborateur)).toBe(true);
    expect(lignes.filter((l) => l.action === 'statut_change')[0].utilisateurId).toBe(idCollaborateur);
  });
});

describe('sante du service', () => {
  it('repond sur /health', async () => {
    const r = await request(app).get('/health').expect(200);
    expect(r.body.statut).toBe('ok');
    expect(r.body.service).toBe('AZMG GPAO');
  });

  it('annonce l’etat des migrations dans /health', async () => {
    // Une mise en ligne peut servir le bon code sur une base restee en arriere : le controle de
    // sante doit permettre de le voir de l'exterieur, sans ouvrir de session.
    const r = await request(app).get('/health').expect(200);
    expect(r.body.migrations.attendues).toBeGreaterThan(0);
    expect(r.body.migrations.appliquees).toBe(r.body.migrations.attendues);
    expect(r.body.migrations.derniere).toMatch(/^\d{4}_/);
    expect(r.body.migrations.aJour).toBe(true);
  });

  it('ne divulgue aucun secret dans /health', async () => {
    const r = await request(app).get('/health').expect(200);
    const texte = JSON.stringify(r.body).toLowerCase();
    for (const mot of ['password', 'secret', 'token', 'motdepasse', 'postgresql://']) {
      expect(texte, `« ${mot} » ne doit pas apparaitre dans /health`).not.toContain(mot);
    }
  });

  it('renvoie une erreur JSON sur une route d’API inconnue', async () => {
    const r = await request(app).get('/api/inexistant').expect(404);
    expect(r.body.erreur).toBe('Route inconnue');
  });
});
