/**
 * Check-lists avant envoi, controle qualite avec echantillonnage, et digest de validation DO.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db, schema } from './aide';
import { changerStatut, creerDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { ajouterEvenement } from '../src/server/modules/evenements/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import {
  bornesSemaine,
  calculerNote,
  checklistsPourFamille,
  cleSemaine,
  controlesDeLaSemaine,
  enregistrerControleEnvoi,
  indicateursQualite,
  noterControle,
  tirerEchantillon,
} from '../src/server/modules/qualite/service';
import { construireDigest } from '../src/server/modules/digest/service';
import { modifierParametres } from '../src/server/lib/parametres';
import { initialiserChecklistsEtGrilles } from '../src/server/db/referentiel';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';
import { TIRETS_LONGS } from '../src/shared/tirets';

const AUTEUR = AUTEUR_SYSTEME;

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let compteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
  await modifierParametres((p) => {
    p.horaires.feriesClient = [];
    p.horaires.feriesLocaux = [];
  });
});

beforeEach(async () => {
  // Les check-lists et les grilles referencent le compte client : la cascade du TRUNCATE les
  // emporte, il faut donc les recreer pour chaque test.
  await db.execute(
    sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, echeances, controles_envoi, controles_qualite, checklists, grilles_qualite RESTART IDENTITY CASCADE`,
  );
  await initialiserChecklistsEtGrilles();
  const compte = await creerCompteDeTest();
  compteId = compte.id;
  await db
    .update(schema.comptesClients)
    .set({ donneurOrdreNom: 'Responsable export (fictive)' })
    .where(eq(schema.comptesClients.id, compteId));
  const poste = await creerPosteDeTest(compteId);
  dossierId = (
    await trouverOuCreerDossier(
      { compteId, posteId: poste.id, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg', references: { BL: 'FICTIF-BL-001' } },
      AUTEUR,
    )
  ).dossier.id;
});

describe('check-lists avant envoi', () => {
  it('propose les check-lists de la famille et les check-lists generiques', async () => {
    const pourT02 = await checklistsPourFamille('T02', compteId);
    expect(pourT02.map((c) => c.code)).toContain('documents_expedition');
    const pourT01 = await checklistsPourFamille('T01', compteId);
    expect(pourT01.map((c) => c.code)).toContain('cotation_fret');
    expect(pourT01.map((c) => c.code)).not.toContain('documents_expedition');
  });

  it('declare conforme un envoi dont tous les points obligatoires sont coches', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Jeu de documents' }, AUTEUR);
    const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.code, 'documents_expedition'));
    const points = checklist.points as { cle: string; obligatoire: boolean }[];
    const reponses = Object.fromEntries(points.map((p) => [p.cle, true]));
    const controle = await enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses }, AUTEUR);
    expect(controle.conforme).toBe(true);
  });

  it('declare non conforme un envoi auquel il manque un point obligatoire', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Jeu de documents' }, AUTEUR);
    const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.code, 'documents_expedition'));
    const points = checklist.points as { cle: string; obligatoire: boolean }[];
    const reponses = Object.fromEntries(points.map((p) => [p.cle, true]));
    reponses[points[0].cle] = false;
    const controle = await enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses }, AUTEUR);
    expect(controle.conforme).toBe(false);
  });

  it('ignore un point facultatif non coche', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation' }, AUTEUR);
    const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.code, 'cotation_fret'));
    const points = checklist.points as { cle: string; obligatoire: boolean }[];
    const facultatif = points.find((p) => !p.obligatoire)!;
    const reponses = Object.fromEntries(points.filter((p) => p.obligatoire).map((p) => [p.cle, true]));
    reponses[facultatif.cle] = false;
    const controle = await enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses }, AUTEUR);
    expect(controle.conforme).toBe(true);
  });

  it('refuse un point qui n’appartient pas a la check-list', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Documents' }, AUTEUR);
    const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.code, 'documents_expedition'));
    await expect(
      enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses: { point_invente: true } }, AUTEUR),
    ).rejects.toThrow(/inconnus/i);
  });
});

describe('semaines ISO', () => {
  it('donne la cle de semaine et ses bornes', () => {
    expect(cleSemaine(t('2026-03-04T12:00'))).toBe('2026-W10');
    const { debut, fin } = bornesSemaine('2026-W10');
    expect(DateTime.fromJSDate(debut).toISODate()).toBe('2026-03-02');
    expect(DateTime.fromJSDate(fin).toISODate()).toBe('2026-03-09');
  });
});

describe('echantillon hebdomadaire', () => {
  /** Cree `n` demandes avec un evenement sortant dans la semaine du 2 mars 2026. */
  async function creerEnvois(n: number) {
    for (let i = 0; i < n; i++) {
      const r = await ajouterEvenement(
        { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', source: 'mail', objet: `Envoi ${i}`, survenuLe: t('2026-03-02T09:00') },
        AUTEUR,
      );
      await ajouterEvenement(
        {
          demandeId: r.demande!.id,
          sens: 'sortant',
          nature: 'envoi_livrable',
          famille: 'T02',
          interlocuteur: 'client',
          source: 'mail',
          survenuLe: t('2026-03-03T10:00'),
        },
        AUTEUR,
      );
    }
  }

  it('tire la part demandee des envois de la semaine', async () => {
    await creerEnvois(20);
    const bilan = await tirerEchantillon('2026-W10', { compteId, taux: 0.1 }, AUTEUR);
    expect(bilan.envois).toBe(20);
    expect(bilan.tires).toBe(2);
    const controles = await controlesDeLaSemaine('2026-W10', compteId);
    expect(controles).toHaveLength(2);
  });

  it('tire au moins un envoi quand il y en a, meme si le taux arrondit a zero', async () => {
    await creerEnvois(3);
    const bilan = await tirerEchantillon('2026-W10', { compteId, taux: 0.01 }, AUTEUR);
    expect(bilan.tires).toBe(1);
  });

  it('est idempotent : relancer le tirage ne redouble pas l’echantillon', async () => {
    await creerEnvois(20);
    await tirerEchantillon('2026-W10', { compteId, taux: 0.1 }, AUTEUR);
    const second = await tirerEchantillon('2026-W10', { compteId, taux: 0.1 }, AUTEUR);
    expect(second.deja).toBe(2);
    expect(second.tires).toBe(0);
    expect(await controlesDeLaSemaine('2026-W10', compteId)).toHaveLength(2);
  });

  it('ne tire rien quand aucun envoi n’a eu lieu dans la semaine', async () => {
    await creerEnvois(5);
    const bilan = await tirerEchantillon('2026-W20', { compteId, taux: 0.5 }, AUTEUR);
    expect(bilan.envois).toBe(0);
    expect(bilan.tires).toBe(0);
  });

  it('attache la grille de controle par defaut', async () => {
    await creerEnvois(10);
    await tirerEchantillon('2026-W10', { compteId, taux: 0.2 }, AUTEUR);
    const controles = await controlesDeLaSemaine('2026-W10', compteId);
    expect(controles.every((c) => c.controle.grilleId !== null)).toBe(true);
    expect(controles[0].grille).toBe('Qualite d’un envoi du poste');
  });
});

