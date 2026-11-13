/**
 * Vue « Suivi des demandes » : le tableau du manager, rendu par la GPAO.
 *
 * L'import range chaque ligne en dossier, demande et evenement. Cette vue fait le chemin inverse
 * et redonne le tableau, avec en plus les colonnes que le classeur n'avait pas : echeance,
 * cloture et delai, comptes en heures ouvrees du client.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import { sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db } from './aide';
import { changerStatut, creerDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { creerPoste } from '../src/server/modules/comptes/service';
import { initialiserRegles } from '../src/server/modules/typage/service';
import { importerSuiviDemandes } from '../src/server/modules/import/suivi-demandes';
import { suiviDesDemandes } from '../src/server/modules/pilotage/suivi';
import { modifierParametres } from '../src/server/lib/parametres';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';

const AUTEUR = AUTEUR_SYSTEME;
const CLASSEUR = path.resolve(__dirname, 'fixtures', 'SUIVI_DEMANDES_FICTIF.xlsx');

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let compteId: number;
let posteId: number;
let posteDesignerId: number;
let elysaId: number;
let miangalyId: number;

beforeAll(async () => {
  await baseVierge();
  await modifierParametres((p) => {
    p.horaires.feriesClient = [];
    p.horaires.feriesLocaux = [];
  });
  elysaId = (await creerUtilisateurDeTest('assistante-suivi-vue@azmg-solutions.com', 'collaborateur', 'Elysa')).id;
  miangalyId = (await creerUtilisateurDeTest('designer-suivi-vue@azmg-solutions.com', 'collaborateur', 'Miangaly')).id;
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, regles_typage RESTART IDENTITY CASCADE`,
  );
  await initialiserRegles();
  compteId = (await creerCompteDeTest()).id;
  posteId = (await creerPosteDeTest(compteId, elysaId)).id;
  posteDesignerId = (await creerPoste({ compteId, intitule: 'Designer', metier: 'designer', collaborateurId: miangalyId }, AUTEUR)).id;
});

describe('le tableau rend les colonnes du classeur', () => {
  beforeEach(async () => {
    await importerSuiviDemandes(fs.readFileSync(CLASSEUR), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
  });

  it('redonne une ligne par demande, la plus recente en tete', async () => {
    const lignes = await suiviDesDemandes({ compteId });
    expect(lignes).toHaveLength(6);
    expect(new Date(lignes[0].ouverteLe).getTime()).toBeGreaterThanOrEqual(new Date(lignes[1].ouverteLe).getTime());
  });

  it('garde la demande telle qu’elle a ete ecrite, a cote de l’action attendue', async () => {
    const lignes = await suiviDesDemandes({ compteId });
    const ligne = lignes.find((l) => l.action === 'Relancer le transitaire et transmettre la cotation')!;
    expect(ligne.demande).toBe('Le client attend la cotation depuis deux jours');
    expect(ligne.sujet).toContain('Cotation fret aerien Alger');
  });

  it('reprend le commentaire et le lien du mail', async () => {
    const lignes = await suiviDesDemandes({ compteId });
    const ligne = lignes.find((l) => l.action === 'Refaire la proforma en dollars et la faire valider')!;
    expect(ligne.commentaire).toBe('vu avec le client');
    expect(ligne.lienMail).toBe('https://exemple-fictif.test/mail/2');
  });

  it('marque les reprises et nomme leur cause', async () => {
    const lignes = await suiviDesDemandes({ compteId });
    const reprise = lignes.find((l) => l.action === 'Reprendre les visuels selon la charte et les faire valider')!;
    expect(reprise.reprise).toBe(true);
    expect(reprise.causeLibelle).toBe('Qualite du livrable');
  });

  it('filtre par poste', async () => {
    expect(await suiviDesDemandes({ compteId, posteId })).toHaveLength(4);
    expect(await suiviDesDemandes({ compteId, posteId: posteDesignerId })).toHaveLength(2);
  });

  it('filtre les reprises seules', async () => {
    const reprises = await suiviDesDemandes({ compteId, reprisesSeules: true });
    expect(reprises.length).toBeGreaterThan(0);
    expect(reprises.every((l) => l.reprise)).toBe(true);
  });
});

describe('les colonnes qui manquaient au classeur', () => {
  it('compte le delai de cloture en heures ouvrees, week-end exclu', async () => {
    const dossier = (await trouverOuCreerDossier({ compteId, posteId, client: 'Dossier', produit: null }, AUTEUR)).dossier;
    // Ouverte le vendredi 09:00, close le lundi 09:00 : un seul jour ouvre, soit 9 heures.
    const demande = await creerDemande(
      { dossierId: dossier.id, famille: 'T01', objet: 'Livrer le document', ouverteLe: t('2026-11-06T09:00') },
      AUTEUR,
    );
    await changerStatut(demande.id, 'termine', AUTEUR, { survenuLe: t('2026-11-09T09:00') });

    const [ligne] = await suiviDesDemandes({ compteId });
    expect(ligne.delaiHeures).toBeCloseTo(9, 1);
    expect(ligne.clotureeLe).not.toBeNull();
    // Une demande close n'a pas d'attente en cours.
    expect(ligne.attenteHeures).toBeNull();
  });

  it('montre l’attente en cours tant que la demande est ouverte', async () => {
    const dossier = (await trouverOuCreerDossier({ compteId, posteId, client: 'Dossier', produit: null }, AUTEUR)).dossier;
    await creerDemande({ dossierId: dossier.id, famille: 'T01', objet: 'En cours', ouverteLe: t('2026-11-09T09:00') }, AUTEUR);

    const [ligne] = await suiviDesDemandes({ compteId }, t('2026-11-09T15:00'));
    expect(ligne.delaiHeures).toBeNull();
    expect(ligne.attenteHeures).toBeCloseTo(6, 1);
  });

  it('exclut le hors perimetre du tableau', async () => {
    const dossier = (await trouverOuCreerDossier({ compteId, posteId, client: 'Dossier', produit: null }, AUTEUR)).dossier;
    await db.insert((await import('../src/server/db/client')).schema.demandes).values({
      dossierId: dossier.id,
      compteId,
      posteId,
      famille: 'T00',
      objet: 'Infolettre',
      ouverteLe: t('2026-11-09T09:00'),
    });
    expect(await suiviDesDemandes({ compteId })).toHaveLength(0);
  });
});
