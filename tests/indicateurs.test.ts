/**
 * Indicateurs de pilotage.
 * Critere de la phase 2 : « indicateurs recalcules sur jeu fictif conformes aux attendus ».
 *
 * Le jeu de test est construit sur une semaine complete sans jour ferie, du lundi 2 au
 * vendredi 6 mars 2026, avec des horaires 09 h 00 a 18 h 00 : une journee ouvree vaut donc
 * 540 minutes, ce qui rend chaque attendu verifiable a la main.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db } from './aide';
import { changerStatut, creerDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { charge, delais, flux, periodesComparees, stock, tableauDeBord } from '../src/server/modules/indicateurs/service';
import { modifierParametres } from '../src/server/lib/parametres';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';
import { famille as familleRef } from '../src/shared/constantes';

const AUTEUR = AUTEUR_SYSTEME;
const JOUR = 540; // minutes ouvrees d'une journee de 9 heures

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

/** Fin de la semaine de test : vendredi 6 mars 2026 a 18 h, pour des periodes deterministes. */
const MAINTENANT = t('2026-03-06T18:00');

let compteId: number;
let posteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
  // Semaine sans ferie : les attendus ne dependent que des week-ends et des horaires.
  await modifierParametres((p) => {
    p.horaires.feriesClient = [];
    p.horaires.feriesLocaux = [];
    p.horaires.feriesCollaborateur = false;
  });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, echeances RESTART IDENTITY CASCADE`);
  compteId = (await creerCompteDeTest()).id;
  posteId = (await creerPosteDeTest(compteId)).id;
  dossierId = (await trouverOuCreerDossier({ compteId, posteId, client: 'Alpha Pharma', produit: 'Gelules' }, AUTEUR)).dossier.id;
});

/**
 * Jeu de reference, entierement fictif.
 *
 * D1 (T01, cible 8 h) : ouverte lundi 9 h, premiere reponse lundi 11 h, attente tiers jusqu'au
 *   mardi 11 h, puis terminee mardi 13 h. Cible depassee.
 * D2 (T13, cible 4 h) : ouverte lundi 9 h, terminee lundi 11 h. Cible respectee.
 * D3 (T03, cible 8 h) : ouverte mercredi 9 h, toujours en attente DO. Reste au stock.
 * D4 (T04, cible 16 h) : ouverte vendredi de la semaine precedente, toujours ouverte. Vieux stock.
 */
async function jeuDeReference() {
  const d1 = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation fret', ouverteLe: t('2026-03-02T09:00') }, AUTEUR);
  await changerStatut(d1.id, 'attente_tiers', AUTEUR, { survenuLe: t('2026-03-02T11:00'), acteurAttendu: 'tiers', premiereReponse: true });
  await changerStatut(d1.id, 'en_cours', AUTEUR, { survenuLe: t('2026-03-03T11:00') });
  await changerStatut(d1.id, 'termine', AUTEUR, { survenuLe: t('2026-03-03T13:00') });

  const d2 = await creerDemande({ dossierId, famille: 'T13', objet: 'Transfert a la DO', ouverteLe: t('2026-03-02T09:00') }, AUTEUR);
  await changerStatut(d2.id, 'termine', AUTEUR, { survenuLe: t('2026-03-02T11:00'), premiereReponse: true });

  const d3 = await creerDemande({ dossierId, famille: 'T03', objet: 'Proforma a valider', ouverteLe: t('2026-03-04T09:00') }, AUTEUR);
  await changerStatut(d3.id, 'attente_do', AUTEUR, { survenuLe: t('2026-03-04T11:00') });

  const d4 = await creerDemande({ dossierId, famille: 'T04', objet: 'Relance du solde', ouverteLe: t('2026-02-27T09:00') }, AUTEUR);
  return { d1, d2, d3, d4 };
}

const SEMAINE = { debut: t('2026-03-02T00:00'), fin: t('2026-03-07T00:00') };

describe('flux', () => {
  it('compte les entrees et les sorties de la periode', async () => {
    await jeuDeReference();
    const f = await flux(SEMAINE, { compteId });
    // D1, D2 et D3 sont ouvertes dans la semaine. D4 l'a ete le vendredi precedent.
    expect(f.entrees).toBe(3);
    // D1 et D2 sont terminees dans la semaine.
    expect(f.sorties).toBe(2);
    expect(f.solde).toBe(1);
  });

  it('detaille par jour et par famille', async () => {
    await jeuDeReference();
    const f = await flux(SEMAINE, { compteId });
    const lundi = f.parJour.find((j) => j.jour === '2026-03-02')!;
    expect(lundi.entrees).toBe(2); // D1 et D2
    expect(lundi.sorties).toBe(1); // D2
    const mardi = f.parJour.find((j) => j.jour === '2026-03-03')!;
    expect(mardi.sorties).toBe(1); // D1
    expect(f.parFamille.find((x) => x.famille === 'T01')!.entrees).toBe(1);
  });

  it('exclut le hors perimetre des entrees', async () => {
    await jeuDeReference();
    // Une demande T00 ne peut pas exister : la verification porte sur l'absence de fuite.
    const f = await flux(SEMAINE, { compteId });
    expect(f.parFamille.some((x) => x.famille === 'T00')).toBe(false);
  });
});

describe('stock', () => {
  it('compte les demandes ouvertes et les repartit', async () => {
    await jeuDeReference();
    const s = await stock({ compteId }, MAINTENANT);
    // D3 (attente DO) et D4 (nouveau) restent ouvertes.
    expect(s.total).toBe(2);
    expect(s.parStatut.attente_do).toBe(1);
    expect(s.parStatut.nouveau).toBe(1);
    expect(s.parActeur.do).toBe(1);
    expect(s.parActeur.poste).toBe(1);
  });

  it('calcule l’age du stock en minutes ouvrees', async () => {
    await jeuDeReference();
    const s = await stock({ compteId }, MAINTENANT);
    // D3 : mercredi 9 h au vendredi 18 h = 3 journees pleines = 1620.
    // D4 : vendredi 27 fevrier 9 h au vendredi 6 mars 18 h = le vendredi 27 (540) plus les cinq
    //      jours du lundi 2 au vendredi 6 (5 x 540). Le week-end ne compte pas : 6 x 540 = 3240.
    const ages = [1620, 3240];
    expect(s.ageMoyenMinutes).toBe(Math.round((ages[0] + ages[1]) / 2));
    expect(s.ageMedianMinutes).toBe(3240);
  });

  it('repartit le stock par tranche d’age', async () => {
    await jeuDeReference();
    const s = await stock({ compteId }, MAINTENANT);
    // 1620 minutes = 3 jours ouvres, 3780 = 7 jours ouvres.
    expect(s.tranchesAge.find((t) => t.tranche === '3 a 5 jours')!.nombre).toBe(1);
    expect(s.tranchesAge.find((t) => t.tranche === '6 a 10 jours')!.nombre).toBe(1);
  });

  it('compte les demandes dont la cible est depassee', async () => {
    await jeuDeReference();
    const s = await stock({ compteId }, MAINTENANT);
    // D3 (cible 8 h depuis mercredi) et D4 (cible 16 h depuis le vendredi precedent).
    expect(s.slaDepasse).toBe(2);
  });

  it('estime la charge du stock par le temps standard des familles', async () => {
    await jeuDeReference();
    const s = await stock({ compteId }, MAINTENANT);
    const attendu = (familleRef('T03')?.tempsStandardMinutes ?? 0) + (familleRef('T04')?.tempsStandardMinutes ?? 0);
    expect(s.chargeEstimeeMinutes).toBe(attendu);
  });
});

describe('delais', () => {
  it('calcule les delais des demandes terminees dans la periode', async () => {
    await jeuDeReference();
    const d = await delais(SEMAINE, { compteId });
    expect(d.terminees).toBe(2);
    // D1 : lundi 9 h au mardi 13 h = 540 plus 240 = 780. D2 : 120.
    expect(d.delaiTotalMedianMinutes).toBe(780);
    expect(d.delaiTotalMoyenMinutes).toBe(Math.round((780 + 120) / 2));
  });

  it('calcule le delai de premiere reponse', async () => {
    await jeuDeReference();
    const d = await delais(SEMAINE, { compteId });
    // D1 et D2 ont toutes deux repondu en 2 heures.
    expect(d.premiereReponseMoyenneMinutes).toBe(120);
    expect(d.premiereReponseMedianeMinutes).toBe(120);
  });

  it('repartit l’attente par acteur', async () => {
    await jeuDeReference();
    const d = await delais(SEMAINE, { compteId });
    // D1 : 120 en Nouveau (poste), 540 en attente tiers, 120 en cours (poste). D2 : 120 (poste).
    expect(d.attenteParActeurMinutes.tiers).toBe(540);
    expect(d.attenteParActeurMinutes.poste).toBe(120 + 120 + 120);
  });

  it('mesure le respect du delai cible', async () => {
    await jeuDeReference();
    const d = await delais(SEMAINE, { compteId });
    // D2 dans la cible, D1 hors cible : une sur deux.
    expect(d.respectSla).toBe(0.5);
    expect(d.parFamille.find((f) => f.famille === 'T13')!.respectSla).toBe(1);
    expect(d.parFamille.find((f) => f.famille === 'T01')!.respectSla).toBe(0);
  });

  it('renvoie null plutot que zero quand rien n’est termine', async () => {
    const d = await delais(SEMAINE, { compteId });
    expect(d.terminees).toBe(0);
    expect(d.delaiTotalMedianMinutes).toBeNull();
    expect(d.respectSla).toBeNull();
  });
});

describe('charge estimee', () => {
  it('multiplie le volume par le temps standard de chaque famille', async () => {
    await jeuDeReference();
    const c = await charge(SEMAINE, { compteId });
    const attendu =
      (familleRef('T01')?.tempsStandardMinutes ?? 0) + (familleRef('T13')?.tempsStandardMinutes ?? 0) + (familleRef('T03')?.tempsStandardMinutes ?? 0);
    expect(c.totalMinutes).toBe(attendu);
    expect(c.totalJours).toBe(Math.round((attendu / JOUR) * 10) / 10);
  });
});

describe('periodes comparees', () => {
  it('construit deux periodes de meme duree qui se suivent', () => {
    const { courante, precedente } = periodesComparees(7, t('2026-03-09T12:00'));
    expect(courante.fin.getTime() - courante.debut.getTime()).toBe(7 * 86_400_000);
    expect(precedente.fin.getTime()).toBe(courante.debut.getTime());
    expect(precedente.fin.getTime() - precedente.debut.getTime()).toBe(7 * 86_400_000);
  });
});

describe('tableau de bord', () => {
  it('assemble les quatre familles de mesures et la comparaison', async () => {
    await jeuDeReference();
    const tb = await tableauDeBord(7, { compteId }, MAINTENANT);
    expect(tb.periode.jours).toBe(7);
    expect(tb.flux.entrees).toBeGreaterThan(0);
    expect(tb.stock.total).toBe(2);
    expect(tb.delais.terminees).toBe(2);
    expect(tb.charge.totalMinutes).toBeGreaterThan(0);
    expect(tb.precedent.flux).toHaveProperty('entrees');
    expect(tb.precedent.delais).toHaveProperty('terminees');
  });

  it('signale les attentes DO plus longues que le seuil', async () => {
    await jeuDeReference();
    const tb = await tableauDeBord(7, { compteId }, MAINTENANT);
    // D3 attend la DO depuis mercredi 11 h, soit bien plus que les 8 heures du seuil.
    expect(tb.attentesDoLongues).toHaveLength(1);
    expect(tb.attentesDoLongues[0].objet).toBe('Proforma a valider');
    expect(tb.attentesDoLongues[0].minutesAttente).toBeGreaterThan(8 * 60);
  });

  it('remonte les echeances proches dans l’horizon d’alerte', async () => {
    await jeuDeReference();
    const { schema } = await import('../src/server/db/client');
    await db.insert(schema.echeances).values([
      { dossierId, type: 'cut_off', libelle: 'Cut-off aerien', echeanceLe: t('2026-03-07T12:00') },
      { dossierId, type: 'eta', libelle: 'Arrivee prevue', echeanceLe: t('2026-04-30T12:00') },
    ]);
    const tb = await tableauDeBord(7, { compteId }, MAINTENANT);
    // L'horizon par defaut est de 2 jours : seul le cut-off du lendemain remonte.
    expect(tb.echeancesProches).toHaveLength(1);
    expect(tb.echeancesProches[0].libelle).toBe('Cut-off aerien');
    expect(tb.echeancesProches[0].joursRestants).toBe(0);
  });

  it('se limite au compte demande', async () => {
    await jeuDeReference();
    const autre = await creerCompteDeTest('Autre compte', 'autre');
    const autreDossier = (await trouverOuCreerDossier({ compteId: autre.id, client: 'Beta', produit: 'Sirop' }, AUTEUR)).dossier;
    await creerDemande({ dossierId: autreDossier.id, famille: 'T01', objet: 'Hors compte', ouverteLe: t('2026-03-04T09:00') }, AUTEUR);

    const tb = await tableauDeBord(7, { compteId }, MAINTENANT);
    expect(tb.stock.total).toBe(2);
    const global = await tableauDeBord(7, {}, MAINTENANT);
    expect(global.stock.total).toBe(3);
  });
});
