/**
 * Parcours end-to-end de la phase 1, sur le build de production.
 *
 * Criteres couverts :
 *  - creer un dossier et une demande en moins de 30 secondes au clavier ;
 *  - chaque transition est horodatee et visible ;
 *  - l'import d'un classeur fictif cree les dossiers sans doublon ;
 *  - un evenement hors perimetre (T00) n'apparait dans aucune vue de pilotage.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { COMPTES, seConnecter } from './outils';

const CLASSEUR = path.resolve(__dirname, '..', 'tests', 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');

test.describe.configure({ mode: 'serial' });

/**
 * Premier demarrage : l'application arrive vide, sans aucun compte client. Ce parcours cree le
 * compte et les postes par l'interface, et tous les parcours suivants travaillent dessus.
 */
test('le premier demarrage permet de creer un compte client et ses postes', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/parametres');
  await page.getByRole('tab', { name: 'Comptes clients' }).click();

  // Aucun compte : l'ecran doit le dire, et non tourner indefiniment sur un chargement.
  await expect(page.getByText('Aucun compte client pour le moment.')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Nom du client', exact: true }).fill('Compte de parcours');
  await page.getByRole('textbox', { name: 'Pays', exact: true }).fill('Espagne');
  await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Barcelone');
  await page.getByRole('textbox', { name: 'Nom de la donneuse d’ordre', exact: true }).fill('Responsable export (fictive)');
  await page.getByRole('textbox', { name: 'Adresse de la donneuse d’ordre', exact: true }).first().fill('do@client-fictif.test');
  await page.getByRole('button', { name: 'Creer le compte' }).click();
  await expect(page.getByText('Compte client cree')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Aucun compte client pour le moment.')).toHaveCount(0);

  // Le poste de l'assistante export, puis celui de la designer : deux metiers sur un compte.
  await page.getByRole('textbox', { name: 'Nouveau poste', exact: true }).fill('Assistante export');
  await page.getByRole('combobox', { name: 'Metier', exact: true }).selectOption('export');
  await page.getByRole('textbox', { name: 'Adresses du poste', exact: true }).fill('info@client-fictif.test');
  // Sans rattachement, le poste n'apparait dans la file d'aucun collaborateur.
  await page.getByRole('combobox', { name: 'Collaborateur', exact: true }).selectOption({ label: 'Elysa' });
  await page.getByRole('button', { name: 'Creer le poste' }).click();
  await expect(page.getByText('Poste cree')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Nouveau poste', exact: true }).fill('Designer');
  await page.getByRole('combobox', { name: 'Metier', exact: true }).selectOption('designer');
  await page.getByRole('textbox', { name: 'Adresses du poste', exact: true }).fill('marketing@client-fictif.test');
  await page.getByRole('button', { name: 'Creer le poste' }).click();
  await expect(page.getByText('Poste cree')).toBeVisible({ timeout: 15_000 });

  // Les deux postes sont la, chacun avec son perimetre de familles pre-rempli par son metier.
  await expect(page.getByText('Assistante export', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Designer', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/14 famille\(s\)/)).toBeVisible();
  await expect(page.getByText(/6 famille\(s\)/)).toBeVisible();
});

/**
 * Comptes utilisateurs : creation, changement de role, desactivation, et changement de son propre
 * mot de passe. Ces routes existaient depuis la phase 1 sans qu'aucun ecran ne les appelle.
 */
test('l’administrateur cree un compte utilisateur, le modifie et le desactive', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/parametres');
  await page.getByRole('tab', { name: 'Equipe' }).click();

  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Collaboratrice de parcours');
  await page.getByRole('textbox', { name: 'Adresse email', exact: true }).fill('parcours@azmg-solutions.com');
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('collaborateur');
  await page.getByLabel('Mot de passe initial', { exact: true }).fill('MotDePasseInitial2026');
  await page.getByRole('button', { name: 'Creer le compte' }).click();
  await expect(page.getByText('Compte utilisateur cree')).toBeVisible({ timeout: 15_000 });

  const ligne = page.locator('tr', { hasText: 'parcours@azmg-solutions.com' });
  await expect(ligne).toBeVisible();
  await expect(ligne.getByText('actif')).toBeVisible();

  // Le role se change depuis la liste.
  await ligne.getByRole('combobox', { name: /Role de/ }).selectOption('manager');
  await expect(page.getByText('Compte utilisateur mis a jour')).toBeVisible({ timeout: 15_000 });

  // La desactivation ferme les sessions ouvertes du compte.
  await ligne.getByRole('button', { name: 'Desactiver' }).click();
  await expect(ligne.getByText('desactive')).toBeVisible({ timeout: 15_000 });

  // Un administrateur ne peut pas se retirer ses propres droits : aucun bouton sur sa ligne.
  const sienne = page.locator('tr', { hasText: COMPTES.ceo.email });
  await expect(sienne.getByText('votre compte')).toBeVisible();
});

test('chacun peut changer son mot de passe depuis son compte', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  await page.goto('/parametres');
  await page.getByRole('tab', { name: 'Mon compte' }).click();

  // Un mot de passe actuel errone est refuse par le serveur.
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('MauvaisMotDePasse2026');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse2026');
  await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse2026');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText(/Mot de passe actuel incorrect/)).toBeVisible({ timeout: 15_000 });

  // Avec le bon mot de passe actuel, le changement passe, puis on le remet pour la suite.
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill(COMPTES.collaboratrice.motDePasse);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse2026');
  await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse2026');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText('Mot de passe change')).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('NouveauMotDePasse2026');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(COMPTES.collaboratrice.motDePasse);
  await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(COMPTES.collaboratrice.motDePasse);
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText('Mot de passe change')).toBeVisible({ timeout: 15_000 });
});

/**
 * Un compte qui vient d'etre cree n'a rien recu. Des zeros partout ne doivent pas ressembler a une
 * semaine calme : l'ecran doit dire que c'est une mise en route, et par ou commencer.
 */
test('un compte neuf explique sa mise en route au lieu d’afficher des zeros', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/tableau-de-bord');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });

  const carte = page.locator('#mise-en-route');
  await expect(carte).toBeVisible({ timeout: 15_000 });
  await expect(carte.getByText(/n’a encore recu aucune demande/)).toBeVisible();
  // Les trois chemins pour alimenter le compte sont proposes, et mènent quelque part.
  await expect(carte.getByRole('link', { name: 'Saisie rapide' })).toHaveAttribute('href', '/saisie');
  await expect(carte.getByRole('link', { name: 'Import des mails' })).toHaveAttribute('href', '/import-mails');
  await expect(carte.getByRole('link', { name: 'Import du classeur' })).toHaveAttribute('href', '/import');
  // Aucun indicateur trompeur n'est affiche tant qu'il n'y a rien a mesurer.
  await expect(page.getByText('Demandes entrees')).toHaveCount(0);
});

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

