/**
 * Export du reporting au format existant.
 *
 * Critere central de la phase 2 : « l'export ecrit dans une copie du classeur fictif sans
 * alterer sa structure (test de comparaison des styles et formules) ».
 *
 * La comparaison est faite a trois niveaux :
 *  1. les entrees de l'archive non concernees ressortent **octet pour octet** ;
 *  2. les lignes preexistantes de la feuille modifiee sont inchangees, formules comprises ;
 *  3. le classeur reste lisible, avec ses onglets, ses cellules fusionnees et ses largeurs.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import { sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db, schema } from './aide';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { ajouterEvenement } from '../src/server/modules/evenements/service';
import { changerStatut, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import {
  construireBlocJour,
  construireColonneSemaine,
  exporterReporting,
  LIGNES_SEMAINE,
  LIGNES_SEMAINE_INTOUCHABLES,
  nomOngletSemaine,
  numeroOngletSemaine,
  ONGLET_SUIVI,
  repererModele,
  retirerReferences,
} from '../src/server/modules/export/service';
import { ClasseurModifiable } from '../src/server/lib/xlsx/ecriture';
import { lireZip } from '../src/server/lib/xlsx/zip';
import { lireClasseur, ongletNomme, valeur as valeurCellule } from '../src/server/lib/xlsx/lecture';
import { TIRETS_LONGS } from '../src/shared/tirets';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';

const AUTEUR = AUTEUR_SYSTEME;
const CLASSEUR = path.resolve(__dirname, 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');
const original = () => fs.readFileSync(CLASSEUR);

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let compteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, echeances RESTART IDENTITY CASCADE`);
  compteId = (await creerCompteDeTest()).id;
  const poste = await creerPosteDeTest(compteId);
  dossierId = (
    await trouverOuCreerDossier({ compteId, posteId: poste.id, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg' }, AUTEUR)
  ).dossier.id;
});

/** Une demande avec un evenement, a une date donnee. */
async function demande(objet: string, famille: string, jour: string, resume: string) {
  return ajouterEvenement(
    { dossierId, sens: 'entrant', nature: 'demande_entrante', famille, source: 'mail', objet, resume, survenuLe: t(`${jour}T10:00`) },
    AUTEUR,
  );
}

describe('structure du classeur preservee', () => {
  it('ne reecrit que la feuille modifiee et la table des chaines', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const avant = lireZip(original());
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const apres = lireZip(fichier);

    expect([...apres.keys()]).toEqual([...avant.keys()]);
    const modifiees: string[] = [];
    for (const [nom, entree] of avant) {
      if (!entree.contenu.equals(apres.get(nom)!.contenu)) modifiees.push(nom);
    }
    // Seules la feuille du suivi et la table des chaines changent.
    expect(modifiees.sort()).toEqual(['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']);
  });

  it('laisse les styles intacts, octet pour octet', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const avant = lireZip(original());
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const apres = lireZip(fichier);
    expect(apres.get('xl/styles.xml')!.contenu.equals(avant.get('xl/styles.xml')!.contenu)).toBe(true);
    expect(apres.get('xl/workbook.xml')!.contenu.equals(avant.get('xl/workbook.xml')!.contenu)).toBe(true);
    expect(apres.get('[Content_Types].xml')!.contenu.equals(avant.get('[Content_Types].xml')!.contenu)).toBe(true);
  });

  it('conserve les formules des autres onglets', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const apres = lireZip(fichier);
    const sem = apres.get('xl/worksheets/sheet2.xml')!.contenu.toString('utf8');
    expect(sem).toContain('<f>SUM(B5:F5)</f>');
    const avant = lireZip(original()).get('xl/worksheets/sheet2.xml')!.contenu;
    expect(apres.get('xl/worksheets/sheet2.xml')!.contenu.equals(avant)).toBe(true);
  });

  it('conserve les lignes preexistantes de la feuille modifiee', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const avant = lireZip(original()).get('xl/worksheets/sheet1.xml')!.contenu.toString('utf8');
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const apres = lireZip(fichier).get('xl/worksheets/sheet1.xml')!.contenu.toString('utf8');

    // Chaque ligne d'origine se retrouve telle quelle dans le resultat.
    const lignes = avant.match(/<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g) ?? [];
    expect(lignes.length).toBeGreaterThan(10);
    for (const ligne of lignes) expect(apres).toContain(ligne);
    // Les cellules fusionnees et les largeurs de colonne sont conservees.
    expect(apres).toContain('<mergeCell ref="A1:I1"/>');
    expect(apres).toContain('<col min="7" max="7" width="62" customWidth="1"/>');
  });

  it('reste lisible par le lecteur de classeur, avec ses trois onglets', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const relu = lireClasseur(fichier);
    expect(relu.onglets.map((o) => o.nom)).toEqual(['Suivi Quotidien', 'sem 45', 'Recap Mensuelle']);
    const sem = ongletNomme(relu, 'sem 45')!;
    expect(sem.lignes.get(5)?.find((c) => c.ref === 'G5')?.formule).toBe('SUM(B5:F5)');
  });

  it('refuse d’ecraser une cellule qui porte une formule', async () => {
    const classeur = new ClasseurModifiable(original());
    // G5 de l'onglet « sem 45 » porte SUM(B5:F5).
    expect(() => classeur.definirCellule('sem 45', 7, 5, 42)).toThrow(/formule/i);
  });
});

