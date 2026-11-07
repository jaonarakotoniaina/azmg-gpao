# Journal de bord

Tenu a jour a chaque push. A toute reprise de session : lire `CLAUDE.md`, puis ce fichier,
puis `git log -20`, et reprendre a la premiere tache non terminee.

## Plan des phases

### Phase 1 : socle et saisie (terminee)

- [x] 1.1 Depots de reference clones en lecture seule, stack et conventions reprises de AZMG Sourcing
- [x] 1.2 Projet initialise : TypeScript, Express 5, Drizzle, React, Vite, Tailwind, Vitest, Playwright
- [x] 1.3 Referentiels de la section 4 (familles T00 a T14, natures, statuts, interlocuteurs, sources, echeances)
- [x] 1.4 Moteur de delais en heures ouvrees du client, avec calendriers de feries parametrables
- [x] 1.5 Schema de base complet, migration compatible PostgreSQL 9.6
- [x] 1.6 File `jobs_queue` et cron « tick » idempotent avec verrou consultatif
- [x] 1.7 Auth, roles et perimetre de visibilite
- [x] 1.8 Dossiers, demandes, evenements, transitions horodatees, temps par statut et par acteur
- [x] 1.9 Saisie rapide en un appel, file du jour, recherche de dossiers
- [x] 1.10 Import du classeur de suivi (onglet « Suivi Quotidien »), rejouable sans doublon
- [x] 1.11 Seed de demonstration fictif
- [x] 1.12 Interface React : connexion, file du jour, saisie rapide, fiche dossier, parametres
- [x] 1.13 Tests unitaires et d'integration, parcours Playwright
- [x] 1.14 Chaine de release GitHub Actions et script de deploiement o2switch
- [x] 1.15 README, guide utilisateur, auto-revue de fin de phase

**Phase 1 terminee.**

### Phase 2 : pilotage (en cours)

Pull request de la phase 1 : https://github.com/jaonarakotoniaina/azmg-gpao/pull/1
(la phase 2 enchaine sur la meme branche, sans attendre la fusion).

- [ ] 2.1 Indicateurs : flux (entrees, sorties), stock et age du stock, delais, attente par acteur, SLA, charge estimee
- [ ] 2.2 Tableau de bord manager et CEO, avec comparaison a la semaine precedente
- [ ] 2.3 Check-lists avant envoi et declaration de conformite
- [ ] 2.4 Controle qualite : grilles, echantillon hebdomadaire, note, taux de reprise, bon du premier coup
- [ ] 2.5 Digest de validation DO, deux fois par jour, en brouillon
- [ ] 2.6 Export du reporting de la section 9 dans un classeur existant, sans en modifier la structure
- [ ] 2.7 Connecteur Claude (MCP) et ses onze outils
- [ ] 2.8 Auto-revue, journal, mise a jour de la pull request

### Phase 3 : typage (a venir)

Moteur de regles puis tache IA `typer_evenement`, file « A classer », proposition de regle a
chaque correction manuelle, T00 exclu partout.

### Phase 4 : synchronisation des mails (a venir)

Adaptateur `collecte_mail` en trois implementations (`apps_script`, `imap`, `mock`), import de
fichiers `.eml` et `.mbox`, dedoublonnage par identifiant de message.

### Phase 5 : automatisations du poste (a venir)

Relances N1, N2, N3 preparees chaque matin, daily et onglet « sem » pre-remplis, tableaux de
situation par client, comparatif de cotations fret. Tout en brouillon.

---

## 2026-11-07 : socle serveur

**Fait**

Lecture integrale de `CLAUDE.md`, puis des depots de reference `azmg-sourcing` (reference
principale) et `crm-azmg`, clones en lecture seule. Stack, conventions, auth, chaine de
deploiement et charte reprises de Sourcing ; les ecarts sont consignes dans `docs/DECISIONS.md`.

Socle livre :

- **Referentiels** (`src/shared/constantes.ts`) : les 15 familles de l'audit du poste avec leur
  validation humaine, leur temps standard et leur SLA cible ; les 10 natures avec leur sens
  compatible et leur effet ; les 7 statuts avec leur correspondance exacte vers les 5 statuts de
  reporting client ; interlocuteurs, sources, types d'echeance. Copies en base au premier
  `migrate` (53 entrees), modifiables ensuite sans redeploiement.