describe('notation', () => {
  const criteres = [
    { cle: 'a', libelle: 'Critere A', poids: 70 },
    { cle: 'b', libelle: 'Critere B', poids: 30 },
  ];

  it('calcule une moyenne ponderee', () => {
    expect(calculerNote(criteres, { a: 100, b: 0 })).toBe(70);
    expect(calculerNote(criteres, { a: 80, b: 60 })).toBe(74);
  });

  it('ignore un critere non note plutot que de le compter a zero', () => {
    expect(calculerNote(criteres, { a: 80 })).toBe(80);
  });

  it('renvoie null quand rien n’est note', () => {
    expect(calculerNote(criteres, {})).toBeNull();
  });

  it('enregistre la note, la reprise et le bon du premier coup', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', source: 'mail', objet: 'Envoi', survenuLe: t('2026-03-02T09:00') },
      AUTEUR,
    );
    await ajouterEvenement(
      { demandeId: r.demande!.id, sens: 'sortant', nature: 'envoi_livrable', famille: 'T02', interlocuteur: 'client', source: 'mail', survenuLe: t('2026-03-03T10:00') },
      AUTEUR,
    );
    await tirerEchantillon('2026-W10', { compteId, taux: 1 }, AUTEUR);
    const [controle] = await controlesDeLaSemaine('2026-W10', compteId);

    const note = await noterControle(
      controle.controle.id,
      { notes: { exactitude: 90, completude: 80, delai: 100, redaction: 70, tracabilite: 100 }, reprise: false, bonDuPremierCoup: true },
      AUTEUR,
    );
    expect(Number(note.note)).toBeCloseTo(0.3 * 90 + 0.25 * 80 + 0.2 * 100 + 0.15 * 70 + 0.1 * 100, 1);
    expect(note.bonDuPremierCoup).toBe(true);
  });

  it('refuse une note hors de la plage 0 a 100', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', source: 'mail', objet: 'Envoi', survenuLe: t('2026-03-02T09:00') },
      AUTEUR,
    );
    await ajouterEvenement(
      { demandeId: r.demande!.id, sens: 'sortant', nature: 'envoi_livrable', famille: 'T02', interlocuteur: 'client', source: 'mail', survenuLe: t('2026-03-03T10:00') },
      AUTEUR,
    );
    await tirerEchantillon('2026-W10', { compteId, taux: 1 }, AUTEUR);
    const [controle] = await controlesDeLaSemaine('2026-W10', compteId);
    await expect(noterControle(controle.controle.id, { notes: { exactitude: 120 } }, AUTEUR)).rejects.toThrow(/entre 0 et 100/i);
  });
});

