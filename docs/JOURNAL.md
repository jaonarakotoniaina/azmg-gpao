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

### Phase 2 : pilotage (terminee)

Pull request de la phase 1 : https://github.com/jaonarakotoniaina/azmg-gpao/pull/1
(la phase 2 enchaine sur la meme branche, sans attendre la fusion).

- [x] 2.1 Indicateurs : flux (entrees, sorties), stock et age du stock, delais, attente par acteur, SLA, charge estimee
- [x] 2.2 Tableau de bord manager et CEO, avec comparaison a la periode precedente
- [x] 2.3 Check-lists avant envoi et declaration de conformite
- [x] 2.4 Controle qualite : grilles, echantillon hebdomadaire, note, taux de reprise, bon du premier coup
- [x] 2.5 Digest de validation DO, en brouillon
- [x] 2.6 Export du reporting de la section 9 dans un classeur existant, sans en modifier la structure
- [x] 2.7 Connecteur Claude (MCP) et ses onze outils
- [x] 2.8 Auto-revue, journal, mise a jour de la pull request

**Phase 2 terminee.**

### Phase 3 : typage (terminee)

- [x] 3.1 Fournisseur IA interchangeable (`agent`, `api`, `mock`), table `ai_tasks`, API agent
- [x] 3.2 Moteur de regles de typage (domaine, mots de l'objet, libelles) et referentiel initial
- [x] 3.3 Service de typage : regles d'abord, IA ensuite, file « A classer » sous le seuil
- [x] 3.4 Proposition d'une nouvelle regle a chaque correction manuelle
- [x] 3.5 Jeu d'evaluation de 60 mails fictifs annotes, jeu temoin et script de mesure
- [x] 3.6 Ecran « A classer »
- [x] 3.7 Auto-revue, journal, mise a jour de la pull request

**Phase 3 terminee.**

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

---

## 2026-11-07 : pilotage, qualite, export et connecteur (phase 2)

**Fait**

- **Indicateurs** (`src/server/modules/indicateurs/service.ts`) : flux (entrees, sorties, detail par
  jour et par famille), stock (par statut, famille et acteur, age moyen et median, tranches d'age,
  cible depassee, charge estimee), delais (premiere reponse, delai total, attente par acteur,
  respect de la cible, detail par famille), charge estimee. Tout en minutes ouvrees du client.
- **Tableau de bord** : les quatre familles de mesures, la comparaison a la periode precedente de
  meme duree, les attentes DO trop longues et les echeances proches. Le sens de lecture est
  explicite : un delai qui baisse s'affiche en vert, un volume qui monte reste neutre, parce qu'une
  hausse d'activite n'est en soi ni bonne ni mauvaise.
- **Check-lists avant envoi** : conformite calculee sur les seuls points obligatoires, un point
  facultatif non coche ne rend pas l'envoi non conforme. Les non-conformites alimentent la qualite,
  ce qui evite une double saisie.
- **Controle qualite** : grille ponderee, echantillon hebdomadaire idempotent, note sur 100 par
  moyenne ponderee, taux de reprise, bon du premier coup, et les points de check-list les plus
  souvent manques, pour cibler la correction.
- **Digest de validation DO** : une ligne par decision, le temps d'attente en heures ouvrees, les
  elements de decision repris du dossier (references, montants approuves, echeances) sans rien
  inventer, et un brouillon filtre des tirets longs. Aucun envoi.
- **Export du reporting** : ecrit dans le classeur fourni par l'utilisateur, a la suite de ce qu'il
  contient. Blocs de jour au format de la section 9, onglet hebdomadaire (lignes 8 a 11 laissees
  intactes, aucune reference dans les syntheses).
- **Connecteur Claude (MCP)** : les onze outils de la section 8.13, protocole JSON-RPC, cle en
  en-tete fixe, journal des appels dans `/health` sans jamais la cle.
- **Documentation** : `docs/connecteur-claude.md` (installation, garde-fous, diagnostic, exemples)
  et `docs/agent-ia.md` (instruction prete a coller dans la routine).

**L'export preserve vraiment la structure**

C'est le point le plus delicat de la phase. Plutot que de reconstruire le classeur, l'ecriture est
chirurgicale (`src/server/lib/xlsx/ecriture.ts`) : seules la feuille modifiee et la table des
chaines partagees sont reecrites, tout le reste est recopie octet pour octet. Dans la feuille, une
cellule existante garde son attribut de style, une cellule qui porte une formule est refusee a
l'ecriture, et les nouvelles lignes reprennent les styles d'une ligne modele.

Verifie de deux facons :

- par les tests, qui comparent les entrees de l'archive avant et apres (seules `sheet1.xml` et
  `sharedStrings.xml` changent), verifient que chaque ligne d'origine se retrouve telle quelle, et
  que la formule `SUM(B5:F5)` de l'onglet voisin est intacte ;