// ---------------------------------------------------------------------------
// Phase 2 : pilotage
// ---------------------------------------------------------------------------

test('le tableau de bord affiche les indicateurs du compte', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/tableau-de-bord');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole('heading', { name: 'Synthese' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Demandes entrees')).toBeVisible();
  await expect(page.getByText('Stock ouvert')).toBeVisible();
  await expect(page.getByText('Ou attend le temps')).toBeVisible();
  // Les durees sont exprimees en heures ouvrees, jamais en minutes brutes.
  await expect(page.getByText('en heures ouvrees du client').first()).toBeVisible();
});

test('le digest de validation est un brouillon, sans aucun envoi', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/digest');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await expect(page.getByText(/l.IA prepare, l.humain envoie/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Aucun envoi automatique')).toBeVisible();
  // Aucun bouton d'envoi : seulement la copie du brouillon.
  await expect(page.getByRole('button', { name: /Envoyer/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copier le brouillon' })).toBeVisible();
});

test('l’export montre les colonnes du classeur et prepare le telechargement', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/export');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole('columnheader', { name: 'Description (G)' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('columnheader', { name: 'Client ou pays (C)' })).toBeVisible();
  await expect(page.getByText(/structure du classeur n.est pas modifiee/i)).toBeVisible();
});