describe('bloc de jour du Suivi Quotidien', () => {
  it('ecrit une ligne vide, l’en-tete recopiee, puis les donnees', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const avantDerniere = lireClasseur(original());
    const ligneDepart = ongletNomme(avantDerniere, ONGLET_SUIVI)!.derniereLigne;

    const { fichier, bilan } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    expect(bilan.lignesEcrites).toBe(1);

    const onglet = ongletNomme(lireClasseur(fichier), ONGLET_SUIVI)!;
    // Ligne vide de separation, en-tete, puis une ligne de donnees.
    expect(onglet.lignes.get(ligneDepart + 1)?.length ?? 0).toBe(0);
    const entete = onglet.lignes.get(ligneDepart + 2)!;
    expect(valeurCellule(entete, 1)).toBe('Date');
    expect(valeurCellule(entete, 7)).toBe('Description des travaux');
    const donnees = onglet.lignes.get(ligneDepart + 3)!;
    expect(valeurCellule(donnees, 1)).toBe('02/03/2026');
    expect(valeurCellule(donnees, 3)).toBe('Alpha Pharma (Algerie)');
    expect(valeurCellule(donnees, 6)).toBe('Gelules 180 kg');
    expect(valeurCellule(donnees, 7)).toMatch(/^1\. .* : En cours$/);
  });

  it('laisse les colonnes B, D et E vides', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const ligneDepart = ongletNomme(lireClasseur(original()), ONGLET_SUIVI)!.derniereLigne;
    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const donnees = ongletNomme(lireClasseur(fichier), ONGLET_SUIVI)!.lignes.get(ligneDepart + 3)!;
    for (const colonne of [2, 4, 5]) expect(valeurCellule(donnees, colonne)).toBe('');
  });

  it('ne porte la date que sur la premiere ligne du bloc', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const second = await trouverOuCreerDossier({ compteId, client: 'Beta Distrib', pays: 'Libye', produit: 'Sirop' }, AUTEUR);
    await ajouterEvenement(
      { dossierId: second.dossier.id, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', source: 'mail', objet: 'Documents', resume: 'BL prepare.', survenuLe: t('2026-03-02T11:00') },
      AUTEUR,
    );
    const ligneDepart = ongletNomme(lireClasseur(original()), ONGLET_SUIVI)!.derniereLigne;
    const { fichier, bilan } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    expect(bilan.lignesEcrites).toBe(2);
    const onglet = ongletNomme(lireClasseur(fichier), ONGLET_SUIVI)!;
    expect(valeurCellule(onglet.lignes.get(ligneDepart + 3), 1)).toBe('02/03/2026');
    expect(valeurCellule(onglet.lignes.get(ligneDepart + 4), 1)).toBe('');
  });

  it('reprend les styles de la ligne modele', async () => {
    await demande('Cotation fret aerien', 'T01', '2026-03-02', 'Trois transitaires consultes.');
    const modele = repererModele(original());
    const avant = new ClasseurModifiable(original());
    const stylesEntete = avant.stylesDeLaLigne(ONGLET_SUIVI, modele.ligneEntete);
    const stylesDonnees = avant.stylesDeLaLigne(ONGLET_SUIVI, modele.ligneDonnees);

    const { fichier } = await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const apres = new ClasseurModifiable(fichier);
    const derniere = apres.derniereLigne(ONGLET_SUIVI);
    expect(apres.stylesDeLaLigne(ONGLET_SUIVI, derniere - 1).get(1)).toBe(stylesEntete.get(1));
    expect(apres.stylesDeLaLigne(ONGLET_SUIVI, derniere).get(1)).toBe(stylesDonnees.get(1));
  });

  it('ecrit un seul bloc par jour demande, dans l’ordre chronologique', async () => {
    await demande('Cotation', 'T01', '2026-03-03', 'Offres recues.');
    await demande('Documents', 'T02', '2026-03-02', 'BL prepare.');
    const { bilan } = await exporterReporting(original(), { compteId, jours: ['2026-03-03', '2026-03-02'] }, AUTEUR);
    expect(bilan.joursEcrits).toEqual(['2026-03-02', '2026-03-03']);
  });

  it('saute un jour sans activite au lieu d’ecrire un bloc vide', async () => {
    await demande('Cotation', 'T01', '2026-03-02', 'Offres recues.');
    const { bilan } = await exporterReporting(original(), { compteId, jours: ['2026-01-05'] }, AUTEUR);
    expect(bilan.joursEcrits).toEqual([]);
    expect(bilan.lignesEcrites).toBe(0);
  });
});

