# CLAUDE.md : AZMG GPAO (pilotage opérationnel des postes placés)

> Ce fichier est à la racine du dépôt. Relis-le au début de chaque session et après chaque compaction de contexte. Il fait foi sur toute autre consigne implicite.

## 0. Rôle et mandat

Tu es développeur senior full-stack, spécialisé dans les outils de GPAO de centres BPO (gestion de flux, files de travail, SLA, contrôle qualité, reporting de production). Tu construis **de bout en bout et en autonomie** l'application AZMG GPAO pour AZMG-Solutions (BPO et SDR-as-a-Service, Antananarivo, Madagascar).

Ton mandat : livrer les phases de la section 10, testées et déployables, **sans attendre de validation humaine entre les étapes**. Le commanditaire (CEO, Jaona) relit le résultat en fin de phase, pas pendant.

Premier périmètre : le compte client **Masenz Group** (laboratoire pharmaceutique, Barcelone) et le poste d'**Elysa**, assistante export / customer support placée par AZMG. Le modèle doit rester générique : d'autres comptes clients et d'autres postes (designer, sales, SDR, comptable dédié) rejoindront la GPAO ensuite, sans refonte.

## 1. Applications de référence (à imiter)

AZMG a déjà deux applications construites avec Claude Code et hébergées sur o2switch. Elles font référence pour la stack, l'architecture, l'auth, la chaîne de déploiement, la charte et le connecteur Claude :

- **AZMG Sourcing** (`jaonarakotoniaina/azmg-sourcing`) : **référence principale**. TypeScript, Express 5, Drizzle + `pg`, React 18 + Vite + TailwindCSS + TanStack Query + lucide-react, zod partagé, Vitest, Playwright, file `jobs_queue` consommée par cron, adaptateurs `real`/`mock`, fournisseur IA `agent` (zéro coût API), connecteur MCP, docs `JOURNAL.md` / `DECISIONS.md` / `A_FOURNIR.md`, déploiement GitHub Actions vers branche `release` puis cron o2switch.
- **CRM interne** (`jaonarakotoniaina/crm-azmg`) : JavaScript, Express, PostgreSQL, React. Sert de second exemple (connecteur MCP, module Pilotage commercial).

Au démarrage, clone les deux dépôts **en lecture seule** dans `/tmp/ref-sourcing` et `/tmp/ref-crm` (même compte GitHub). Lis en priorité dans AZMG Sourcing : `CLAUDE.md`, `docs/DECISIONS.md`, `docs/connecteur-claude.md`, `docs/agent-ia.md`, `src/server/` (structure des modules, `jobs_queue`, `cron.ts`, adaptateurs, module `mcp`, module `auth`), `src/web/theme.ts`, `.github/workflows/`, `scripts/auto-deploy.sh`, `deploy/`. **Reprends ces choix tels quels** sauf raison forte, consignée dans `docs/DECISIONS.md`. Tu ne modifies jamais ces dépôts et tu n'y pousses rien. S'ils sont inaccessibles, applique la stack de la section 5 et consigne-le.

## 2. Mode opératoire autonome (à respecter strictement)

1. **Tu ne poses pas de questions pendant le build.** Face à une ambiguïté, tu choisis l'option la plus standard des GPAO de centres de contacts et back-offices, tu l'appliques et tu la consignes dans `docs/DECISIONS.md` (date, sujet, options, choix, raison, retour arrière).
2. **Seuls motifs d'arrêt** (et même dans ces cas, tu contournes pour continuer ailleurs) : action irréversible sur la production ; dépense ; secret ou accès manquant qui bloque **tout** le travail restant.
3. **Secret manquant = adaptateur simulé, pas un arrêt.** Chaque intégration externe (Gmail, IMAP, webhook Apps Script, SMTP, Claude) passe par une interface à deux implémentations `real` et `mock`. Variable absente : `mock` s'active, l'application fonctionne, le manque va dans `docs/A_FOURNIR.md`.
4. **Boucle par tâche** : planifier, coder, tester, lint + typecheck + tests au vert, commit atomique en français (`feat:`, `fix:`, `chore:`), tâche suivante.
5. **Auto-revue en fin de phase** : relis ton diff comme un reviewer exigeant (sécurité, N+1, erreurs, accessibilité, français, absence de tirets longs), corrige, mets à jour `docs/JOURNAL.md`.
6. **« Terminé » pour une phase** : critères d'acceptation de la section 10 couverts par des tests automatisés (unitaires + parcours Playwright), build de production OK, migrations rejouables sur base vide, `README.md` à jour.
7. Contrainte impossible : alternative la plus proche, tu continues, tu le signales en tête de `docs/DECISIONS.md`.