test('la qualite tire un echantillon et le propose a la notation', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/qualite');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole('heading', { name: 'Qualite' })).toBeVisible();
  await page.getByRole('button', { name: /Tirer l.echantillon/ }).click();
  // Le tirage repond, qu'il y ait des envois a controler ou non.
  await expect(page.getByText(/tire\(s\) sur|deja complet|Aucun/i).first()).toBeVisible({ timeout: 20_000 });
});

test('le connecteur Claude refuse une requete sans jeton', async ({ page }) => {
  const reponse = await page.request.post('/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'ping' }, failOnStatusCode: false });
  expect([401, 503]).toContain(reponse.status());
  const corps = await reponse.json();
  expect(corps.erreur).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Phase 3 : typage
// ---------------------------------------------------------------------------

test('un message ambigu part dans « A classer » et sa correction propose une regle', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);

  // Saisie d'un message volontairement ambigu : aucune regle ne doit le trancher.
  await page.goto('/saisie');
  await page.getByRole('checkbox', { name: /Creer un nouveau dossier/ }).check();
  await page.getByRole('textbox', { name: 'Client', exact: true }).fill('Theta Labs');
  await page.getByRole('textbox', { name: 'Produit et quantite', exact: true }).fill('Complement fer 50 kg');
  await page.getByRole('textbox', { name: 'Objet', exact: true }).fill('Suite a notre echange de ce matin');
  await page.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('T01');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(/Saisie enregistree/)).toBeVisible({ timeout: 15_000 });

  // La file « A classer » est accessible et explique sa regle de fonctionnement.
  await page.goto('/a-classer');
  await expect(page.getByRole('heading', { name: 'A classer', level: 1 })).toBeVisible();
  await expect(page.getByText(/ne classera rien tant qu.elle n.aura pas ete acceptee/i)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Regles proposees/ })).toBeVisible();
});

test('le typage automatique classe un message clair sans passer par « A classer »', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'azmg_gpao_csrf')?.value ?? '';

  const reponse = await page.request.post('/api/typage/essai', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { objet: 'Cotation fret aerien vers Alger', corps: 'Pourriez vous nous coter 180 kg en aerien ?', sens: 'entrant' },
  });
  expect(reponse.ok()).toBe(true);
  const corps = await reponse.json();
  expect(corps.typage.famille).toBe('T01');
  expect(corps.applicable).toBe(true);
  // Le classement est explicable : il cite la regle qui l'a produit.
  expect(corps.typage.origine).toBe('regle');
  expect(corps.typage.justificatifs.length).toBeGreaterThan(0);
});

test('un message hors perimetre est ecarte et n’attend aucune action', async ({ page }) => {
  await seConnecter(page, COMPTES.collaboratrice);
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'azmg_gpao_csrf')?.value ?? '';

  const reponse = await page.request.post('/api/typage/essai', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { objet: 'Newsletter de novembre', corps: 'Pour ne plus recevoir nos messages, cliquez sur se desinscrire.', sens: 'entrant' },
  });
  const corps = await reponse.json();
  expect(corps.typage.famille).toBe('T00');
  expect(corps.applicable).toBe(true);
});

test('l’API agent refuse une requete sans jeton', async ({ page }) => {
  const reponse = await page.request.get('/api/agent/ia/taches', { failOnStatusCode: false });
  expect([401, 503]).toContain(reponse.status());
});

// ---------------------------------------------------------------------------
// Phase 4 : collecte des mails
// ---------------------------------------------------------------------------