- **Heures ouvrees** (`src/shared/heures-ouvrees.ts`) : `minutesOuvrees`, `ajouterHeuresOuvrees`,
  plages multiples par jour, calendriers de feries Espagne et Madagascar calcules (Paques par
  l'algorithme de Meeus), et la regle du compte Masenz (feries espagnols chomes, feries malgaches
  travailles) exprimee en donnee et non en code.
- **Schema** (23 tables) : comptes clients, postes, dossiers, demandes, evenements,
  transitions de statut, echeances, pieces, check-lists, controles d'envoi, grilles et controles
  qualite, regles de typage, referentiels, `jobs_queue`, `cron_runs`, `ai_tasks`,
  journal d'actions, imports. Migration verifiee sans construction posterieure a PostgreSQL 9.6.
- **Cycle de vie de la demande** : chaque transition ecrit une ligne horodatee et signee
  (humain, systeme ou Claude), et cumule les minutes ouvrees du statut quitte dans les compteurs
  de la demande. Un statut ferme arrete le chrono.
- **Effets des natures** : `effetNature` traduit le tableau de la section 4.3. Un envoi de
  livrable passe en attente du destinataire, une demande de validation en attente DO, une
  validation ou une reponse de tiers ramene la demande au poste, une relance emise incremente
  N1, N2, N3.
- **Perimetre** : T00 est trace mais exclu des demandes, de la file, de la chronologie et des
  exports ; la visibilite est bornee par role (admin, manager, collaborateur, client_lecture).
- **Saisie rapide** : `POST /api/saisie/rapide` cree le dossier manquant, ouvre la demande et
  enregistre l'evenement en un aller-retour.
- **Import du classeur** : lecteur xlsx maison (ZIP sur `node:zlib` plus lecture XML ciblee),
  onglet « Suivi Quotidien », blocs par jour, statut extrait de la fin de la description,
  dernier etat connu par dossier, rapprochement sur cle normalisee donc rejouable sans doublon.
- **Seed fictif** : 1 compte, 1 poste, 5 dossiers, 6 demandes, 22 evenements, 5 echeances, dont
  un evenement T00 pour verifier son exclusion. Aucune donnee reelle.

**Verifie a la main sur la base de developpement**

Le seed produit des compteurs de temps coherents avec le calendrier reel : sur la demande T01,
l'attente tiers du dimanche 1er novembre (a la fois dimanche et ferie espagnol) au mardi 3 compte
600 minutes ouvrees (540 pour le lundi plus 60 pour le mardi matin) et non 1080, ce qui valide le
traitement des week-ends et des feries du client.

**Reste**

Interface React, tests automatises, chaine de release, README et guide utilisateur.

**Dettes techniques**

- Le filtrage du perimetre sur la file du jour se fait en deux temps (requete puis filtre en
  memoire). A reecrire en une seule requete avec jointure sur les postes de l'utilisateur quand
  les volumes le justifieront.
- `tempsDemande` fait une requete par demande pour retrouver le debut du statut courant. La file
  du jour utilise deja une version en lot (`tempsDemandeAvecHoraires`) ; la fiche dossier devra
  suivre si un dossier porte beaucoup de demandes.

---

## 2026-11-07 : interface, tests, deploiement, fin de la phase 1

**Fait**

