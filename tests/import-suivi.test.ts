/**
 * Import du classeur « Suivi des demandes » tenu par le manager.
 *
 * Deux exigences portent tout le reste : l'import doit etre **rejouable**, parce que le classeur
 * est tenu a jour chaque jour, et la **famille metier** doit etre deduite du contenu, le classeur
 * ne la portant pas.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db, schema } from './aide';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { creerPoste } from '../src/server/modules/comptes/service';
import { initialiserRegles } from '../src/server/modules/typage/service';
import {
  cleLigne,
  importerSuiviDemandes,
  instantLigne,
  lireDateCellule,
  lireHeureCellule,
  lireOngletSuivi,
  nomPosteDeLigne,
  type LigneSuiviDemande,
} from '../src/server/modules/import/suivi-demandes';
import { lireClasseur } from '../src/server/lib/xlsx/lecture';

const CLASSEUR = path.resolve(__dirname, 'fixtures', 'SUIVI_DEMANDES_FICTIF.xlsx');
const AUTEUR = AUTEUR_SYSTEME;

let compteId: number;
let posteAssistanteId: number;
let posteDesignerId: number;

function buffer(): Buffer {
  return fs.readFileSync(CLASSEUR);
}

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, utilisateurs, dossiers, demandes, evenements, transitions_statut, journal_actions, regles_typage RESTART IDENTITY CASCADE`,
  );
  await initialiserRegles();
  compteId = (await creerCompteDeTest()).id;
  const elysa = await creerUtilisateurDeTest('assistante@azmg-solutions.com', 'collaborateur', 'Elysa');
  const miangaly = await creerUtilisateurDeTest('designer@azmg-solutions.com', 'collaborateur', 'Miangaly');
  posteAssistanteId = (await creerPosteDeTest(compteId, elysa.id)).id;
  posteDesignerId = (
    await creerPoste({ compteId, intitule: 'Designer', metier: 'designer', collaborateurId: miangaly.id }, AUTEUR)
  ).id;
});

describe('lecture du format', () => {
  it('trouve l’en-tete et lit les deux onglets', () => {
    const classeur = lireClasseur(buffer());
    expect(classeur.onglets.map((o) => o.nom)).toEqual(['Elysa', 'Miangaly']);
    const assistante = lireOngletSuivi(classeur.onglets[0]);
    expect(assistante.lignes).toHaveLength(4);
    expect(assistante.anomalies).toHaveLength(0);
    // Le titre et la ligne de compteurs, au-dessus de l'en-tete, ne sont pas des donnees.
    expect(assistante.lignes[0].ligne).toBe(5);
  });

  it('traduit les priorites et les statuts du classeur', () => {
    const { lignes } = lireOngletSuivi(lireClasseur(buffer()).onglets[0]);
    expect(lignes.map((l) => l.priorite)).toEqual(['haute', 'normale', 'basse', 'normale']);
    expect(lignes.map((l) => l.statut)).toEqual(['nouveau', 'en_cours', 'termine', 'en_cours']);
    // « A verifier » devient « en cours », et le libelle d'origine est conserve.
    expect(lignes[1].statutClasseur).toBe('A verifier');
  });

  it('lit dates et heures, et comble une heure absente', () => {
    expect(lireDateCellule('02/03/2026')).toBe('2026-03-02');
    expect(lireDateCellule('2026-03-02')).toBe('2026-03-02');
    expect(lireDateCellule('pas une date')).toBeNull();
    expect(lireHeureCellule('09:25:00')).toBe('09:25');
    expect(lireHeureCellule('9:25')).toBe('09:25');
    expect(lireHeureCellule('25:30')).toBeNull();
    // Un tableur range une heure en fraction de journee : 9 h 25 s'ecrit 0,39236.
    expect(lireHeureCellule('0.3923611111111111')).toBe('09:25');
    expect(lireHeureCellule('0.5')).toBe('12:00');
    expect(lireHeureCellule('1.5')).toBeNull();

    const { lignes } = lireOngletSuivi(lireClasseur(buffer()).onglets[0]);
    // Heure donnee : 09:25 a Antananarivo, soit 06:25 UTC.
    expect(instantLigne(lignes[0]).toISOString()).toBe('2026-03-02T06:25:00.000Z');
    // Heure absente : 09:00 par defaut, pour que la demande se range dans sa journee.
    expect(lignes[2].heure).toBeNull();
    expect(instantLigne(lignes[2]).toISOString()).toBe('2026-03-03T06:00:00.000Z');
  });

  it('designe le poste par l’onglet puis par le responsable', () => {
    const ligne = { onglet: 'Elysa', responsable: 'Miangaly (appui Aina)' } as LigneSuiviDemande;
    expect(nomPosteDeLigne(ligne)).toEqual(['Elysa', 'Miangaly']);
  });

  it('prefere la reference du mail comme cle, pour rejoindre la collecte', () => {
    const avecRef = { refMail: 'abc123', onglet: 'Elysa', jour: '2026-03-02', sujet: 'Sujet' } as LigneSuiviDemande;
    expect(cleLigne(avecRef, 1)).toBe('<abc123@mail.gmail.com>');
    const sansRef = { refMail: '', onglet: 'Elysa', jour: '2026-03-02', sujet: 'Cotation fret' } as LigneSuiviDemande;
    expect(cleLigne(sansRef, 1)).toBe('<suivi-1-elysa-2026-03-02-cotation-fret@azmg-gpao>');
  });
});

describe('import du classeur', () => {
  it('cree les demandes des deux onglets et les range sur le bon poste', async () => {
    const bilan = await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    expect(bilan.lignesLues).toBe(6);
    expect(bilan.demandesCreees).toBe(6);
    expect(bilan.anomalies).toHaveLength(0);

    const demandes = await db.select().from(schema.demandes);
    expect(demandes.filter((d) => d.posteId === posteAssistanteId)).toHaveLength(4);
    expect(demandes.filter((d) => d.posteId === posteDesignerId)).toHaveLength(2);
  });

  it('reprend l’action attendue comme objet de la demande', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const objets = (await db.select({ objet: schema.demandes.objet }).from(schema.demandes)).map((d) => d.objet);
    // C'est l'action qui debloque, pas le sujet, qui sert de dossier.
    expect(objets).toContain('Relancer le transitaire et transmettre la cotation');
  });

  it('deduit la famille metier, que le classeur ne porte pas', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [cotation] = await db
      .select()
      .from(schema.demandes)
      .where(eq(schema.demandes.objet, 'Relancer le transitaire et transmettre la cotation'));
    expect(cotation.famille).toBe('T01');
  });

  it('horodate l’ouverture a la date du suivi, pas a celle de l’import', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [premiere] = await db
      .select()
      .from(schema.demandes)
      .where(eq(schema.demandes.objet, 'Relancer le transitaire et transmettre la cotation'));
    expect(premiere.ouverteLe.toISOString()).toBe('2026-03-02T06:25:00.000Z');
  });

  it('applique le statut du classeur, avec une transition horodatee', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [terminee] = await db
      .select()
      .from(schema.demandes)
      .where(eq(schema.demandes.objet, 'Classer le dossier sous le numero de BL'));
    expect(terminee.statut).toBe('termine');
    const transitions = await db.select().from(schema.transitionsStatut).where(eq(schema.transitionsStatut.demandeId, terminee.id));
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.at(-1)!.survenuLe.toISOString()).toBe('2026-03-03T06:00:00.000Z');
  });

  it('conserve la demande de la donneuse d’ordre dans les notes', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [demande] = await db
      .select()
      .from(schema.demandes)
      .where(eq(schema.demandes.objet, 'Refaire la proforma en dollars et la faire valider'));
    expect(demande.notes).toContain('La proforma comporte une erreur de devise');
    expect(demande.notes).toContain('Statut au suivi : A verifier');
    expect(demande.notes).toContain('Commentaire de suivi : vu avec le client');
  });
});

describe('import rejoue', () => {
  it('ne recree rien au second passage', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const second = await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    expect(second.demandesCreees).toBe(0);
    expect(second.demandesMisesAJour).toBe(0);
    expect(await db.select().from(schema.demandes)).toHaveLength(6);
  });

  it('reprend du classeur un statut qui a change', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [demande] = await db
      .select()
      .from(schema.demandes)
      .where(eq(schema.demandes.objet, 'Relancer le transitaire et transmettre la cotation'));
    // Le manager fait foi sur l'avancement : la GPAO suit ce qu'il a note.
    await db.update(schema.demandes).set({ statut: 'bloque' }).where(eq(schema.demandes.id, demande.id));

    const second = await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    expect(second.demandesMisesAJour).toBe(1);
    const [apres] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, demande.id));
    expect(apres.statut).toBe('nouveau');
  });

  it('rejoint la collecte des mails par la reference Gmail', async () => {
    await importerSuiviDemandes(buffer(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR);
    const [evenement] = await db
      .select()
      .from(schema.evenements)
      .where(eq(schema.evenements.messageId, '<fil1fictif@mail.gmail.com>'));
    expect(evenement).toBeDefined();
    expect(evenement.source).toBe('import');
  });

  it('refuse un classeur qui n’est pas au format', async () => {
    const autre = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx'));
    await expect(importerSuiviDemandes(autre, { compteId, nomFichier: 'autre.xlsx' }, AUTEUR)).rejects.toThrow(/Action attendue/);
  });
});
