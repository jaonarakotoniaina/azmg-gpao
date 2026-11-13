/**
 * Pilotage de l'accompagnement : est-ce que ca s'ameliore ?
 *
 * Un releve dit combien de reprises il y a eu. Ce qui permet de decider, c'est la pente entre
 * deux semaines, la part de reprises qui reviennent sur le meme dossier ou la meme cause, et le
 * temps de cloture compte en heures ouvrees.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db, schema } from './aide';
import { changerStatut, creerDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { ajouterEvenement } from '../src/server/modules/evenements/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { accompagnement, ecartsPriorite, prioriteConseillee } from '../src/server/modules/pilotage/accompagnement';
import { horairesDuCompte, modifierParametres } from '../src/server/lib/parametres';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';

const AUTEUR = AUTEUR_SYSTEME;

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let collaboratriceId: number;
let compteId: number;
let posteId: number;
let dossierA: number;
let dossierB: number;

/** Periode des deux semaines du jeu de test. */
const PERIODE = { debut: t('2026-11-02T00:00'), fin: t('2026-11-16T00:00') };

beforeAll(async () => {
  await baseVierge();
  await modifierParametres((p) => {
    p.horaires.feriesClient = [];
    p.horaires.feriesLocaux = [];
  });
  collaboratriceId = (await creerUtilisateurDeTest('collab-accompagnement@azmg-solutions.com', 'collaborateur', 'Collaboratrice de test')).id;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut RESTART IDENTITY CASCADE`);
  compteId = (await creerCompteDeTest()).id;
  posteId = (await creerPosteDeTest(compteId, collaboratriceId)).id;
  dossierA = (await trouverOuCreerDossier({ compteId, posteId, client: 'Dossier A', produit: null }, AUTEUR)).dossier.id;
  dossierB = (await trouverOuCreerDossier({ compteId, posteId, client: 'Dossier B', produit: null }, AUTEUR)).dossier.id;
});

async function reprise(opts: { dossierId: number; le: string; cause?: string; objet?: string }) {
  return creerDemande(
    {
      dossierId: opts.dossierId,
      famille: 'T04',
      objet: opts.objet ?? 'Corriger et rendre compte',
      ouverteLe: t(opts.le),
      reprise: true,
      cause: (opts.cause ?? null) as never,
    },
    AUTEUR,
  );
}

describe('semaines', () => {
  it('range les demandes dans leur semaine et compte les reprises', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00', cause: 'delai_reponse' });
    await reprise({ dossierId: dossierB, le: '2026-11-04T09:00', cause: 'erreur_document' });
    await reprise({ dossierId: dossierA, le: '2026-11-10T09:00', cause: 'delai_reponse' });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.semaines).toHaveLength(2);
    expect(bilan.semaines[0].reprises).toBe(2);
    expect(bilan.semaines[1].reprises).toBe(1);
  });

  it('compte une recidive quand le dossier ou la cause revient', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00', cause: 'delai_reponse' });
    // Semaine suivante, meme dossier et meme cause : c'est une recidive.
    await reprise({ dossierId: dossierA, le: '2026-11-10T09:00', cause: 'delai_reponse' });
    // Un dossier neuf avec une cause neuve n'en est pas une.
    await reprise({ dossierId: dossierB, le: '2026-11-11T09:00', cause: 'qualite_livrable' });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.semaines[0].recidives).toBe(0);
    expect(bilan.semaines[1].recidives).toBe(1);
    expect(bilan.semaines[1].tauxRecidive).toBe(0.5);
    expect(bilan.total.recidives).toBe(1);
  });

  it('ne compte pas de recidive sur la premiere apparition', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00', cause: 'delai_reponse' });
    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.semaines[0].recidives).toBe(0);
    expect(bilan.semaines[0].tauxRecidive).toBe(0);
  });

  it('laisse le taux de recidive vide quand il n’y a aucune reprise', async () => {
    await creerDemande({ dossierId: dossierA, famille: 'T01', objet: 'Travail ordinaire', ouverteLe: t('2026-11-03T09:00') }, AUTEUR);
    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.semaines[0].reprises).toBe(0);
    expect(bilan.semaines[0].tauxRecidive).toBeNull();
  });
});

describe('delai de cloture', () => {
  it('compte le delai median en heures ouvrees, week-end exclu', async () => {
    // Ouverte le vendredi 09:00, close le lundi 09:00 : un seul jour ouvre, soit 9 heures.
    const demande = await reprise({ dossierId: dossierA, le: '2026-11-06T09:00' });
    await changerStatut(demande.id, 'termine', AUTEUR, { survenuLe: t('2026-11-09T09:00') });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.total.delaiMedianHeures).toBeCloseTo(9, 1);
  });

  it('ignore les demandes encore ouvertes dans le delai median', async () => {
    const close = await reprise({ dossierId: dossierA, le: '2026-11-03T09:00' });
    await changerStatut(close.id, 'termine', AUTEUR, { survenuLe: t('2026-11-03T12:00') });
    await reprise({ dossierId: dossierB, le: '2026-11-03T09:00' });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.total.delaiMedianHeures).toBeCloseTo(3, 1);
  });
});

describe('causes et dossiers repetes', () => {
  it('classe les causes de la plus frequente a la moins frequente', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00', cause: 'classement_tracabilite' });
    await reprise({ dossierId: dossierB, le: '2026-11-04T09:00', cause: 'classement_tracabilite' });
    await reprise({ dossierId: dossierA, le: '2026-11-05T09:00', cause: 'delai_reponse' });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.causes[0].cause).toBe('classement_tracabilite');
    expect(bilan.causes[0].nombre).toBe(2);
    expect(bilan.causes[0].libelle).toBe('Classement et tracabilite');
  });

  it('nomme la cause non renseignee plutot que de la passer sous silence', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00' });
    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.causes[0].cause).toBeNull();
    expect(bilan.causes[0].libelle).toBe('Cause non renseignee');
  });

  it('remonte les dossiers sur lesquels la DO a du revenir', async () => {
    await reprise({ dossierId: dossierA, le: '2026-11-03T09:00' });
    await reprise({ dossierId: dossierA, le: '2026-11-05T09:00' });
    await reprise({ dossierId: dossierB, le: '2026-11-06T09:00' });

    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.dossiersRepetes).toHaveLength(1);
    expect(bilan.dossiersRepetes[0].dossierId).toBe(dossierA);
    expect(bilan.dossiersRepetes[0].reprises).toBe(2);
  });
});

describe('calibrage des priorites', () => {
  let horaires: Awaited<ReturnType<typeof horairesDuCompte>>;
  beforeEach(async () => {
    horaires = await horairesDuCompte(compteId);
  });

  const base = { famille: 'T08', echeanceLe: null, acteurAttendu: 'poste', statut: 'en_cours' } as never;

  it('met en haute une echeance sous 24 heures ouvrees', () => {
    const demande = { ...(base as object), echeanceLe: t('2026-11-04T15:00') } as never;
    const conseil = prioriteConseillee(demande, horaires, t('2026-11-04T09:00'));
    expect(conseil.priorite).toBe('haute');
    expect(conseil.raison).toBe('echeance sous 24 heures ouvrees');
  });

  it('met en haute une echeance deja depassee', () => {
    const demande = { ...(base as object), echeanceLe: t('2026-11-03T15:00') } as never;
    expect(prioriteConseillee(demande, horaires, t('2026-11-04T09:00')).priorite).toBe('haute');
  });

  it('met en haute une famille ou un tiers reste bloque', () => {
    const demande = { ...(base as object), famille: 'T02', acteurAttendu: 'client' } as never;
    expect(prioriteConseillee(demande, horaires, t('2026-11-04T09:00')).raison).toBe('un tiers reste bloque');
  });

  it('met en basse la forme et la procedure sans echeance', () => {
    const demande = { ...(base as object), famille: 'T09' } as never;
    expect(prioriteConseillee(demande, horaires, t('2026-11-04T09:00')).priorite).toBe('basse');
  });

  it('laisse en normale le travail de la semaine', () => {
    expect(prioriteConseillee(base, horaires, t('2026-11-04T09:00')).priorite).toBe('normale');
  });

  it('liste les ecarts, surclassements en tete, sans rien changer', async () => {
    // Un reporting quotidien marque prioritaire : c'est ce qui noie la file.
    const surclassee = await creerDemande(
      { dossierId: dossierA, famille: 'T09', objet: 'Envoyer le daily', ouverteLe: t('2026-11-03T09:00'), priorite: 'haute' },
      AUTEUR,
    );
    await creerDemande(
      { dossierId: dossierB, famille: 'T08', objet: 'Completer une fiche', ouverteLe: t('2026-11-03T09:00'), priorite: 'normale' },
      AUTEUR,
    );

    const ecarts = await ecartsPriorite(posteId, t('2026-11-04T09:00'));
    expect(ecarts[0].demandeId).toBe(surclassee.id);
    expect(ecarts[0].declaree).toBe('haute');
    expect(ecarts[0].conseillee).toBe('basse');
    // Rien n'a ete modifie : la regle conseille, elle n'applique pas.
    const [apres] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, surclassee.id));
    expect(apres.priorite).toBe('haute');
  });

  it('ne discute pas une priorite critique posee a la main', async () => {
    await creerDemande(
      { dossierId: dossierA, famille: 'T09', objet: 'Daily critique', ouverteLe: t('2026-11-03T09:00'), priorite: 'critique' },
      AUTEUR,
    );
    const ecarts = await ecartsPriorite(posteId, t('2026-11-04T09:00'));
    expect(ecarts.some((e) => e.declaree === 'critique')).toBe(false);
  });
});

describe('retours positifs', () => {
  it('compte les validations de la donneuse d’ordre', async () => {
    // Un releve qui ne porte que des reproches donne une image fausse.
    const demande = await creerDemande({ dossierId: dossierA, famille: 'T03', objet: 'Proforma a valider', ouverteLe: t('2026-11-03T09:00') }, AUTEUR);
    await ajouterEvenement(
      {
        demandeId: demande.id,
        sens: 'entrant',
        nature: 'validation_do',
        famille: 'T03',
        interlocuteur: 'do',
        source: 'mail',
        survenuLe: t('2026-11-03T15:00'),
        resume: 'Validation recue',
      },
      AUTEUR,
    );
    const bilan = await accompagnement(posteId, PERIODE);
    expect(bilan.retoursPositifs).toBe(1);
  });
});