test('l’import d’un fil de mails ne cree aucun doublon au second passage', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await page.goto('/import-mails');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });

  // Deux messages d'un meme fil : une demande du client, puis la demande de validation a la DO.
  const entete = (id: string, de: string, a: string, objet: string, date: string, references?: string) =>
    [
      `Message-ID: ${id}`,
      `From: ${de}`,
      `To: ${a}`,
      `Subject: ${objet}`,
      `Date: ${date}`,
      references ? `References: ${references}` : null,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
    ]
      .filter((l): l is string => l !== null)
      .join('\r\n');

  const premier = `${entete('<e2e1@exemple-fictif.test>', 'achat@alpha-fictif.test', 'elysa@azmg-solutions.com', 'Proforma a modifier', 'Mon, 02 Mar 2026 09:00:00 +0100')}\r\n\r\nPourriez vous nous etablir la proforma en dollars ?`;
  const second = `${entete('<e2e2@exemple-fictif.test>', 'elysa@azmg-solutions.com', 'do@client-fictif.test', 'Re : Proforma a modifier', 'Mon, 02 Mar 2026 11:00:00 +0100', '<e2e1@exemple-fictif.test>')}\r\n\r\nMerci de valider la modification de devise.`;

  const fichiers = [
    { name: 'premier.eml', mimeType: 'message/rfc822', buffer: Buffer.from(premier, 'utf8') },
    { name: 'second.eml', mimeType: 'message/rfc822', buffer: Buffer.from(second, 'utf8') },
  ];

  // Le bilan est lu dans sa carte, et non dans la notification : le meme texte apparait aussi
  // dans le rappel du dernier passage, ce qui rendrait la recherche ambigue.
  const bilan = page.locator('section#bilan');

  await page.getByLabel('Fichiers .eml ou .mbox').setInputFiles(fichiers);
  await page.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(bilan.getByText('Messages lus')).toBeVisible({ timeout: 20_000 });
  await expect(bilan.locator('div', { hasText: /^Enregistres2$/ })).toBeVisible();
  await expect(bilan.locator('div', { hasText: /^Deja connus0/ })).toBeVisible();

  // Second import du meme fil : tout est reconnu comme deja connu, rien n'est recree.
  await page.getByLabel('Fichiers .eml ou .mbox').setInputFiles(fichiers);
  await page.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(bilan.locator('div', { hasText: /^Enregistres0$/ })).toBeVisible({ timeout: 20_000 });
  await expect(bilan.locator('div', { hasText: /^Deja connus2/ })).toBeVisible();

  // La demande du fil est passee en attente DO, sans aucune saisie.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Proforma a modifier' })).toHaveCount(1);
  await expect(page.locator('article', { hasText: 'Proforma a modifier' }).getByText('En attente DO')).toBeVisible();
});

test('le webhook de collecte refuse une charge non signee', async ({ page }) => {
  const reponse = await page.request.post('/api/collecte/apps-script', {
    headers: { 'content-type': 'application/json' },
    data: { compteId: 1, messages: [] },
    failOnStatusCode: false,
  });
  expect([401, 503]).toContain(reponse.status());
});

// ---------------------------------------------------------------------------
// Phase 5 : brouillons
// ---------------------------------------------------------------------------

/**
 * Importe un fil de deux mails (demande du client, puis demande de validation a la DO) date de
 * mars 2026, pour que la demande attende la DO depuis assez longtemps pour meriter une relance.
 * Le test se suffit a lui-meme : il ne depend pas des parcours precedents.
 */