describe('contenu des lignes', () => {
  it('termine la description par un statut de reporting exact', async () => {
    const r = await demande('Dossier complet', 'T02', '2026-03-02', 'Scan du BL archive.');
    await changerStatut(r.demande!.id, 'termine', AUTEUR, { survenuLe: t('2026-03-02T16:00') });
    const bloc = await construireBlocJour(compteId, '2026-03-02');
    expect(bloc.lignes[0].description).toMatch(/ : Termine$/);
    expect(bloc.lignes[0].statut).toBe('Termine');
  });

  it('reporte une attente DO en « En cours », conformement a la section 4.4', async () => {
    const r = await demande('Proforma a valider', 'T03', '2026-03-02', 'Transmise a la DO.');
    await changerStatut(r.demande!.id, 'attente_do', AUTEUR, { survenuLe: t('2026-03-02T14:00') });
    const bloc = await construireBlocJour(compteId, '2026-03-02');
    expect(bloc.lignes[0].statut).toBe('En cours');
  });

  it('ne donne qu’une ligne par dossier, au dernier etat connu', async () => {
    const a = await demande('Cotation', 'T01', '2026-03-02', 'Premiere action.');
    await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', source: 'mail', objet: 'Documents', resume: 'Deuxieme action.', survenuLe: t('2026-03-02T15:00') },
      AUTEUR,
    );
    void a;
    const bloc = await construireBlocJour(compteId, '2026-03-02');
    // Deux demandes sur le meme dossier, une seule ligne.
    expect(bloc.lignes).toHaveLength(1);
    expect(bloc.lignes[0].description).toContain('Premiere action');
    expect(bloc.lignes[0].description).toContain('Deuxieme action');
  });

  it('exclut les dossiers hors perimetre', async () => {
    await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T00', source: 'mail', objet: 'Newsletter', resume: 'Promotion.', survenuLe: t('2026-03-02T10:00') },
      AUTEUR,
    );
    const bloc = await construireBlocJour(compteId, '2026-03-02');
    expect(bloc.lignes).toHaveLength(0);
  });

  it('ne laisse passer aucun tiret long', async () => {
    await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        famille: 'T01',
        source: 'mail',
        objet: 'Cotation',
        resume: 'Offre — validee — par la DO, prix 10–20 euros.',
        survenuLe: t('2026-03-02T10:00'),
      },
      AUTEUR,
    );
    const bloc = await construireBlocJour(compteId, '2026-03-02');
    expect(bloc.lignes[0].description).not.toMatch(TIRETS_LONGS);
    expect(bloc.lignes[0].description).toContain('10 à 20 euros');
  });
});