- a la main avec **openpyxl**, une bibliotheque independante : onglets, cellules fusionnees,
  largeurs de colonne, remplissage de l'en-tete, graisse, bordures, format de date et formule sont
  tous conserves, et les lignes ajoutees heritent bien des styles du modele.

**Verifications de fin de phase**

| Critere de la section 10 | Verification |
|---|---|
| Indicateurs recalcules sur jeu fictif conformes aux attendus | 19 tests sur une semaine sans ferie, valeurs calculees a la main |
| Export sans alteration de la structure (styles et formules) | 26 tests, dont la comparaison octet pour octet, plus un controle openpyxl |
| Test « aucun tiret long » | etendu au classeur de test, aux brouillons et aux syntheses hebdomadaires |
| Outils MCP testes | 31 tests : protocole, authentification, les onze outils, garde-fous |

217 tests Vitest et 11 parcours Playwright au vert, build de production OK.

**Auto-revue : ce qui a ete corrige**

1. **Tirage de l'echantillon non idempotent.** Le plancher « au moins un envoi controle »
   s'appliquait au complement et non a la cible : chaque nouveau passage ajoutait un controle. Le
   plancher porte desormais sur la cible de la semaine.
2. **Indicateurs trompeurs.** Une hausse du volume entrant s'affichait en rouge comme une mauvaise
   nouvelle. Les variations ont maintenant trois sens de lecture, dont un neutre.
3. **Minutes brutes affichees** dans la repartition « Ou attend le temps » : la barre accepte
   desormais une mise en forme et affiche des durees lisibles.
4. **Cellule a formule.** L'ecriture dans une cellule portant une formule est refusee avec un
   message clair, au lieu de detruire silencieusement le calcul du classeur.

**Reste a faire**

Phase 3 (typage) : moteur de regles puis tache IA `typer_evenement`, file « A classer » branchee sur
le typage automatique, proposition de regle a chaque correction manuelle. La file « A classer » et
l'outil `corriger_typage` existent deja et attendent le moteur.

**Dettes techniques**

- L'onglet hebdomadaire n'est ecrit que si son nom correspond a la regle « semaine ISO moins 26 » de
  2026. Pour une autre annee, la regle devra etre confirmee avec le commanditaire ; en attendant,
  l'export s'arrete avec un message qui liste les onglets presents plutot que d'ecrire au mauvais
  endroit.
- Les indicateurs ne se cumulent pas entre comptes clients : le tableau de bord demande de choisir
  un compte. C'est volontaire (melanger deux clients n'a pas de sens metier), mais le CEO voudra
  sans doute une vue consolidee par la suite.
- `construireColonneSemaine` appelle `construireBlocJour`, qui refait les memes requetes : a
  mutualiser si l'export devient lent sur un gros mois.

---

## 2026-11-07 : typage (phase 3)

**Fait**

- **Fournisseur IA interchangeable** (`src/server/ai/service.ts`) : `agent` par defaut en
  production (la tache attend dans `ai_tasks` qu'une routine Claude Code la releve, cout nul),
  `api` si une cle est fournie, `mock` deterministe pour les tests. Toute sortie passe par le
  filtre « aucun tiret long », quel que soit le fournisseur.
- **API agent** : `GET /api/agent/ia/taches` sert les taches en attente avec leur prompt et leur
  schema, `POST /api/agent/ia/taches/:id/resultat` recoit la sortie. Elle est validee par zod ;
  une sortie invalide repart en file, puis la tache est abandonnee au bout de trois essais.
- **Moteur de regles** (33 regles livrees) : domaine de l'expediteur, mots-cles de l'objet et du
  corps, mots d'exclusion, sens impose. Les regles se cumulent (l'une donne la famille, l'autre la
  nature), la plus prioritaire gagne, et la confiance monte avec le nombre de signaux.