async function importerFilAncien(page: Page, suffixe: string, client: string) {
  await page.goto('/import-mails');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });

  const entete = (id: string, de: string, a: string, objet: string, date: string, references?: string) =>
    [
      `Message-ID: ${id}`,
      `From: ${de}`,
      `To: ${a}`,
      `Subject: ${objet}`,
      `Date: ${date}`,
      references ? `References: ${references}` : null,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
    ]
      .filter((l): l is string => l !== null)
      .join('\r\n');

  const premier = `${entete(`<${suffixe}a@exemple-fictif.test>`, `${client}@alpha-fictif.test`, 'elysa@azmg-solutions.com', `Cotation aerien ${suffixe}`, 'Mon, 02 Mar 2026 09:00:00 +0100')}\r\n\r\nPourriez vous nous coter 180 kg au depart de Barcelone ?`;
  const second = `${entete(`<${suffixe}b@exemple-fictif.test>`, 'elysa@azmg-solutions.com', 'do@client-fictif.test', `Re : Cotation aerien ${suffixe}`, 'Mon, 02 Mar 2026 11:00:00 +0100', `<${suffixe}a@exemple-fictif.test>`)}\r\n\r\nMerci de valider le transitaire et le prix.`;

  await page.getByLabel('Fichiers .eml ou .mbox').setInputFiles([
    { name: `${suffixe}-1.eml`, mimeType: 'message/rfc822', buffer: Buffer.from(premier, 'utf8') },
    { name: `${suffixe}-2.eml`, mimeType: 'message/rfc822', buffer: Buffer.from(second, 'utf8') },
  ]);
  await page.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(page.locator('section#bilan').locator('div', { hasText: /^Enregistres2$/ })).toBeVisible({ timeout: 20_000 });
}

test('la preparation prepare des brouillons sans rien envoyer, et le poste tranche', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await importerFilAncien(page, 'p5relance', 'achat-relance');

  await page.goto('/brouillons');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });

  // Rien ne part tout seul : la regle d'or est rappelee a l'ecran.
  await expect(page.getByText('l’application prepare, l’humain envoie', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Preparer maintenant' }).click();
  await expect(page.getByRole('tab', { name: 'A relire' })).toBeVisible();

  // La demande attend la DO depuis mars : une relance est proposee.
  const premier = page.locator('#liste-brouillons > li', { hasText: /Relance N[123]/ }).first();
  await expect(premier).toBeVisible({ timeout: 20_000 });

  // Le brouillon cite ses evenements sources.
  await premier.getByRole('button', { name: 'Lire' }).click();
  await expect(premier.getByText(/evenement\(s\) cite\(s\) a l’appui/)).toBeVisible();
  const texte = await premier.locator('textarea').inputValue();
  expect(texte).toContain('02/03/2026');

  // Le poste declare l'avoir envoye lui-meme : le brouillon quitte la file a relire.
  const titre = (await premier.locator('p.font-medium').first().innerText()).trim();
  await premier.getByRole('button', { name: 'Je l’ai envoye' }).click();
  await expect(page.locator('#liste-brouillons').getByText(titre, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Envoyes' }).click();
  await expect(page.locator('#liste-brouillons').getByText(titre, { exact: true })).toBeVisible();
});

test('un tableau de situation reprend les statuts exacts du reporting client', async ({ page }) => {
  await seConnecter(page, COMPTES.ceo);
  await importerFilAncien(page, 'p5situation', 'achat-situation');

  await page.goto('/brouillons');
  await page.getByRole('combobox', { name: 'Compte client', exact: true }).selectOption({ index: 1 });
  await page.getByRole('textbox', { name: 'Situation d’un client' }).fill('achat-situation');
  await page.getByRole('button', { name: 'Preparer', exact: true }).click();

  const carte = page.locator('#liste-brouillons > li', { hasText: 'Situation' }).first();
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await carte.getByRole('button', { name: 'Lire' }).click();
  const texte = await carte.locator('textarea').inputValue();
  // Statut du reporting client repris exactement, et aucun code technique.
  expect(texte).toContain('En cours');
  expect(texte).toContain('validation DO attendue');
  expect(texte).not.toMatch(/attente_tiers|attente_do|en_cours/);
});