describe('indicateurs qualite', () => {
  it('assemble conformite, note moyenne, taux de reprise et bon du premier coup', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Documents' }, AUTEUR);
    const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.code, 'documents_expedition'));
    const points = checklist.points as { cle: string; obligatoire: boolean }[];
    // Un envoi conforme, un envoi non conforme auquel il manque le meme point.
    await enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses: Object.fromEntries(points.map((p) => [p.cle, true])) }, AUTEUR);
    const incomplet = Object.fromEntries(points.map((p) => [p.cle, true]));
    incomplet[points[1].cle] = false;
    await enregistrerControleEnvoi({ demandeId: demande.id, checklistId: checklist.id, reponses: incomplet }, AUTEUR);

    const periode = { debut: new Date(Date.now() - 86_400_000), fin: new Date(Date.now() + 86_400_000) };
    const ind = await indicateursQualite(periode, { compteId });
    expect(ind.envoisControles).toBe(2);
    expect(ind.tauxConformite).toBe(0.5);
    expect(ind.pointsManques[0].cle).toBe(points[1].cle);
    expect(ind.pointsManques[0].manques).toBe(1);
  });
});

describe('digest de validation DO', () => {
  async function demandeEnAttenteDo(objet: string, famille: string, depuis: string) {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille, source: 'mail', objet, survenuLe: t('2026-03-02T09:00') },
      AUTEUR,
    );
    await ajouterEvenement(
      {
        demandeId: r.demande!.id,
        sens: 'sortant',
        nature: 'demande_validation_do',
        famille,
        interlocuteur: 'do',
        source: 'mail',
        resume: 'Comparatif de deux offres transmis.',
        survenuLe: t(depuis),
      },
      AUTEUR,
    );
    return r.demande!.id;
  }

  it('liste une ligne par decision attendue, la plus ancienne en premier', async () => {
    await demandeEnAttenteDo('Cotation fret aerien', 'T01', '2026-03-02T10:00');
    await demandeEnAttenteDo('Proforma a modifier', 'T03', '2026-03-04T10:00');
    const digest = await construireDigest(compteId, t('2026-03-05T10:00'));

    expect(digest.lignes).toHaveLength(2);
    expect(digest.lignes[0].objet).toBe('Cotation fret aerien');
    expect(digest.lignes[0].decisionAttendue).toContain('Valider le transitaire et le prix');
    expect(digest.lignes[1].decisionAttendue).toContain('Valider la modification');
  });

  it('indique le temps d’attente de chaque decision en heures ouvrees', async () => {
    await demandeEnAttenteDo('Cotation fret aerien', 'T01', '2026-03-02T10:00');
    const digest = await construireDigest(compteId, t('2026-03-04T10:00'));
    // Lundi 10 h au mercredi 10 h : lundi 480, mardi 540, mercredi 60 = 1080 minutes.
    expect(digest.lignes[0].minutesAttente).toBe(1080);
    expect(digest.lignes[0].attenteLisible).toBe('2 j');
    expect(digest.lignes[0].urgent).toBe(true);
  });

  it('joint les elements de decision repris du dossier, sans rien inventer', async () => {
    await db.insert(schema.echeances).values({ dossierId, type: 'cut_off', libelle: 'Cut-off aerien', echeanceLe: t('2026-03-10T12:00') });
    await demandeEnAttenteDo('Cotation fret aerien', 'T01', '2026-03-02T10:00');
    const digest = await construireDigest(compteId, t('2026-03-04T10:00'));
    const elements = digest.lignes[0].elements;
    expect(elements.some((e) => e.libelle === 'BL' && e.valeur === 'FICTIF-BL-001')).toBe(true);
    expect(elements.some((e) => e.libelle === 'Cut-off aerien' && e.valeur === '10/03/2026')).toBe(true);
    expect(digest.lignes[0].derniereDemande).toBe('Comparatif de deux offres transmis.');
  });

  it('produit un brouillon sans tiret long, qui n’envoie rien', async () => {
    await demandeEnAttenteDo('Cotation fret aerien', 'T01', '2026-03-02T10:00');
    const digest = await construireDigest(compteId, t('2026-03-04T10:00'));
    expect(digest.brouillon).toMatch(/Bonjour Responsable export/);
    expect(digest.brouillon).toContain('1. Valider le transitaire et le prix');
    expect(digest.brouillon).toContain('En attente depuis : 2 j');
    expect(digest.brouillon).not.toMatch(TIRETS_LONGS);
  });

  it('le dit simplement quand aucune decision n’attend', async () => {
    const digest = await construireDigest(compteId, t('2026-03-04T10:00'));
    expect(digest.lignes).toHaveLength(0);
    expect(digest.brouillon).toContain("aucune decision n'est en attente");
  });

  it('ignore une demande qui n’attend plus la DO', async () => {
    const id = await demandeEnAttenteDo('Cotation fret aerien', 'T01', '2026-03-02T10:00');
    await changerStatut(id, 'en_cours', AUTEUR, { survenuLe: t('2026-03-03T10:00') });
    const digest = await construireDigest(compteId, t('2026-03-04T10:00'));
    expect(digest.lignes).toHaveLength(0);
  });
});