- **Service de typage** : regles d'abord, IA ensuite, file « A classer » en dernier recours. Le
  hors perimetre est tranche par les regles et ne part jamais a l'IA.
- **Proposition de regle** a chaque correction manuelle, en attente d'acceptation.
- **Ecran « A classer »** : messages a classer avec leur indice de confiance et la raison du
  classement propose, et l'onglet des regles proposees avec Accepter ou Ecarter.
- **Colonne `expediteur`** ajoutee aux evenements : elle sert au typage par domaine, a la
  proposition de regle, et servira a la collecte des mails en phase 4.

**La mesure, et ce qu'elle a appris**

| Jeu | Famille | Nature | Les deux |
|---|---|---|---|
| Principal, 65 mails, qui a servi a regler les regles | 98,5 % | 100 % | **98,5 %** |
| Temoin, 20 mails, jamais utilise pour les regler | 95 % | 90 % | **85 %** |

Le critere de la section 10 est de 85 % en famille **et** nature. Il est tenu sur les deux jeux,
mais seul le second compte vraiment : apres reglage, le jeu principal est monte a 100 %, ce qui ne
prouvait que du surapprentissage. Le jeu temoin, ecrit apres coup avec d'autres tournures, donnait
alors 75 %. C'est lui qui a revele le defaut decrit ci-dessous.

85 % sur le jeu temoin, c'est tout juste le critere : le moteur demande a etre enrichi au fil des
vrais messages. C'est precisement le role de la proposition de regle a chaque correction.

**Auto-revue : ce qui a ete corrige**

1. **Les points de fin de phrase cassaient toutes les correspondances.** Le normalisateur gardait
   le point pour preserver les noms de domaine, si bien que « en piece jointe. » n'etait jamais
   reconnu comme « en piece jointe » : tout mot-cle place en fin de phrase passait a travers. Le
   point n'est desormais conserve que lorsqu'il relie deux caracteres. Ce seul defaut coutait
   10 points sur le jeu temoin.
2. **Les deductions par defaut etaient effacees avant d'etre comptees.** Les justificatifs issus
   des regles ecrasaient ceux des deductions, donc la penalite de confiance ne s'appliquait
   jamais : un typage deduit du seul sens du message etait applique avec une confiance de 0,90 au
   lieu de 0,78, et n'allait donc pas dans « A classer » comme il aurait du. Les deductions
   s'ajoutent maintenant apres les regles et restent visibles.
3. **Pas de tolerance au pluriel.** « cotations » ne reconnaissait pas « cotation », « surestaries »
   ne reconnaissait pas « surestarie ». Un mot d'au moins quatre lettres accepte maintenant un
   « s » ou un « x » final.
4. **Des regles proposees inutilisables.** Une correction sur un objet comme « Point sur le
   dossier » proposait une regle sur les mots « point » et « dossier », qui aurait classe a peu
   pres n'importe quoi. Ces mots de contexte sont ecartes, et une proposition sans mot distinctif
   n'est plus creee du tout.

**Verifications**

251 tests Vitest et 15 parcours Playwright au vert. Les trois criteres de la phase 3 sont couverts :
le taux de classement sur les deux jeux, l'absence totale du hors perimetre dans la file, la
chronologie, les demandes et l'export, et l'absence de remarque interne dans les justificatifs
comme dans le prompt.

**Reste a faire**

Phase 4 (synchronisation des mails) : adaptateur `collecte_mail` en trois implementations
(`apps_script`, `imap`, `mock`), import de fichiers `.eml` et `.mbox`, dedoublonnage par
identifiant de message. Le dedoublonnage et la colonne `expediteur` sont deja en place et testes.

**Dettes techniques**

- Le jeu temoin a maintenant ete regarde : il ne peut plus servir de mesure vierge. Un troisieme
  jeu devra etre tire des vrais messages a la phase 4, une fois la boite de suivi branchee.
- Les regles ne regardent que l'objet et le corps. L'expediteur n'est utilise que par domaine
  exact ; un annuaire des interlocuteurs connus (ce transitaire, cette autorite) ferait gagner
  sur l'interlocuteur, qui est le champ le moins bien devine.
- `typerMessage` relit les regles en base a chaque appel. A mettre en cache court si la collecte
  de la phase 4 amene des volumes.
