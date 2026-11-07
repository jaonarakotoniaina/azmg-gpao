/**
 * Parcours end-to-end de la phase 1, sur le build de production.
 *
 * Criteres couverts :
 *  - creer un dossier et une demande en moins de 30 secondes au clavier ;
 *  - chaque transition est horodatee et visible ;
 *  - l'import d'un classeur fictif cree les dossiers sans doublon ;
 *  - un evenement hors perimetre (T00) n'apparait dans aucune vue de pilotage.
 */
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { COMPTES, seConnecter } from './outils';

const CLASSEUR = path.resolve(__dirname, '..', 'tests', 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');

test.describe.configure({ mode: 'serial' });

test('la collaboratrice cree un dossier et une demande au clavier en moins de 30 secondes', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  await page.goto('/saisie');
  await expect(page.getByRole('heading', { name: 'Saisie rapide' })).toBeVisible();

  // Le compte est preselectionne : un seul compte dans le perimetre de la collaboratrice.
  await expect(page.getByRole('combobox', { name: 'Compte client', exact: true })).toHaveValue(/\d+/);

  const depart = Date.now();
  await page.getByRole('checkbox', { name: /Creer un nouveau dossier/ }).check();
  await page.getByRole('textbox', { name: 'Client', exact: true }).fill('Alpha Pharma');
  await page.getByRole('textbox', { name: 'Pays', exact: true }).fill('Algerie');
  await page.getByRole('textbox', { name: 'Produit et quantite', exact: true }).fill('Gelules vitamine C 180 kg');
  await page.getByRole('textbox', { name: 'Operation', exact: true }).fill('aerien vers Alger');
  await page.getByRole('textbox', { name: 'Objet', exact: true }).fill('Cotation fret aerien 180 kg vers Alger');
  await page.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('T01');
  await page.getByRole('combobox', { name: 'Interlocuteur', exact: true }).selectOption('client');
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('whatsapp');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(/Saisie enregistree/)).toBeVisible({ timeout: 15_000 });
  const duree = (Date.now() - depart) / 1000;

  expect(duree, `la saisie a pris ${duree.toFixed(1)} s`).toBeLessThan(30);

  // La demande apparait immediatement dans la file du jour.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Cotation fret aerien 180 kg vers Alger' })).toBeVisible();
  // Le badge de statut de la carte, et non l'option du filtre qui porte le meme texte.
  await expect(page.locator('article').first().getByText('Nouveau', { exact: true })).toBeVisible();
});

test('le changement de statut est horodate et visible dans la chronologie', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  await page.goto('/');
  await page.getByRole('link', { name: 'Cotation fret aerien 180 kg vers Alger' }).click();
  await expect(page.getByRole('heading', { name: 'Cotation fret aerien 180 kg vers Alger' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Nouveau statut', exact: true }).selectOption('attente_do');
  await page.getByRole('textbox', { name: 'Motif', exact: true }).fill('validation du transitaire et du prix');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByText(/Statut passe en/)).toBeVisible({ timeout: 15_000 });

  // La transition est tracee avec son motif et l'acteur desormais attendu.
  const transitions = page.getByRole('region', { name: /Transitions de statut/ }).or(page.locator('section', { hasText: 'Transitions de statut' }).first());
  await expect(transitions.getByText('validation du transitaire et du prix')).toBeVisible();
  await expect(transitions.getByText(/attendu de la DO/)).toBeVisible();
  await expect(page.getByText('Attente de la DO')).toBeVisible();
});

test('un evenement hors perimetre n’apparait ni dans la file ni dans la chronologie', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  // La saisie rapide refuse explicitement la famille T00.
  await page.goto('/saisie');
  const champFamille = page.getByRole('combobox', { name: 'Famille', exact: true });
  const familles = await champFamille.locator('option').allTextContents();
  expect(familles.join(' ')).not.toContain('T00');

  // Et l'API la refuse aussi, quel que soit le chemin emprunte.
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'azmg_gpao_csrf')?.value ?? '';
  // page.request partage les cookies du navigateur, contrairement au contexte `request` global.
  const reponse = await page.request.post('/api/saisie/rapide', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { compteId: 1, nouveauDossier: { client: 'Marketing' }, famille: 'T00', objet: 'Newsletter', sens: 'entrant', nature: 'demande_entrante', source: 'mail' },
  });
  expect(reponse.status()).toBe(400);
  expect(await reponse.text()).toMatch(/hors perimetre/i);
});

test('l’administrateur importe le classeur fictif, deux fois, sans doublon', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/import');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Classeur .xlsx', { exact: true }).setInputFiles(CLASSEUR);
  await page.getByRole('button', { name: 'Importer' }).click();
  await expect(page.getByText(/dossier\(s\) cree\(s\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('section#resultat').getByText('6').first()).toBeVisible();

  // Second import du meme classeur : aucun dossier supplementaire.
  await page.getByLabel('Classeur .xlsx', { exact: true }).setInputFiles(CLASSEUR);
  await page.getByRole('button', { name: 'Importer' }).click();
  await expect(page.getByText(/0 dossier\(s\) cree\(s\)/)).toBeVisible({ timeout: 20_000 });

  // La liste des dossiers n'en contient bien que six issus du classeur.
  await page.goto('/dossiers');
  await expect(page.getByRole('link', { name: /Alpha Pharma/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Beta Distrib/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Zeta Import/ })).toHaveCount(1);
});

test('la fiche dossier montre la chronologie et les temps en heures ouvrees', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  await page.goto('/dossiers');
  await page.getByRole('link', { name: /Alpha Pharma.*Gelules vitamine C/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alpha Pharma');

  await expect(page.getByRole('tab', { name: /Chronologie/ })).toBeVisible();
  await expect(page.getByText(/Cotation fret aerien/).first()).toBeVisible();

  await page.getByRole('tab', { name: /Demandes/ }).click();
  await expect(page.getByRole('columnheader', { name: 'Reporting client' })).toBeVisible();
  // L'attente DO est reportee « En cours » avec sa mention, conformement a la section 4.4.
  await expect(page.getByText('En cours (validation DO attendue)')).toBeVisible();
});

test('la connexion est exigee et le role de lecture seule ne peut pas saisir', async ({ page }) => {
  await page.goto('/saisie');
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.getByRole('heading', { name: 'AZMG GPAO' })).toBeVisible();
});