- **Interface React** (charte AZMG-Solutions reprise de Sourcing, `theme.ts` et `tailwind.config.ts`
  a l'identique) : connexion, mot de passe oublie et reinitialisation ; file du jour avec quatre
  indicateurs, cinq filtres et une action rapide de changement de statut par carte ; saisie rapide
  en un ecran utilisable au telephone ; liste des dossiers ; fiche dossier avec chronologie fusionnee
  (evenements, transitions, echeances, pieces), demandes et echeances ; fiche demande avec temps par
  statut et par acteur ; echeancier avec alerte a deux jours ; import de classeur ; parametres en
  quatre onglets.
- **Tests** : 118 tests Vitest et 6 parcours Playwright sur le build de production.
- **Chaine de deploiement** : `release.yml` (lint, typecheck, tests sur `postgres:9.6`, build,
  Playwright, publication sur la branche `release`), `verification.yml` pour les branches et les
  pull requests, `auto-deploy.sh`, `sauvegarde.sh` et `restauration.sh` adaptes depuis Sourcing.
- **Documentation** : `README.md` (installation locale, mise en place o2switch en dix etapes,
  lignes de cron exactes, sauvegarde et restauration, modes simules) et `docs/guide-utilisateur.md`
  (une page par role, en francais simple).

**Verifications de fin de phase**

| Critere de la section 10 | Verification |
|---|---|
| Creer un dossier et une demande en moins de 30 s au clavier | parcours Playwright qui chronometre la saisie |
| Chaque transition est horodatee | test d'integration sur `transitions_statut` et parcours Playwright |
| Temps par statut juste, week-end et ferie inclus | 22 tests sur le moteur d'heures ouvrees, plus 3 tests de cumul |
| Import d'un classeur fictif sans doublon | 27 tests d'import, dont le double import, plus un parcours Playwright |
| Aucun tiret long | test qui balaie l'interface, les referentiels, les scripts, la documentation et le classeur |
| Migrations rejouables sur base vide | verifie a la main sur une base neuve, puis rejouees : 0 entree ajoutee au second passage |
| Build de production | `npm run build` vert, parcours Playwright executes sur ce build |

**Auto-revue : ce qui a ete corrige**

1. **Requete N+1 sur la fiche dossier.** Chaque demande declenchait deux requetes pour retrouver
   le debut de son statut courant. Ajout de `tempsDesDemandes`, qui lit tous les debuts en une
   requete groupee et les horaires une fois par compte.
2. **Collision de cle de dossier.** Renommer un dossier pouvait violer l'index unique et remonter
   une erreur 500. La collision est detectee et renvoie un 409 qui nomme le dossier en conflit.
3. **Accessibilite des onglets.** Les onglets n'etaient pas relies a leur contenu. Ajout de
   `aria-controls`, `aria-labelledby`, de la gestion du `tabIndex` et d'un composant `Panneau`
   portant `role="tabpanel"`.
4. **Libelles bruts dans l'interface.** La chronologie affichait `en_cours vers attente_do` et
   `cut_off`, la saisie rapide affichait `whatsapp` et `entrant`. Tout passe desormais par les
   libelles du referentiel.
5. **Grammaire.** « en attente de le poste » devenu « en attente du poste » (forme contractee
   `complementActeur`).
6. **Rattachement au poste.** Un dossier cree en saisie rapide n'etait rattache a aucun poste : la
   demande disparaissait de la file du jour de la personne qui venait de la saisir.
7. **Doublon a l'import.** Le classeur ecrit « Client (Pays) » dans une seule colonne et ne porte
   pas l'operation : l'import creait un second dossier a cote de celui ouvert par le poste. Il
   separe maintenant le client du pays et rapproche sur client et produit.
8. **Couverture du test « aucun tiret long »** etendue aux scripts, a `deploy/`, a `docs/` et au
   `README.md`, puisque le message d'alerte de deploiement part par email.

**Reste a faire (phases suivantes)**

Phase 2 (pilotage) : tableau de bord, echeancier complet avec alertes dans la file, check-lists
avant envoi, controle qualite avec echantillonnage, digest DO, export du reporting de la section 9
dans un classeur existant sans en modifier la structure, connecteur MCP. Le lecteur et l'ecrivain
ZIP necessaires a cet export sont deja en place et testes.

**Dettes techniques**

- Le filtrage du perimetre sur la file du jour se fait en deux temps (requete large puis filtre par
  identifiants). A fusionner en une seule requete avec jointure sur les postes quand les volumes
  le justifieront.
- Les plages horaires et les calendriers de feries se modifient par l'API des parametres ou en
  base, pas encore dans l'ecran Parametres, qui les affiche en lecture seule.
- `src/server/modules/index.ts` ne declare qu'un gestionnaire de file de demonstration (`ping`) :
  les vrais traitements asynchrones arrivent en phase 2.
- Aucune route de telechargement de piece : la table `pieces` existe et est affichee, mais le
  stockage de fichiers sera branche avec la collecte des mails en phase 4.