## 3. Règles de contenu et de confidentialité

- Interface, emails, textes générés, prompts : **français**. Orthographe officielle : **AZMG-Solutions**.
- **Aucun tiret long** (cadratin ni demi-cadratin) dans l'interface, les exports, les emails, les textes générés et les prompts. Test automatisé qui échoue si un tiret long apparaît dans les fichiers de traduction, modèles et prompts ; filtre de post-traitement sur toute sortie de Claude (même mécanisme que AZMG Sourcing).
- Données du client : prix, clients, documents et échanges de Masenz sont confidentiels. Aucune donnée réelle dans le dépôt, les tests ou le seed : jeux de données **fictifs** uniquement.
- **Périmètre strict du poste** : un mail classé hors périmètre (famille T00 : marketing, design, travail de la designer, notifications système, spam) n'apparaît dans aucune vue de pilotage ni aucun export du poste.
- **Remarques internes** (règle révisée le 13/11/2026, sur décision du commanditaire). La version initiale interdisait d'extraire, de stocker ou d'exporter les appréciations et reproches du client envers le collaborateur. Le commanditaire a décidé d'importer tel quel le classeur de suivi managérial, qui en contient : la GPAO les porte donc désormais, dans les notes de la demande, à côté de l'action qui débloque.
  - Ce qui reste vrai : **l'objet d'une demande est toujours l'action qui débloque**, jamais le reproche. Le pilotage, les indicateurs, le digest DO et les exports du poste travaillent sur l'objet, le statut et les délais. Une appréciation n'est ni une famille, ni un indicateur, ni une ligne d'export.
  - Ce qui change : la colonne « Demande ou réclamation » du classeur de suivi est reprise dans `demandes.notes`, lisible par le collaborateur concerné, son manager et l'administrateur.
  - À garder en tête : ces textes concernent des personnes nommées. Toute nouvelle vue, tout nouvel export et toute tâche IA qui lirait ces notes doit être décidée explicitement, pas héritée par défaut.
- Statuts de reporting client, repris **exactement** : `Terminé`, `En attente client`, `En cours`, `Bloqué`, `Annulé`.

## 4. Contexte métier

### 4.1 Le compte et le poste

- Client : Masenz Group (export de compléments alimentaires et produits pharmaceutiques, clients en Algérie, Libye, Moyen-Orient, Asie, Europe). Donneuse d'ordre et seule autorité de validation : la responsable export (« DO »).
- Poste : assistante export / customer support. Consignes reçues par mail, WhatsApp et vocaux WhatsApp. Environ la moitié des messages du poste partent vers la DO pour validation.
- Côté AZMG : un manager (Princy) pilote le compte ; le CEO lit les synthèses.
- Une boîte Gmail de suivi reçoit une copie des mails du poste (envoyés et reçus). **Sa synchronisation est faite plus tard** (phase 4) : l'application doit d'abord vivre avec la saisie rapide et l'import.

### 4.2 Unité de travail

L'unité de travail n'est pas le mail mais la **demande**, rattachée à un **dossier**. Le mail (ou la consigne WhatsApp saisie) est un **événement** qui crée, fait avancer ou clôt une demande.

- **Dossier** : client × produit × opération (ex. « LAM (Algérie) / Gélules 272 kg / aérien vers Alger »). Porte les références (facture, BL, AWB, PFI), les échéances, les montants approuvés, l'historique.
- **Demande** : un travail à faire dans un dossier, d'une famille donnée, avec un statut, des horodatages et un acteur attendu.
- **Événement** : mail entrant ou sortant, consigne saisie, changement de statut, note. Chaque événement est horodaté et rattaché.

### 4.3 Typage (référentiel initial, modifiable dans Paramètres)

Quatre axes par événement : **sens** (entrant, sortant, interne), **famille**, **nature**, **interlocuteur**.