describe('onglet hebdomadaire', () => {
  it('calcule le numero d’onglet : semaine ISO moins 26 en 2026', () => {
    expect(numeroOngletSemaine(45, 2026)).toBe(19);
    expect(nomOngletSemaine(45, 2026)).toBe('sem 19');
    // Hors 2026, le numero de semaine est repris tel quel.
    expect(numeroOngletSemaine(45, 2027)).toBe(45);
  });

  it('refuse d’ecrire si l’onglet de la semaine est absent du classeur', async () => {
    await demande('Cotation', 'T01', '2026-03-02', 'Offres recues.');
    // La semaine du 2 mars 2026 est la semaine 10, soit « sem -16 » : absente du classeur.
    await expect(exporterReporting(original(), { compteId, jours: ['2026-03-02'], ongletSemaine: true }, AUTEUR)).rejects.toThrow(
      /absent du classeur/,
    );
  });

  it('ecrit les colonnes B a F de l’onglet present, sans toucher aux lignes 8 a 11', async () => {
    // Le classeur fictif porte « sem 45 » : la semaine ISO correspondante en 2026 est la 71,
    // qui n'existe pas. On ecrit donc directement par l'API bas niveau, comme le ferait
    // l'export sur un classeur dont l'onglet correspond.
    await demande('Cotation', 'T01', '2026-03-02', 'Offres recues.');
    const donnees = await construireColonneSemaine(compteId, '2026-03-02');
    const classeur = new ClasseurModifiable(original());
    const avant = lireClasseur(original());
    const semAvant = ongletNomme(avant, 'sem 45')!;
    const lignes8a11 = LIGNES_SEMAINE_INTOUCHABLES.map((n) => semAvant.lignes.get(n));

    const { ecrireColonneSemaine } = await import('../src/server/modules/export/service');
    ecrireColonneSemaine(classeur, 'sem 45', 2, donnees);
    const apres = lireClasseur(classeur.versBuffer());
    const sem = ongletNomme(apres, 'sem 45')!;

    expect(valeurCellule(sem.lignes.get(LIGNES_SEMAINE.dossiersTraites), 2)).toBe(String(donnees.dossiersTraites));
    expect(valeurCellule(sem.lignes.get(LIGNES_SEMAINE.pointsVigilance), 2)).toBe(donnees.pointsVigilance);
    // Les lignes 8 a 11 sont restees exactement ce qu'elles etaient.
    LIGNES_SEMAINE_INTOUCHABLES.forEach((n, i) => {
      expect(sem.lignes.get(n)?.map((c) => c.texte) ?? []).toEqual(lignes8a11[i]?.map((c) => c.texte) ?? []);
    });
    // La formule de la ligne 5 est intacte.
    expect(sem.lignes.get(5)?.find((c) => c.ref === 'G5')?.formule).toBe('SUM(B5:F5)');
  });

  it('ne laisse aucune reference dans les syntheses', () => {
    expect(retirerReferences('BL FICTIF-BL-0912 envoye au client')).toBe('BL envoye au client');
    expect(retirerReferences('Booking BK-2026-118 confirme')).toBe('Booking confirme');
    expect(retirerReferences('Facture no FA-0042 reglee')).toBe('Facture reglee');
    expect(retirerReferences('AWB 020-12345678 emis')).toBe('AWB emis');
    // Un texte sans reference n'est pas touche.
    expect(retirerReferences('Trois transitaires consultes')).toBe('Trois transitaires consultes');
  });

  it('construit des syntheses sans reference ni tiret long', async () => {
    await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        famille: 'T02',
        source: 'mail',
        objet: 'Documents',
        resume: 'BL FICTIF-BL-0912 envoye — accord obtenu.',
        survenuLe: t('2026-03-02T10:00'),
      },
      AUTEUR,
    );
    const colonne = await construireColonneSemaine(compteId, '2026-03-02');
    for (const texte of [colonne.faitsMarquants, colonne.pointsVigilance, colonne.actionsSemaineSuivante, colonne.pointsBloquants]) {
      expect(texte).not.toMatch(TIRETS_LONGS);
      expect(texte).not.toMatch(/FICTIF-BL-0912/);
    }
  });

  it('compte les indicateurs numeriques du jour', async () => {
    const r = await demande('Documents', 'T02', '2026-03-02', 'Jeu prepare.');
    await ajouterEvenement(
      { demandeId: r.demande!.id, sens: 'sortant', nature: 'envoi_livrable', famille: 'T02', interlocuteur: 'client', source: 'mail', survenuLe: t('2026-03-02T11:00') },
      AUTEUR,
    );
    await ajouterEvenement(
      { demandeId: r.demande!.id, sens: 'sortant', nature: 'relance_emise', famille: 'T02', interlocuteur: 'client', source: 'mail', survenuLe: t('2026-03-02T15:00') },
      AUTEUR,
    );
    const colonne = await construireColonneSemaine(compteId, '2026-03-02');
    expect(colonne.documentsEmis).toBe(1);
    expect(colonne.relancesEnvoyees).toBe(1);
    expect(colonne.nouveauxLeads).toBe(0);
  });
});

describe('garde-fous de l’export', () => {
  it('refuse un classeur sans onglet Suivi Quotidien', async () => {
    const { ecrireZip } = await import('../src/server/lib/xlsx/ecriture-zip');
    const faux = ecrireZip([
      { nom: '[Content_Types].xml', contenu: Buffer.from('<Types/>', 'utf8') },
      { nom: 'xl/workbook.xml', contenu: Buffer.from('<workbook><sheets><sheet name="Autre" sheetId="1" r:id="rId1"/></sheets></workbook>', 'utf8') },
    ]);
    await expect(exporterReporting(faux, { compteId, jours: ['2026-03-02'] }, AUTEUR)).rejects.toThrow(/Suivi Quotidien/);
  });

  it('refuse un export sans jour demande', async () => {
    await expect(exporterReporting(original(), { compteId, jours: [] }, AUTEUR)).rejects.toThrow(/au moins un jour/i);
  });

  it('trace l’export dans le journal des actions', async () => {
    await demande('Cotation', 'T01', '2026-03-02', 'Offres recues.');
    await exporterReporting(original(), { compteId, jours: ['2026-03-02'] }, AUTEUR);
    const lignes = await db.select().from(schema.journalActions);
    expect(lignes.some((l) => l.action === 'reporting_exporte')).toBe(true);
  });
});
