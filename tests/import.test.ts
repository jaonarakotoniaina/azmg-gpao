/**
 * Import du classeur de suivi.
 * Critere de la phase 1 : « l'import d'un classeur fictif cree les dossiers sans doublon ».
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, db, schema } from './aide';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import {
  extraireStatut,
  importerClasseur,
  lireJour,
  lireSuiviQuotidien,
  separerClientPays,
  statutDossierDepuisReporting,
} from '../src/server/modules/import/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { lireClasseur, ongletNomme } from '../src/server/lib/xlsx/lecture';
import { ecrireZip, crc32 } from '../src/server/lib/xlsx/ecriture-zip';
import { lireZip } from '../src/server/lib/xlsx/zip';

const CLASSEUR = path.resolve(__dirname, 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');
const contenu = () => fs.readFileSync(CLASSEUR);

let compteId: number;

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, imports RESTART IDENTITY CASCADE`);
  compteId = (await creerCompteDeTest()).id;
});

describe('archive ZIP maison', () => {
  it('fait un aller-retour fidele', () => {
    const entrees = [
      { nom: 'a.txt', contenu: Buffer.from('bonjour le monde, bonjour le monde, bonjour', 'utf8') },
      { nom: 'dossier/b.xml', contenu: Buffer.from('<x>accentue : ete, ou</x>', 'utf8') },
    ];
    const relu = lireZip(ecrireZip(entrees));
    expect([...relu.keys()]).toEqual(['a.txt', 'dossier/b.xml']);
    expect(relu.get('a.txt')!.contenu.toString('utf8')).toBe(entrees[0].contenu.toString('utf8'));
    expect(relu.get('dossier/b.xml')!.contenu.toString('utf8')).toBe(entrees[1].contenu.toString('utf8'));
  });

  it('calcule un CRC32 conforme', () => {
    // Valeur de reference connue pour la chaine « 123456789 ».
    expect(crc32(Buffer.from('123456789', 'utf8'))).toBe(0xcbf43926);
  });

  it('rejette un fichier qui n’est pas une archive', () => {
    expect(() => lireZip(Buffer.from('pas une archive du tout', 'utf8'))).toThrow(/classeur xlsx|repertoire central/i);
  });
});

describe('lecture du classeur fictif', () => {
  it('trouve les trois onglets attendus', () => {
    const classeur = lireClasseur(contenu());
    expect(classeur.onglets.map((o) => o.nom)).toEqual(['Suivi Quotidien', 'sem 45', 'Recap Mensuelle']);
  });

  it('conserve les formules sans les evaluer', () => {
    const sem = ongletNomme(lireClasseur(contenu()), 'sem 45')!;
    expect(sem.lignes.get(5)?.find((c) => c.ref === 'G5')?.formule).toBe('SUM(B5:F5)');
  });

  it('lit les lignes de donnees en ignorant les en-tetes recopiees et les lignes vides', () => {
    const onglet = ongletNomme(lireClasseur(contenu()), 'Suivi Quotidien')!;
    const { lignes, anomalies } = lireSuiviQuotidien(onglet);
    expect(anomalies).toHaveLength(0);
    expect(lignes).toHaveLength(8);
    expect(lignes.map((l) => l.jour)).toEqual([
      '2026-11-03',
      '2026-11-03',
      '2026-11-04',
      '2026-11-04',
      '2026-11-04',
      '2026-11-05',
      '2026-11-05',
      '2026-11-05',
    ]);
  });

  it('reporte la date du bloc sur les lignes qui ne la portent pas', () => {
    const onglet = ongletNomme(lireClasseur(contenu()), 'Suivi Quotidien')!;
    const { lignes } = lireSuiviQuotidien(onglet);
    const beta = lignes.find((l) => l.client.startsWith('Beta Distrib'))!;
    expect(beta.jour).toBe('2026-11-03');
  });
});

describe('extraction du statut de reporting', () => {
  it('reconnait les cinq statuts exacts en fin de description', () => {
    expect(extraireStatut('1. Cotation demandee : En cours')).toBe('En cours');
    expect(extraireStatut('2. Documents envoyes : En attente client')).toBe('En attente client');
    expect(extraireStatut('3. Dossier complet : Termine')).toBe('Termine');
    expect(extraireStatut('4. Autorite injoignable : Bloque')).toBe('Bloque');
    expect(extraireStatut('5. Commande annulee : Annule')).toBe('Annule');
  });

  it('tolere les accents et la casse', () => {
    expect(extraireStatut('1. Dossier complet : Terminé')).toBe('Termine');
    expect(extraireStatut('2. Envoi fait : EN ATTENTE CLIENT')).toBe('En attente client');
  });

  it('ne confond pas « En attente client » avec « En cours »', () => {
    expect(extraireStatut('Documents transmis : En attente client')).toBe('En attente client');
  });

  it('renvoie null quand aucun statut n’est reconnu', () => {
    expect(extraireStatut('Travail en cours de preparation sans statut')).toBeNull();
    expect(extraireStatut('')).toBeNull();
  });

  it('traduit le statut de reporting en statut de dossier', () => {
    expect(statutDossierDepuisReporting('Termine')).toBe('clos');
    expect(statutDossierDepuisReporting('Annule')).toBe('annule');
    expect(statutDossierDepuisReporting('En attente client')).toBe('en_attente');
    expect(statutDossierDepuisReporting('En cours')).toBe('ouvert');
    expect(statutDossierDepuisReporting('Bloque')).toBe('ouvert');
    expect(statutDossierDepuisReporting(null)).toBe('ouvert');
  });
});

describe('lecture des dates', () => {
  it('lit le format JJ/MM/AAAA du classeur', () => {
    expect(lireJour('03/11/2026')).toBe('2026-11-03');
    expect(lireJour('3/11/2026')).toBe('2026-11-03');
  });

  it('lit aussi une cellule de type date convertie en ISO', () => {
    expect(lireJour('2026-11-03')).toBe('2026-11-03');
  });

  it('ignore ce qui n’est pas une date', () => {
    expect(lireJour('Date')).toBeNull();
    expect(lireJour('')).toBeNull();
    expect(lireJour('32/13/2026')).toBeNull();
  });
});

describe('separation du client et du pays', () => {
  it('separe « Nom (Pays) », comme l\u2019ecrit le classeur en colonne C', () => {
    expect(separerClientPays('Alpha Pharma (Algerie)')).toEqual({ client: 'Alpha Pharma', pays: 'Algerie' });
    expect(separerClientPays('Gamma Sante (Emirats arabes unis)')).toEqual({ client: 'Gamma Sante', pays: 'Emirats arabes unis' });
  });

  it('laisse intact un client sans pays entre parentheses', () => {
    expect(separerClientPays('Alpha Pharma')).toEqual({ client: 'Alpha Pharma', pays: null });
    expect(separerClientPays('  Beta Distrib  ')).toEqual({ client: 'Beta Distrib', pays: null });
  });

  it('ne coupe pas quand il n\u2019y a que des parentheses', () => {
    expect(separerClientPays('(Algerie)')).toEqual({ client: '(Algerie)', pays: null });
  });
});

describe('import des dossiers', () => {
  it('cree un dossier par couple client et produit', async () => {
    const { bilan } = await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    expect(bilan.lignesLues).toBe(8);
    // Six couples distincts : Alpha, Beta, Gamma, Epsilon, Delta, Zeta.
    expect(bilan.dossiersCrees).toBe(6);
    expect(bilan.dossiersMisAJour).toBe(0);
    expect(bilan.jourDebut).toBe('2026-11-03');
    expect(bilan.jourFin).toBe('2026-11-05');
    const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.compteId, compteId));
    expect(dossiers).toHaveLength(6);
  });

  it('ne cree aucun doublon quand le meme classeur est importe deux fois', async () => {
    await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    const second = await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    expect(second.bilan.dossiersCrees).toBe(0);
    expect(second.bilan.dossiersMisAJour).toBe(6);
    const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.compteId, compteId));
    expect(dossiers).toHaveLength(6);
  });

  it('retient le dernier etat connu de chaque dossier', async () => {
    const { dossiers } = await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    // Beta Distrib : « En attente client » le 3, puis « Termine » le 5. Le dernier gagne.
    const beta = dossiers.find((d) => d.client.startsWith('Beta Distrib'))!;
    expect(beta.statut).toBe('clos');
    expect(beta.resume).toContain('Termine');
    expect(beta.resume).toContain('05/11/2026');

    // Alpha Pharma reste « En cours » : dossier ouvert.
    const alpha = dossiers.find((d) => d.client.startsWith('Alpha Pharma'))!;
    expect(alpha.statut).toBe('ouvert');

    // Zeta Import a ete annule.
    const zeta = dossiers.find((d) => d.client.startsWith('Zeta Import'))!;
    expect(zeta.statut).toBe('annule');

    // Epsilon Trade est bloque : le dossier reste ouvert cote GPAO.
    const epsilon = dossiers.find((d) => d.client.startsWith('Epsilon Trade'))!;
    expect(epsilon.statut).toBe('ouvert');
    expect(epsilon.resume).toContain('Bloque');
  });

  it('ne cree aucune demande (le classeur ne porte ni famille ni nature)', async () => {
    await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    const demandes = await db.select().from(schema.demandes);
    expect(demandes).toHaveLength(0);
  });

  it('enregistre le bilan de l’import', async () => {
    await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    const [trace] = await db.select().from(schema.imports).where(eq(schema.imports.compteId, compteId));
    expect(trace.nomFichier).toBe('fictif.xlsx');
    expect(trace.empreinte).toHaveLength(64);
    expect((trace.bilan as { dossiersCrees: number }).dossiersCrees).toBe(6);
  });

  it('reprend le dossier deja ouvert par le poste au lieu d\u2019en creer un second', async () => {
    // Le poste a ouvert le dossier avec une operation, que le classeur ne connait pas.
    const { dossier } = await trouverOuCreerDossier(
      { compteId, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules vitamine C 180 kg', operation: 'aerien vers Alger' },
      AUTEUR_SYSTEME,
    );
    const { bilan, dossiers } = await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    expect(bilan.dossiersCrees).toBe(5);
    expect(dossiers.map((d) => d.id)).toContain(dossier.id);
    const tous = await db.select().from(schema.dossiers).where(eq(schema.dossiers.compteId, compteId));
    expect(tous).toHaveLength(6);
  });

  it('separe le client et le pays des dossiers crees', async () => {
    const { dossiers } = await importerClasseur(contenu(), { compteId, nomFichier: 'fictif.xlsx' }, AUTEUR_SYSTEME);
    const alpha = dossiers.find((d) => d.client === 'Alpha Pharma')!;
    expect(alpha).toBeDefined();
    expect(alpha.pays).toBe('Algerie');
  });

  it('refuse un classeur sans onglet « Suivi Quotidien »', async () => {
    const sansOnglet = ecrireZip([
      { nom: '[Content_Types].xml', contenu: Buffer.from('<Types/>', 'utf8') },
      {
        nom: 'xl/workbook.xml',
        contenu: Buffer.from('<workbook><sheets><sheet name="Autre chose" sheetId="1" r:id="rId1"/></sheets></workbook>', 'utf8'),
      },
    ]);
    await expect(importerClasseur(sansOnglet, { compteId, nomFichier: 'autre.xlsx' }, AUTEUR_SYSTEME)).rejects.toThrow(/Suivi Quotidien/);
  });

  it('refuse un fichier qui n’est pas un classeur', async () => {
    await expect(
      importerClasseur(Buffer.from('ceci est un texte', 'utf8'), { compteId, nomFichier: 'faux.xlsx' }, AUTEUR_SYSTEME),
    ).rejects.toThrow(/illisible/i);
  });
});