Familles (issues de l'audit du poste, 999 fils analysés) :

| Code | Famille | Validation humaine existante |
|---|---|---|
| T00 | Hors périmètre (marketing, design, système, spam) | exclu du pilotage |
| T01 | Cotations fret et relances transitaires (FCL, LCL, aérien) | DO valide transitaire, prix, booking |
| T02 | Enlèvements, transport local, documents d'expédition (BL, PL, AWB, shipping marks) | client valide ; DO pour exceptions |
| T03 | Proformas, factures, modifications, pré-domiciliation | DO valide chaque modification |
| T04 | Relances clients, paiements, SWIFT, soldes, pièces manquantes | aucune |
| T05 | Réglementaire : enregistrement pays, FSC, GMP, COC, légalisation | DO et autorité du pays |
| T06 | Tableaux de situation par client ou pays | DO |
| T07 | COA, BAT, étiquettes, échantillons avec la Qualité | Qualité, client |
| T08 | Leads, catalogue, offres, Clientify | DO pour prix et MOQ |
| T09 | Reporting quotidien | DO lit |
| T10 | Stagiaires : onboarding, instructions, évaluations | DO |
| T11 | Salons : accès, rendez-vous, saisie de contacts | DO |
| T12 | Lettres d'invitation et courriers types | signature DO |
| T13 | Transferts à la DO pour décision | DO |
| T14 | Tracking, transporteurs express, surestaries | aucune |

Natures et effet sur la demande :

| Nature | Sens | Effet |
|---|---|---|
| Demande entrante | entrant | crée une demande (Nouveau) |
| Consigne de la DO | entrant | crée ou réoriente une demande |
| Envoi de livrable | sortant | passe en attente du destinataire |
| Demande de validation à la DO | sortant | passe en attente DO, chrono validation |
| Validation ou refus de la DO | entrant | repasse en cours, ou terminé |
| Relance émise | sortant | incrémente le niveau de relance (N1, N2, N3) |
| Relance reçue | entrant | alerte délai dépassé côté poste |
| Réponse du tiers | entrant | repasse en cours |
| Information, accusé, notification | tous | aucun changement, tracé |

Interlocuteurs : client, prospect, transitaire, transporteur, Qualité, fournisseur, autorité ou chambre, DO, stagiaire, interne AZMG.

### 4.4 Statuts détaillés et correspondance reporting

| Statut GPAO | Statut reporting client |
|---|---|
| Nouveau | En cours |
| En cours | En cours |
| En attente client / tiers (transitaire, fournisseur, autorité) | En attente client |
| En attente DO | En cours (marqué « validation DO attendue ») |
| Bloqué | Bloqué |
| Terminé | Terminé |
| Annulé | Annulé |

Chaque transition est horodatée avec son auteur. Le temps passé dans chaque statut est calculé, par acteur (poste, DO, client, tiers).

## 5. Contraintes techniques (non négociables)

- **Stack identique à AZMG Sourcing** : TypeScript partout, Express 5, Drizzle ORM + `pg`, React 18 + Vite + TailwindCSS + TanStack Query + lucide-react, composants maison accessibles, zod partagé front/back, Vitest, Playwright.
- **Base** : PostgreSQL sur le même serveur o2switch que le CRM et Sourcing, base séparée `azmg_gpao`. **Compatible PostgreSQL 9.6** (version o2switch) : pas de `gen_random_uuid`, pas de colonnes d'identité, pas de `MERGE`, identifiants `bigserial`. La CI teste sur 9.6. En développement : PostgreSQL local de la VM, bases `azmg_gpao_dev` et `azmg_gpao_test`.
- **Hébergement o2switch** (mutualisé cPanel) : application Node via Phusion Passenger, pas de Docker, pas de processus permanent. Asynchrone : table `jobs_queue` + cron cPanel idempotent (verrou consultatif, reprise, backoff), comme Sourcing.
- **Domaine** : `gpao.intranet.azmg-solutions.com`.
- **Authentification** : même modèle que Sourcing (email + mot de passe argon2id, sessions en base, cookie httpOnly, CSRF double jeton). Rôles : `admin` (CEO), `manager` (pilote de compte : tout sur ses comptes), `collaborateur` (sa file, ses dossiers, saisie et correction), `client_lecture` (prévu, désactivé par défaut : tableau de bord en lecture seule pour la DO).
- **Charte** : reprendre `src/web/theme.ts` et `tailwind.config.ts` de Sourcing (charte AZMG-Solutions : fond `#FAF8F5`, texte `#1A1626`, violet `#8B25CF`, dégradé vers `#0F66BD`, Fraunces titres, Inter interface). Charte de référence : https://docs.google.com/document/d/11DWCJgKq7l_QzJxftDzUd7EGdrOAPBYjwTMsR6VlBio/edit
- **Fuseaux** : stockage UTC ; affichage Antananarivo ; calculs de délais en **heures ouvrées du client** (Barcelone, lundi au vendredi, horaires paramétrables) avec calendrier des fériés paramétrable (règle du compte : fériés communs Espagne et Madagascar non travaillés, fériés propres à l'Espagne non travaillés, fériés propres à Madagascar travaillés).
- Secrets dans `.env` hors dossier public, `.env.example` exhaustif. Fichiers stockés hors du dossier public, servis par route authentifiée.

### 5 bis. Environnement Claude Code cloud et déploiement

Reprends à l'identique la section 5 bis du CLAUDE.md de Sourcing :
- Branche de travail imposée par la session ; **commit et push après chaque tâche** (jamais plus de 30 min non poussées). À chaque reprise : lire `CLAUDE.md`, `docs/JOURNAL.md`, `git log -20`, reprendre à la première tâche non terminée.
- Fin de phase : pull request vers `main` avec le résumé ; tu enchaînes sans attendre la fusion.
- **Fusion autonome** (accord du commanditaire, 12/11/2026, rappelé le 13/11) : tu fusionnes
  toi-même tes pull requests vers `main`, sans attendre de validation. **Tu ne demandes pas
  l'autorisation de fusionner, ni une confirmation avant de déployer : l'accord est donné une fois
  pour toutes.** Tu annonces ce que tu as fusionné et déployé, tu ne le proposes pas. Deux garde-fous que tu gardes : jamais sur une
  CI rouge ou incomplète (tu attends la fin des vérifications), et aucune réécriture d'historique
  partagé (pas de `push --force`, pas de rebase d'une branche déjà poussée). Après chaque fusion,
  tu suis la chaîne de déploiement et tu vérifies `/health` : version servie et `migrations.aJour`.
- Aucun secret de production dans la session ; tout en `mock`.
- Déploiement : GitHub Actions sur `main` (lint, typecheck, tests sur PostgreSQL 9.6, build) vers branche `release` ; cron o2switch `scripts/auto-deploy.sh` toutes les 5 min (fetch HTTPS jeton lecture seule, nouveau dossier de version, sauvegarde base, migrations, redémarrage Passenger, contrôle `/health`, retour arrière automatique et email d'alerte en cas d'échec). `README.md` décrit la mise en place initiale unique sur o2switch.

## 6. IA intégrée (zéro coût API)

Même architecture que Sourcing (section 6 et 6.1 de son CLAUDE.md) : interface `AiProvider` avec `agent` (défaut production : table `ai_tasks` traitée par une routine Claude Code via `GET /api/agent/ia/taches` et `POST /api/agent/ia/taches/:id/resultat`, sortie validée par zod, 3 essais puis Exceptions), `api` (si clé fournie, plafond de budget) et `mock` (tests). Prompts versionnés en français dans `src/server/ai/prompts/`, un par tâche. Rédige `docs/agent-ia.md` : l'instruction prête à coller dans la routine.

Tâches IA minimales :
- `typer_evenement` : famille, nature, interlocuteur, dossier probable, indice de confiance (0 à 1), extraits justificatifs. Sous le seuil (0,8 par défaut) : file « À classer ».
- `extraire_elements` : références (BL, AWB, facture, PFI), montants, dates clés (cut-off, ETD, ETA, validité, expiration) avec la phrase source. **Jamais de donnée inventée** : champ absent = vide.
- `resumer_dossier` : état du dossier en une ligne orientée résultat (« où en est le dossier », pas « ce qui a été fait »), avec statut parmi la liste exacte.
- `rediger_relance` : brouillon N1, N2 ou N3 dans la langue de l'interlocuteur (FR, EN, ES).
- `rediger_digest_validation` : liste des décisions attendues de la DO, une ligne par décision, avec les éléments nécessaires (prix, dates, options).
- `rediger_daily` : reporting quotidien (section 9).

Règle d'or : l'IA prépare, l'humain envoie. **Aucun mail ne part automatiquement vers un client, un transitaire ou la DO** ; tout est brouillon ou export.

## 7. Modèle de données (minimum)

`comptes_clients`, `postes` (compte, collaborateur, intitulé), `utilisateurs`, `dossiers` (compte, client, pays, produit, opération, références, statut, échéances, valeurs approuvées), `demandes` (dossier, famille, origine, statut, acteur attendu, priorité, échéance, SLA cible, niveau de relance, horodatages), `evenements` (demande, dossier, sens, famille, nature, interlocuteur, source `mail` | `whatsapp` | `vocal` | `saisie` | `import`, identifiant de fil et de message, horodatage d'origine, résumé, confiance du typage, corrigé_par), `transitions_statut`, `echeances` (type : cut-off, ETD, ETA, validité d'offre, expiration document, créneau entrepôt), `pieces` (type, référence, chemin, archivé), `checklists` et `controles_envoi`, `grilles_qualite`, `controles_qualite`, `regles_typage` (domaine, mots-clés, libellé, priorité), `referentiels` (familles, natures, statuts, interlocuteurs, SLA), `jobs_queue`, `ai_tasks`, `journal_actions`, `parametres`.

## 8. Fonctionnalités

1. **Saisie rapide** (30 secondes, mobile) : consigne reçue par WhatsApp ou vocal, nouvelle demande, note. Rattachement au dossier par recherche ; création de dossier à la volée.
2. **File du jour du collaborateur** : demandes ouvertes triées par échéance, risque et ancienneté ; filtres par famille et par acteur attendu ; actions rapides (changer de statut, relancer, demander validation DO).
3. **Fiche dossier** : chronologie complète (événements, pièces, décisions, prix approuvés), échéances, demandes, état en une ligne.
4. **Gestion de flux** : entrées, sorties, stock et âge du stock par jour et par famille.
5. **Temps de traitement** : délai de première réponse, délai total, temps d'attente par acteur, en heures ouvrées.
6. **Contrôle qualité** : grille paramétrable par famille ; échantillon hebdomadaire tiré automatiquement (10 % des envois par défaut) ; note, taux de reprise, « bon du premier coup » (document validé par la DO sans correction).
7. **Échéancier et alertes** : cut-off, ETD, validités d'offre, expirations (COI, FSC, GMP), créneaux d'entrepôt ; alerte J-2 et J0 dans la file.
8. **Check-list avant envoi** par type d'envoi (exemples initiaux : facture et packing list toujours ensemble ; NIF du client sur AWB et BL ; validation du client avant émission d'un original ; photo du shipping mark avant départ ; scan du BL joint ; pièces archivées dans le dossier serveur). Un envoi est déclaré conforme ou non ; les non-conformités alimentent la qualité.
9. **Digest de validation DO** : brouillon deux fois par jour regroupant toutes les décisions attendues, avec le temps d'attente de chacune.
10. **Tableau de bord** manager et CEO : flux, stock, délais, SLA, qualité, charge estimée (volume × temps standard par famille), comparaison semaine précédente.
11. **Reporting** : export du daily et du suivi mensuel (section 9).
12. **Paramètres** : référentiels, règles de typage, SLA, horaires et fériés, grilles qualité, check-lists, modes d'automatisation (`auto`, `brouillon`, `manuel`) avec interrupteur général.
13. **Connecteur Claude (MCP)** sur le modèle de Sourcing (`docs/connecteur-claude.md`) : `file_du_jour`, `chercher_dossier`, `fiche_dossier`, `creer_demande`, `ajouter_evenement`, `changer_statut`, `echeances_a_venir`, `indicateurs`, `a_classer`, `corriger_typage`, `exporter_reporting`. Les outils d'écriture laissent une trace « Claude » dans le journal.

## 9. Reporting au format existant

Le reporting actuel est un classeur Excel `SUIVI_MENSUEL_MASENZ_JJ-MM.xlsx` (onglets « Suivi Quotidien », « sem N », « Recap Mensuelle »). L'export doit **écrire dans un classeur existant fourni en entrée sans en modifier la structure** (colonnes, en-têtes, noms d'onglets, mise en forme, formules) :
- Suivi Quotidien : un bloc par jour (ligne vide, ligne d'en-tête recopiée, lignes de données) ; date en texte `JJ/MM/AAAA` (colonne A) ; client ou pays (C) ; produit et référence (F) ; description numérotée orientée résultat terminée par « : Statut » (G) ; livrables finalisés (H) ; priorité du lendemain (I) ; colonnes B, D, E vides.
- Onglet « sem N » (N = semaine ISO moins 26 en 2026, vérifier la plage de dates de l'en-tête) : colonnes B à F = lundi à vendredi ; ligne 4 nouveaux leads ; lignes 5, 6, 7, 12, 14 KPI numériques ; lignes 8 à 11 laissées vides ; lignes 13, 15, 16, 17 synthèses texte ; ligne 18 points bloquants. Aucune référence (BL, commande, booking) dans les onglets « sem ».
- Un même dossier dans la journée = une seule ligne au dernier état connu.
Fournis un classeur fictif de test reproduisant cette structure.

## 10. Phases et critères d'acceptation

**Phase 1 : socle et saisie** (sans mails)
- Auth et rôles ; comptes, postes, référentiels de la section 4 pré-remplis ; dossiers, demandes, événements, transitions horodatées.
- Saisie rapide, file du jour, fiche dossier, changement de statut, recherche.
- Import initial des dossiers depuis un classeur au format de la section 9 (lecture de « Suivi Quotidien » : client, produit, dernier statut par dossier).
- Critères : créer un dossier et une demande en moins de 30 s au clavier ; chaque transition est horodatée ; le temps par statut est juste sur un jeu de test incluant week-end et férié ; l'import d'un classeur fictif crée les dossiers sans doublon.

**Phase 2 : pilotage**
- Tableau de bord (flux, stock, âge, délais, attente par acteur, SLA), échéancier et alertes, check-lists avant envoi, contrôle qualité avec échantillonnage, digest DO (brouillon), export reporting section 9, connecteur MCP.
- Critères : indicateurs recalculés sur jeu fictif conformes aux attendus ; export écrit dans une copie du classeur fictif sans altérer sa structure (test de comparaison des styles et formules) ; test « aucun tiret long » ; outils MCP testés.

**Phase 3 : typage**
- Moteur de règles (domaines, mots de l'objet, libellés) puis tâche IA `typer_evenement` ; file « À classer » ; chaque correction manuelle propose une nouvelle règle ; T00 exclu partout.
- Critères : sur un jeu de 60 mails fictifs annotés, au moins 85 % bien classés en famille et nature ; un mail T00 n'apparaît dans aucune vue ni export ; aucune remarque interne extraite.

**Phase 4 : synchronisation des mails** (à activer plus tard)
- Adaptateur `collecte_mail` avec trois implémentations : `apps_script` (webhook signé appelé par un script Google Apps Script installé sur la boîte de suivi, que tu rédiges dans `docs/apps-script.md`), `imap`, `mock`. Import ponctuel de fichiers `.eml` ou `.mbox` pour l'historique.
- Dédoublonnage par identifiant de message ; rattachement au fil ; horodatage d'origine conservé ; pièces jointes référencées, stockées hors public.
- Critères : un fil importé deux fois ne crée aucun doublon ; un mail sortant de demande de validation fait passer la demande en « En attente DO » ; la réponse de la DO la fait repasser en cours.

**Phase 5 : automatisations du poste** (toutes en brouillon)
- Relances N1, N2, N3 préparées chaque matin selon les délais d'attente ; daily et onglet « sem » pré-remplis ; tableaux de situation par client ; tableau comparatif de cotations fret (prix, cut-off, ETD, ETA, transit, validité) depuis les offres reçues.
- Critères : aucune action sortante sans validation humaine ; chaque brouillon cite les événements sources.

## 11. Livrables documentaires

`README.md` (installation locale, mise en place o2switch pas à pas, ligne cron exacte), `docs/JOURNAL.md`, `docs/DECISIONS.md`, `docs/A_FOURNIR.md`, `docs/agent-ia.md`, `docs/connecteur-claude.md`, `docs/apps-script.md` (phase 4), `docs/guide-utilisateur.md` (une page par rôle, en français simple).
