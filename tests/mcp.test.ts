/**
 * Connecteur Claude (MCP) : protocole, authentification, et les onze outils.
 * Critere de la phase 2 : « outils MCP testes ».
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db, request, schema } from './aide';
import { creerApplication } from '../src/server/app';
import { config } from '../src/server/config';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { ajouterEvenement } from '../src/server/modules/evenements/service';
import { changerStatut, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { OUTILS, traiterMessage } from '../src/server/modules/mcp/service';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';

const app = creerApplication();
const AUTEUR = AUTEUR_SYSTEME;
const JETON = config.mcp.jeton;

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

/** Appelle un outil et renvoie son resultat structure. */
async function appeler(name: string, args: Record<string, unknown> = {}) {
  const reponse = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })) as {
    result: { isError?: boolean; content: { text: string }[]; structuredContent?: unknown };
  };
  if (reponse.result.isError) throw new Error(reponse.result.content[0].text);
  return JSON.parse(reponse.result.content[0].text);
}

let compteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, utilisateurs, dossiers, demandes, evenements, transitions_statut, echeances, journal_actions RESTART IDENTITY CASCADE`,
  );
  await creerUtilisateurDeTest('ceo@azmg-solutions.com', 'admin', 'Le CEO');
  compteId = (await creerCompteDeTest()).id;
  const poste = await creerPosteDeTest(compteId);
  dossierId = (
    await trouverOuCreerDossier(
      { compteId, posteId: poste.id, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg', references: { BL: 'FICTIF-BL-001' } },
      AUTEUR,
    )
  ).dossier.id;
});

describe('authentification du connecteur', () => {
  it('refuse une requete sans en-tete', async () => {
    const r = await request(app).post('/mcp').send({ jsonrpc: '2.0', id: 1, method: 'ping' }).expect(401);
    expect(r.body.erreur).toMatch(/jeton/i);
  });

  it('refuse un jeton incorrect', async () => {
    await request(app).post('/mcp').set('Authorization', 'Bearer mauvaise-cle-qui-fait-bien-32-caracteres').send({ jsonrpc: '2.0', id: 1, method: 'ping' }).expect(401);
  });

  it('accepte le bon jeton', async () => {
    const r = await request(app).post('/mcp').set('Authorization', `Bearer ${JETON}`).send({ jsonrpc: '2.0', id: 1, method: 'ping' }).expect(200);
    expect(r.body).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  });

  it('repond 404 en JSON sur les adresses de decouverte OAuth', async () => {
    const r = await request(app).get('/.well-known/oauth-authorization-server').expect(404);
    expect(r.body.erreur).toBe('Introuvable');
  });

  it('expose l’etat du connecteur sur /health sans jamais la cle', async () => {
    await request(app).post('/mcp').set('Authorization', `Bearer ${JETON}`).send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const r = await request(app).get('/health').expect(200);
    expect(r.body.mcp.configure).toBe(true);
    expect(JSON.stringify(r.body.mcp)).not.toContain(JETON);
  });

  it('n’accepte que POST', async () => {
    await request(app).get('/mcp').set('Authorization', `Bearer ${JETON}`).expect(405);
  });
});

describe('protocole JSON-RPC', () => {
  it('repond a initialize avec les instructions du poste', async () => {
    const r = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })) as {
      result: { serverInfo: { name: string }; instructions: string };
    };
    expect(r.result.serverInfo.name).toBe('azmg-gpao');
    expect(r.result.instructions).toContain('heures ouvrees du client');
    expect(r.result.instructions).toContain('T00');
  });

  it('liste les onze outils de la section 8.13', async () => {
    const r = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as { result: { tools: { name: string }[] } };
    const noms = r.result.tools.map((o) => o.name).sort();
    expect(noms).toEqual(
      [
        'a_classer',
        'ajouter_evenement',
        'changer_statut',
        'chercher_dossier',
        'corriger_typage',
        'creer_demande',
        'echeances_a_venir',
        'exporter_reporting',
        'fiche_dossier',
        'file_du_jour',
        'indicateurs',
      ].sort(),
    );
    expect(r.result.tools).toHaveLength(11);
  });

  it('decrit chaque outil avec un schema d’entree', () => {
    for (const o of OUTILS) {
      expect(o.title, o.name).toBeTruthy();
      expect(o.description.length, o.name).toBeGreaterThan(20);
      expect(o.inputSchema.type, o.name).toBe('object');
    }
  });

  it('ignore une notification sans identifiant', async () => {
    expect(await traiterMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  it('refuse un message mal forme et une methode inconnue', async () => {
    const malForme = (await traiterMessage({ id: 1, method: 'ping' })) as { error: { code: number } };
    expect(malForme.error.code).toBe(-32600);
    const inconnue = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'inexistante' })) as { error: { code: number } };
    expect(inconnue.error.code).toBe(-32601);
  });

  it('rend une erreur metier comme resultat en erreur, pas comme une panne', async () => {
    const r = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fiche_dossier', arguments: { dossier_id: 999999 } } })) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toMatch(/introuvable/i);
  });
});

describe('outils de lecture', () => {
  beforeEach(async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T01', interlocuteur: 'client', source: 'mail', objet: 'Cotation fret aerien', resume: 'Trois transitaires consultes.', survenuLe: t('2026-03-02T09:00') },
      AUTEUR,
    );
    await changerStatut(r.demande!.id, 'attente_do', AUTEUR, { survenuLe: t('2026-03-02T11:00') });
    await db.insert(schema.echeances).values({ dossierId, type: 'cut_off', libelle: 'Cut-off aerien', echeanceLe: new Date(Date.now() + 2 * 86_400_000) });
  });

  it('file_du_jour renvoie les demandes ouvertes avec leurs durees', async () => {
    const lignes = await appeler('file_du_jour');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].objet).toBe('Cotation fret aerien');
    expect(lignes[0].statut).toBe('En attente DO');
    expect(lignes[0].statut_reporting).toBe('En cours');
    expect(lignes[0].lien).toContain('/demandes/');
  });

  it('chercher_dossier retrouve un dossier par son client', async () => {
    const lignes = await appeler('chercher_dossier', { recherche: 'Alpha' });
    expect(lignes[0].dossier_id).toBe(dossierId);
    expect(lignes[0].client).toBe('Alpha Pharma');
  });

  it('fiche_dossier rend les references, les demandes et la chronologie', async () => {
    const fiche = await appeler('fiche_dossier', { dossier_id: dossierId });
    expect(fiche.references).toEqual({ BL: 'FICTIF-BL-001' });
    expect(fiche.demandes).toHaveLength(1);
    expect(fiche.demandes[0].statut_reporting).toBe('En cours');
    expect(fiche.chronologie.length).toBeGreaterThan(0);
  });

  it('echeances_a_venir liste les echeances proches', async () => {
    const lignes = await appeler('echeances_a_venir', { jours: 7 });
    expect(lignes).toHaveLength(1);
    expect(lignes[0].libelle).toBe('Cut-off aerien');
    expect(lignes[0].jours_restants).toBeLessThanOrEqual(2);
  });

  it('indicateurs rend le flux, le stock et les delais', async () => {
    const ind = await appeler('indicateurs', { jours: 30 });
    expect(ind.stock.total).toBe(1);
    expect(ind.flux).toHaveProperty('entrees');
    expect(ind.delais).toHaveProperty('respect_delai_cible');
    expect(ind).toHaveProperty('charge_estimee_jours');
  });

  it('exporter_reporting rend un brouillon et rappelle qu’il n’envoie rien', async () => {
    const r = await appeler('exporter_reporting', { jour: '2026-03-02' });
    expect(r.jour).toBe('02/03/2026');
    expect(r.lignes[0].description).toMatch(/ : En cours$/);
    expect(r.rappel).toMatch(/brouillon a relire/i);
  });

  it('a_classer renvoie les evenements mal typés', async () => {
    await db.insert(schema.evenements).values({
      dossierId,
      compteId,
      sens: 'entrant',
      nature: 'demande_entrante',
      source: 'mail',
      survenuLe: new Date(),
      objet: 'Message a classer',
      famille: null,
    });
    const lignes = await appeler('a_classer');
    expect(lignes.some((l: { objet: string }) => l.objet === 'Message a classer')).toBe(true);
  });
});

describe('outils d’ecriture', () => {
  it('creer_demande ouvre une demande et cree le dossier au besoin', async () => {
    const r = await appeler('creer_demande', {
      client: 'Beta Distrib',
      pays: 'Libye',
      produit: 'Sirop 2 palettes',
      famille: 'T02',
      objet: 'Preparer le jeu de documents',
    });
    expect(r.demande_id).toBeGreaterThan(0);
    expect(r.statut).toBe('Nouveau');
    const dossiers = await db.select().from(schema.dossiers);
    expect(dossiers).toHaveLength(2);
  });

  it('ajouter_evenement fait avancer la demande selon la nature', async () => {
    const creation = await appeler('creer_demande', { dossier_id: dossierId, famille: 'T03', objet: 'Proforma' });
    const r = await appeler('ajouter_evenement', {
      demande_id: creation.demande_id,
      sens: 'sortant',
      nature: 'demande_validation_do',
      interlocuteur: 'do',
      source: 'mail',
      resume: 'Transmise a la DO.',
    });
    expect(r.statut).toBe('En attente DO');
  });

  it('changer_statut horodate la transition et rend le delai', async () => {
    const creation = await appeler('creer_demande', { dossier_id: dossierId, famille: 'T01', objet: 'Cotation' });
    const r = await appeler('changer_statut', { demande_id: creation.demande_id, statut: 'en_cours', motif: 'reprise du dossier' });
    expect(r.statut).toBe('En cours');
    expect(r).toHaveProperty('delai_total');
    const transitions = await db.select().from(schema.transitionsStatut).where(eq(schema.transitionsStatut.demandeId, creation.demande_id));
    expect(transitions.at(-1)!.motif).toBe('reprise du dossier');
  });

  it('corriger_typage corrige un evenement mal classe', async () => {
    const [evenement] = await db
      .insert(schema.evenements)
      .values({ dossierId, compteId, sens: 'entrant', nature: 'demande_entrante', source: 'mail', survenuLe: new Date(), objet: 'A classer', famille: null })
      .returning();
    const r = await appeler('corriger_typage', { evenement_id: evenement.id, famille: 'T04', interlocuteur: 'client' });
    expect(r.famille).toBe('T04');
    expect(r.interlocuteur).toBe('client');
  });

  it('trace chaque ecriture avec l’auteur « claude »', async () => {
    await appeler('creer_demande', { dossier_id: dossierId, famille: 'T01', objet: 'Cotation' });
    const lignes = await db.select().from(schema.journalActions);
    const creations = lignes.filter((l) => l.action === 'demande_creee');
    expect(creations).toHaveLength(1);
    expect(creations[0].auteurType).toBe('claude');
    // L'action est rattachee au compte au nom duquel le connecteur agit.
    expect(creations[0].utilisateurId).not.toBeNull();
  });

  it('marque « claude » les transitions de statut faites par le connecteur', async () => {
    const creation = await appeler('creer_demande', { dossier_id: dossierId, famille: 'T01', objet: 'Cotation' });
    await appeler('changer_statut', { demande_id: creation.demande_id, statut: 'en_cours' });
    const transitions = await db.select().from(schema.transitionsStatut).where(eq(schema.transitionsStatut.demandeId, creation.demande_id));
    expect(transitions.at(-1)!.auteurType).toBe('claude');
  });
});

describe('garde-fous', () => {
  it('refuse de creer une demande hors perimetre', async () => {
    await expect(appeler('creer_demande', { dossier_id: dossierId, famille: 'T00', objet: 'Newsletter' })).rejects.toThrow(/hors perimetre/i);
  });

  it('refuse de classer un evenement en T00', async () => {
    const [evenement] = await db
      .insert(schema.evenements)
      .values({ dossierId, compteId, sens: 'entrant', nature: 'demande_entrante', source: 'mail', survenuLe: new Date(), objet: 'A classer', famille: null })
      .returning();
    await expect(appeler('corriger_typage', { evenement_id: evenement.id, famille: 'T00' })).rejects.toThrow(/hors perimetre/i);
  });

  it('refuse une valeur hors du referentiel', async () => {
    const creation = await appeler('creer_demande', { dossier_id: dossierId, famille: 'T01', objet: 'Cotation' });
    await expect(appeler('changer_statut', { demande_id: creation.demande_id, statut: 'inexistant' })).rejects.toThrow(/inconnu/i);
  });

  it('refuse une demande inexistante', async () => {
    await expect(appeler('changer_statut', { demande_id: 999999, statut: 'en_cours' })).rejects.toThrow(/introuvable/i);
  });

  it('n’expose aucun outil qui envoie un message', async () => {
    const r = (await traiterMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as { result: { tools: { name: string; description: string }[] } };
    for (const outil of r.result.tools) {
      expect(outil.name, `outil ${outil.name}`).not.toMatch(/envoyer|email|mail_|relancer_client/i);
    }
    const exportateur = r.result.tools.find((o) => o.name === 'exporter_reporting')!;
    expect(exportateur.description).toMatch(/n.envoie rien/i);
  });

  it('demande le compte quand plusieurs comptes existent', async () => {
    await creerCompteDeTest('Deuxieme compte', 'deuxieme');
    await expect(appeler('file_du_jour')).rejects.toThrow(/compte_id obligatoire/i);
  });
});
