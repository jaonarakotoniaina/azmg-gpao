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

### Phase 4 : synchronisation des mails (terminee)

- [x] 4.1 Adaptateur `collecte_mail` : `apps_script` (webhook signe), `imap`, `mock`
- [x] 4.2 Import ponctuel de fichiers `.eml` et `.mbox` pour l'historique
- [x] 4.3 Dedoublonnage par identifiant de message, rattachement au fil, horodatage d'origine conserve
- [x] 4.4 Pieces jointes rangees hors du dossier public, servies par une route authentifiee
- [x] 4.5 `docs/apps-script.md` : script complet et mise en place
- [x] 4.6 Ecran « Import des mails »
- [x] 4.7 Auto-revue, journal, mise a jour de la pull request

**Phase 4 terminee.**

### Phase 5 : automatisations du poste (en cours)

- [x] 5.1 Socle des brouillons : table, sources citees, cycle de vie (prepare, utilise, ecarte)
- [x] 5.2 Relances N1, N2 et N3 preparees chaque matin selon les delais d'attente
- [x] 5.3 Daily et onglet « sem » pre-remplis
- [x] 5.4 Tableaux de situation par client
- [x] 5.5 Comparatif de cotations fret depuis les offres recues
- [x] 5.6 Tache cron de preparation du matin
- [x] 5.7 Ecran « Brouillons »
- [x] 5.8 Auto-revue, rapport final, pull request

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

---

## 2026-11-07 : synchronisation des mails (phase 4)

**Fait**

- **Adaptateur `collecte_mail`** en trois implementations derriere une seule interface :
  `apps_script` (un script Google pousse les messages vers un webhook signe), `imap` (relevage
  direct), `mock` (aucune collecte, la GPAO vit de la saisie et de l'import). Le choix est fait
  par la configuration : secret absent, c'est `mock`, et l'application fonctionne quand meme.
- **Webhook signe** : la signature HMAC porte sur les octets recus. Sans elle, quiconque
  connaitrait l'adresse pourrait injecter de faux mails dans le pilotage du poste.
- **Import `.eml` et `.mbox`**, avec decoupage du format mbox et retablissement des lignes du
  corps que ce format echappe. Un export Google Takeout se depose directement.
- **Dedoublonnage** sur l'identifiant RFC 5322, pose en index unique. **Rattachement au fil** par
  la tete de la chaine `References`. **Horodatage d'origine conserve** : les delais se comptent
  sur la date du message, pas sur celle de la collecte, sans quoi un relevage en retard fausserait
  tous les indicateurs.
- **Pieces jointes** rangees hors du dossier public, sous un chemin derive de l'empreinte du
  contenu (le nom d'origine, qui peut citer un client, n'apparait pas sur le disque), avec liste
  blanche d'extensions et plafond de taille. Une seule porte d'entree : une route authentifiee qui
  verifie le perimetre de l'utilisateur.
- **Ecran « Import des mails »** et `docs/apps-script.md` : script complet, mise en place pas a pas,
  tableau de diagnostic.

**Verifications**

Les trois criteres de la phase 4 sont couverts par des tests, et le dernier par un parcours
complet dans le navigateur :

| Critere | Verification |
|---|---|
| Un fil importe deux fois ne cree aucun doublon | test d'integration et parcours Playwright, qui importent le meme fil deux fois de suite |
| Un mail sortant de demande de validation passe la demande en « En attente DO » | test sur un fil de trois mails, sans aucune saisie |
| La reponse de la DO la fait repasser en cours | meme test, avec verification des transitions horodatees sur les dates des mails |

274 tests Vitest et 17 parcours Playwright au vert.

**Auto-revue : ce qui a ete corrige**

1. **L'analyseur du webhook mangeait le corps de l'import.** Le webhook etait monte sur
   `/api/collecte` avec un analyseur de corps brut en `*/*`, necessaire pour verifier la
   signature ; il consommait donc le corps multipart de la route d'import, qui echouait avec
   « Unexpected end of form ». Le webhook est monte sur son chemin exact. Le defaut n'apparaissait
   pas dans les tests d'integration, qui appellent le service sans passer par Express : c'est le
   parcours Playwright qui l'a trouve.
2. **Les messages sont traites du plus ancien au plus recent**, quel que soit l'ordre d'arrivee
   du lot, sans quoi une reponse pouvait etre enregistree avant la demande qu'elle fait avancer,
   et ouvrir une seconde demande au lieu de rejoindre le fil.

**Dettes techniques**

- Le rattachement au fil ne regarde que `References` et `In-Reply-To`. Un client qui repond sans
  ces en-tetes (certains webmails) ouvrira un nouveau fil. Un rapprochement de secours sur l'objet
  normalise et l'interlocuteur serait utile, mais demande d'etre calibre sur de vrais messages.
- Le dossier ouvert automatiquement quand le fil est inconnu prend la partie locale de l'adresse
  de l'expediteur comme nom de client. C'est volontairement grossier et signale « a reclasser » :
  mieux vaut un dossier a corriger qu'un message perdu.
- Le mode `imap` n'est pas teste contre un vrai serveur : la session cloud n'en a aucun. Son code
  suit celui de Sourcing, deja en production, mais il faudra le verifier sur la boite reelle.

---

## 2026-11-07 : phase 5, automatisations du poste

Tout ce que l'application prepare reste un brouillon. **Aucune route n'envoie de message**, aucun
adaptateur SMTP n'est appele par la preparation, et les deux seules actions offertes au poste sont
« je l'ai envoye » et « ecarter », qui ne tracent qu'une decision.

**Ce qui est livre**

- **Table `brouillons`** : type, cible (dossier et demande), titre, texte, donnees structurees,
  **identifiants des evenements cites**, cycle de vie (`prepare`, `utilise`, `ecarte`), niveau de
  relance, cle d'unicite. La cle est ce qui rend la preparation du matin rejouable : un second
  passage ne cree pas de doublon et, surtout, n'ecrase pas un brouillon deja traite.
- **Relances N1, N2 et N3** : le niveau vient du temps d'attente en heures ouvrees du client, pas
  d'un compteur de passages (voir `docs/DECISIONS.md`). Seuls les niveaux superieurs a celui deja
  emis sur la demande sont proposes. Le texte est redige en francais, anglais ou espagnol selon le
  domaine de l'interlocuteur, et reprend les faits dates des derniers echanges.
- **Daily et onglet « sem » pre-remplis**, construits par les memes fonctions que l'export, donc
  au meme format : le daily porte la description numerotee orientee resultat, l'onglet de semaine
  les chiffres et les syntheses, **sans aucune reference de dossier**.
- **Tableaux de situation par client** : un bloc par dossier, avec le statut au format exact du
  reporting client, la mention « validation DO attendue » le cas echeant, le temps d'attente en
  heures ouvrees et la prochaine echeance. Aucun code technique n'y figure.
- **Comparatif de cotations fret** : prix, devise, cut-off, ETD, ETA, transit et validite lus dans
  les offres recues sur le dossier. Un champ absent reste **vide**, et une ligne du brouillon
  compte les offres sans prix lisible. Le choix du transitaire revient a la DO, le brouillon le
  dit.
- **Tache cron `preparation_matin`** a partir de 6 h, heure d'Antananarivo : relances, daily de la
  veille, et le lundi l'onglet de la semaine ecoulee, pour tous les comptes actifs. Un compte en
  echec ne prive pas les autres de leurs brouillons.
- **Ecran « Brouillons »** : liste par etat, nombre d'evenements cites, copie en un clic, lien vers
  la demande, preparation a la demande et situation d'un client.

**Verifications**

| Critere de la section 10 | Verification |
|---|---|
| Aucune action sortante sans validation humaine | aucune route n'envoie ; un test verifie que le brouillon reste `prepare` et que le niveau de relance de la demande ne bouge pas ; un parcours Playwright passe par les deux boutons |
| Chaque brouillon cite les evenements sources | teste sur les cinq types de brouillon ; le parcours Playwright lit le compte des sources a l'ecran |

33 tests sur les brouillons, 307 tests Vitest et 19 parcours Playwright au vert.

**Auto-revue : ce qui a ete corrige**

1. **Deux boucles a requetes multiples.** `relancesAPreparer` lisait les evenements demande par
   demande et `preparerSituationClient` faisait trois requetes par dossier. Les deux font
   desormais une requete groupee et repartissent les resultats en memoire.
2. **Une decision pouvait etre prise deux fois.** `deciderBrouillon` acceptait de trancher un
   brouillon deja traite, ce qui ecrasait l'auteur et l'horodatage de la premiere decision. La
   mise a jour est conditionnee a l'etat `prepare` et renvoie un conflit 409 sinon.
3. **Un code technique dans un texte destine au client.** Une echeance sans libelle etait nommee
   par son type brut (« etd ») ; elle prend maintenant le libelle du referentiel. Meme correction
   pour « en attente de le poste ».
4. **Un brouillon anglais portait une duree en francais.** `formaterDuree` abrege « 3 j 2 h », ce
   qui est juste dans l'interface mais detonne dans un message adresse a un transitaire anglophone
   ou hispanophone. Une duree en mots, dans la langue du brouillon, la remplace.
5. **Le tick ne declenchait aucune tache planifiee.** Depuis la phase 1, `tick()` ne vidait que la
   file `jobs_queue` : les taches de `TACHES` existaient sans jamais partir. Le tick parcourt
   maintenant les taches dues et le budget du passage leur reserve une minute.

**Dettes techniques de la phase 5**

- **La langue est deduite du domaine** de l'interlocuteur (`.es` espagnol, `.com` anglais, le reste
  francais). C'est grossier : un transitaire francais en `.com` recevra un brouillon en anglais. Le
  poste le voit et le corrige en relisant, mais une langue stockee sur l'interlocuteur, apprise de
  la premiere correction, serait plus juste.
- **L'extraction des offres de fret est a expressions regulieres**, calibree sur des formulations
  usuelles. Elle ne lira pas une offre presentee en tableau ou en piece jointe PDF. La tache IA
  `extraire_elements` pourra l'enrichir, avec la meme regle du champ vide.
- **Les sources d'un daily sont plafonnees a 200 evenements** par jour. Au-dela, la liste citee est
  tronquee, sans que le texte du brouillon s'en trouve change.
- **Le daily et l'onglet de semaine sont des textes a relire**, pas une ecriture dans le classeur.
  L'ecriture reste dans l'ecran « Export du reporting », qui est le seul a toucher au fichier.

---

# Rapport final

Etat au 7 novembre 2026, branche `claude/vigilant-archimedes-3ufdaa`. Les cinq phases de la
section 10 de `CLAUDE.md` sont livrees.

## Ce qui est livre

**Socle.** TypeScript de bout en bout, Express 5, Drizzle sur `pg`, React 19 avec Vite, Tailwind,
TanStack Query et lucide-react, zod partage entre le front et le back, Vitest et Playwright. Les
choix sont ceux d'AZMG Sourcing, repris tels quels. 24 tables, migrations rejouables sur base vide
et **compatibles PostgreSQL 9.6** (`bigserial`, aucune colonne d'identite, aucun `gen_random_uuid`,
aucun `MERGE`), verifiees par la CI sur 9.6.

**Authentification et roles.** Mot de passe argon2id, sessions en base, cookie httpOnly, CSRF a
double jeton, reinitialisation par email. Quatre roles : `admin`, `manager`, `collaborateur` et
`client_lecture`, ce dernier prevu et desactive. Le perimetre est applique a chaque requete : un
collaborateur ne voit que ses postes, un manager que ses comptes.

**Metier.** Dossier, demande, evenement, avec les quinze familles T00 a T14, les dix natures et
leur effet, les sept statuts et leur correspondance exacte au reporting client. Chaque transition
est horodatee avec son auteur, et le temps passe par statut et par acteur est calcule en **heures
ouvrees du client** (Barcelone), week-end et feries compris, selon la regle du compte : feries
espagnols non travailles, feries propres a Madagascar travailles.

**Pilotage.** Saisie rapide, file du jour, fiche dossier avec chronologie complete, tableau de
bord (flux, stock, age du stock, delais, attente par acteur, SLA, qualite, charge estimee,
comparaison a la semaine precedente), echeancier avec alertes J-2 et J0, check-lists avant envoi,
controle qualite avec echantillonnage hebdomadaire idempotent, digest de validation DO.

**Reporting.** Import d'un classeur au format existant (lecture de « Suivi Quotidien »), et export
qui **ecrit dans une copie du classeur fourni sans toucher a sa structure** : onglets, en-tetes,
largeurs de colonnes, fusions, styles, formats de date et formules sont preserves octet pour
octet. Verifie par un test de comparaison, et independamment avec openpyxl.

**Typage.** Moteur de regles (33 regles initiales sur les domaines, les mots de l'objet et les
libelles) puis tache IA `typer_evenement`. File « A classer » sous le seuil de confiance, et chaque
correction manuelle propose une nouvelle regle, qui n'entre en vigueur qu'apres acceptation par un
manager. Mesure honnete sur un jeu temoin de 20 mails fictifs ecrits apres le reglage : 85 %.

**Collecte des mails.** Adaptateur a trois implementations, `apps_script` (webhook signe en HMAC),
`imap` et `mock`, plus l'import de fichiers `.eml` et `.mbox` pour l'historique. Dedoublonnage par
`Message-ID`, rattachement au fil, horodatage d'origine conserve, pieces jointes rangees hors du
dossier public.

**Automatisations.** Relances N1 a N3, daily, onglet de semaine, situations client et comparatifs
de cotations, tous **en brouillon** et tous citant leurs evenements sources.

**IA sans cout API.** Interface `AiProvider` avec `agent` par defaut en production (table
`ai_tasks` servie par `GET /api/agent/ia/taches` et `POST /api/agent/ia/taches/:id/resultat`,
sortie validee par zod, trois essais), `api` et `mock`. Prompts versionnes en francais, un par
tache. L'instruction prete a coller est dans `docs/agent-ia.md`.

**Connecteur Claude.** Onze outils MCP, dont les outils d'ecriture laissent une trace « Claude »
dans le journal des actions. Decrit dans `docs/connecteur-claude.md`.

**Confidentialite.** Aucune donnee reelle du client dans le depot, les tests ou le seed. Le hors
perimetre T00 n'apparait dans aucune vue ni aucun export, et un test le verifie a chaque niveau.
Aucune appreciation du client envers le collaborateur n'est extraite, stockee en champ structure
ni reprise dans un export. Aucun tiret long dans l'interface, les exports, les brouillons ni les
prompts, avec un test qui echoue si l'un apparait et un filtre sur toute sortie de Claude.

**Tests.** 307 tests Vitest et 19 parcours Playwright au vert, build de production OK, lint et
typecheck propres.

## Comment le deployer

La procedure complete est dans `README.md`. En resume :

1. **Une fois, dans cPanel** : creer la base `azmg_gpao` et son utilisateur, le sous-domaine
   `gpao.intranet.azmg-solutions.com` avec son certificat, l'application Node (« Setup Node.js
   App ») pointant sur `app.js`, le `.env` de production hors du dossier public, et le jeton
   GitHub en lecture seule dans `~/.azmg-github-token`.
2. **Trois lignes de cron**, donnees mot pour mot dans le README : le deploiement automatique
   toutes les cinq minutes, le tick applicatif toutes les cinq minutes (il vide la file et
   declenche les taches planifiees, dont la preparation des brouillons du matin), et la sauvegarde
   quotidienne a 2 h 30.
3. **Ensuite, plus rien a faire** : un push sur `main` declenche GitHub Actions (lint, typecheck,
   tests sur PostgreSQL 9.6, build), qui publie l'artefact sur la branche `release` ; le cron
   o2switch le recupere, sauvegarde la base, joue les migrations, redemarre Passenger et verifie
   `/health`. En cas d'echec, retour automatique a la version precedente et email d'alerte.
4. **Premier compte** : `node dist/server/cli.js creer-admin <email> "<nom>"`.

## Ce qu'il reste a fournir

Le detail est dans [`docs/A_FOURNIR.md`](A_FOURNIR.md), par ordre de priorite. Les trois elements
qui comptent vraiment :

1. **Les acces o2switch** (base, secret de session, sous-domaine, jeton GitHub). Bloquants pour la
   mise en ligne, pas pour la suite du developpement.
2. **Un classeur `SUIVI_MENSUEL_MASENZ` reel, ou une copie anonymisee.** L'import et l'export sont
   testes sur un classeur fictif qui reproduit la structure decrite ; ils doivent etre verifies une
   fois sur la vraie mise en forme avant le premier export en production.
3. **L'acces a la boite Gmail de suivi** et le secret partage du webhook, pour passer la collecte
   de `mock` a `apps_script`.

Tant qu'un element manque, l'adaptateur concerne reste en `mock` et l'application fonctionne
entierement.

## Dettes techniques

Les dettes de chaque phase sont detaillees dans son entree du journal. Les plus structurantes :

- **Le rattachement au fil ne regarde que `References` et `In-Reply-To`.** Un correspondant qui
  repond sans ces en-tetes ouvrira un nouveau fil.
- **Le mode `imap` n'a jamais tourne contre un vrai serveur** : la session de developpement n'en a
  aucun. Son code suit celui de Sourcing, deja en production, mais il demande une verification sur
  la boite reelle.
- **85 % de bon classement sur le jeu temoin**, c'est tout juste le critere. Le moteur a besoin des
  vrais messages, et c'est le role de la proposition de regle a chaque correction.
- **L'extraction des offres de fret est a expressions regulieres** : elle ne lira pas un tableau ni
  une piece jointe PDF.
- **La langue d'un brouillon est deduite du domaine** de l'interlocuteur, ce qui se trompera sur un
  transitaire francais en `.com`.
- **Le role `client_lecture` est prevu et non teste** : son parcours devra l'etre avant d'ouvrir un
  acces a la DO.

## Les cinq ameliorations prioritaires suivantes

1. **Verifier l'import et l'export sur le vrai classeur.** C'est le seul endroit ou l'application
   ecrit dans un fichier que le client lit directement. Une formule cassee ou un style perdu se
   verrait tout de suite, et un test de comparaison sur une copie anonymisee fermerait le sujet
   definitivement.
2. **Brancher la collecte des mails en `apps_script` sur la boite de suivi**, puis importer
   l'historique en `.mbox`. C'est ce qui fait passer la GPAO de la saisie manuelle au pilotage
   reel, et ce qui donnera au moteur de typage les messages dont il a besoin pour depasser 85 %.
3. **Apprendre la langue et les habitudes de chaque interlocuteur.** Une langue stockee sur
   l'interlocuteur, apprise de la premiere correction, remplacerait la deduction par domaine ; le
   meme mecanisme servirait a memoriser le delai de reponse habituel d'un transitaire, et donc a
   relancer au bon moment plutot qu'a heure fixe.
4. **Ouvrir le tableau de bord en lecture a la donneuse d'ordre** (role `client_lecture`, deja
   prevu). C'est ce qui remplacerait une partie des tableaux de situation envoyes a la main, et le
   cout en est faible : le perimetre est deja applique partout.
5. **Mesurer la charge reelle par famille.** Les temps standards utilises pour la charge estimee
   sont des hypotheses. Les confronter aux temps observes sur trois mois rendrait l'indicateur de
   charge exploitable pour dimensionner le poste, ce qui est la question que se posera le
   commanditaire au moment d'ouvrir un deuxieme compte client.

---

## 2026-11-12 : la collecte branchee sur un libelle, et un defaut bloquant corrige

Les mails du poste arrivent desormais dans une boite reelle, sous un libelle. Deux ecarts entre ce
que l'application supposait et ce que la realite montre ont ete corriges.

**1. Le sens d'un mail se lisait au domaine : il se lit a l'adresse**

`sensDuMessage` tenait `azmg-solutions.com` pour seul domaine interne. Or le poste ecrit depuis une
adresse du **client**, et la donneuse d'ordre est sur **le meme domaine** que lui. Consequence :
tout ce que le poste envoyait etait enregistre comme entrant, aucune demande ne passait « En attente
DO », et le digest de validation restait vide. Le critere de la phase 4 passait en test parce que le
jeu de test faisait ecrire le poste depuis une adresse AZMG.

Correction : les adresses du poste se configurent par compte (`comptes_clients.adresses_poste`,
migration `0003`), et l'adresse exacte passe avant le domaine. L'adresse de la donneuse d'ordre,
deja dans `donneur_ordre_email`, sert maintenant de signal de typage deterministe : un envoi a la DO
est reconnu comme une demande de validation **meme sans aucun mot de validation**, la ou les
mots-cles echouaient sur un message reduit a « fw ». Nouvel onglet « Comptes clients » dans
Parametres pour la saisie.

**2. Le script Apps Script pouvait pousser toute une boite personnelle**

Il cherchait `(in:inbox OR in:sent)` sans condition, ce qui convenait a une boite dediee. Installe
sur une boite qui contient d'autres clients et du courrier prive, il aurait envoye le tout a la GPAO
d'un seul compte.

Le script a maintenant deux modes, par la constante `LIBELLE_SOURCE`. Vide, il lit la boite de
reception et les messages envoyes : c'est le cas de la boite de suivi dediee, qui est celle retenue
(elle est nommee dans `docs/A_FOURNIR.md`). Renseignee, il ne lit que ce libelle, un libelle par compte client, et s'arrete si le
libelle est introuvable plutot que de renvoyer une liste vide qui ressemble a un « rien a
collecter ». Les deux modes sont gardes parce qu'un deuxieme compte client peut arriver dans une
boite partagee, et que supprimer le mode libelle rendrait ce cas dangereux par defaut.

**Verifications**

5 tests de plus (312 au total), dont trois a la forme reelle du compte : poste et DO sur le domaine
du client. Celui qui compte le plus verifie qu'un transfert a la DO reduit a « fw », sans aucun mot
de validation, fait bien passer la demande en attente DO.

**Ce qui reste a faire pour brancher la collecte**

1. Saisir les deux adresses dans Parametres, onglet « Comptes clients » (indispensable, voir
   `docs/A_FOURNIR.md`).
2. Verifier que la boite de suivi recoit bien la copie des mails du poste **dans les deux sens**,
   recus et envoyes. Une copie des seuls mails recus priverait la GPAO de tout ce que le
   poste envoie, et donc de toute demande de validation. C'est le seul prerequis que l'application
   ne peut pas constater elle-meme.
3. Generer `APPS_SCRIPT_SECRET` et installer le script sur cette boite, `LIBELLE_SOURCE` laisse
   vide.
4. Pour l'historique : Google Takeout sur la boite ou sur le libelle, puis depot du `.mbox` dans
   « Import des mails ». L'import et la collecte se dedoublonnent entre eux.

---

## 2026-11-12 (suite) : un second poste sur le compte, la designer

Deux collaborateurs sont places chez Masenz : l'assistante export et la designer. La boite de suivi
recoit les deux boites. Le pilotage de la designer demandait deux corrections.

**1. Le travail de la designer etait avale par T00**

Le referentiel rangeait « marketing, design, travail de la designer » dans T00, hors perimetre, aux
cotes du spam. C'etait juste tant qu'un seul poste etait pilote : la regle protegeait la file de
l'assistante export. Elle rendait en revanche la designer impossible a suivre.

T00 ne garde desormais que ce qui est hors perimetre pour tout le monde : notifications systeme,
infolettres, spam. Le travail de la designer prend trois familles, `D01` publications et reseaux
sociaux, `D02` visuels et supports, `D03` catalogue et contenus marketing. La regle du perimetre
strict tient toujours, mais **par poste** : un mail `D02` n'apparait pas dans la file de
l'assistante, un `T01` n'apparait pas dans celle de la designer, et `T00` n'apparait nulle part.

**2. Les adresses etaient posees sur le compte, elles appartiennent au poste**

Correction de ce qui avait ete fait le matin meme, quand un seul poste etait suivi par compte.
`postes.adresses` et `postes.familles` remplacent `comptes_clients.adresses_poste` (migration
`0004`, qui recopie la valeur existante sur le premier poste pour ne rien perdre).

L'adresse sert maintenant a deux choses : dire si un message part ou arrive, et dire **a quel
poste** il appartient. Sur ce second point, l'adresse passe avant la famille, parce qu'une adresse
est un fait et une famille un typage qui peut se tromper. A defaut d'adresse, la famille tranche,
et sur une famille partagee par les deux metiers (`T07`, `T09`, `T13`) le routage ne choisit pas :
il laisse le rattachement a la main plutot que de tirer au hasard.

**Verifications**

8 tests de plus (320 au total), dont six sur le routage entre les deux postes. Le jeu temoin du
typage passe de 20 a 22 mails, familles de la designer comprises, et reste a **86,4 %**.

Deux des annotations que j'avais posees pour ces nouveaux cas etaient incoherentes : la designer
figurait comme expeditrice alors que le sens disait « entrant ». Le jeu temoin est tombe a 77 % et
c'est ce qui l'a revele. J'ai corrige les annotations, pas les regles : regler le moteur sur le jeu
temoin lui ferait perdre tout son interet.

**Ce qui reste a saisir**

Dans Parametres, onglet « Comptes clients » : l'adresse de la donneuse d'ordre pour le compte, et
les adresses de chaque poste. Le poste de la designer doit etre cree s'il ne l'est pas encore, avec
le metier « designer », qui pre-remplit son perimetre de familles.

---

## 2026-11-12 (fin) : ce qui n'est pas suivi, et qui est interne

Deux precisions sur le compte, et leurs consequences.

**Une boite du client n'est pas suivie**

`comptes_clients.adresses_ignorees` (migration `0005`). Un message qui ne concerne qu'une de ces
adresses n'est pas collecte du tout : ni evenement, ni dossier, ni demande. Le bilan de collecte les
compte a part, a cote des doublons et du hors perimetre.

C'est plus net que de les classer T00, qui laisse une trace a lire. Pour une boite qui n'est pas
suivie, il n'y a rien a lire : une trace serait du bruit, et le volume finirait par peser sur les
indicateurs de flux. La regle reste prudente : il suffit qu'une adresse d'un poste figure parmi
l'expediteur ou les destinataires pour que le message soit collecte malgre tout.

**Un encadrant AZMG n'est pas la donneuse d'ordre**

Un dirigeant AZMG qui demandait un « tableau de situation » etait classe comme la donneuse d'ordre,
parce que cette demande vient habituellement d'elle. La deduction par adresse ecrase maintenant ce
que les mots-cles devinent : l'adresse exacte de la DO d'abord, le domaine interne AZMG ensuite.
Une adresse est un fait, un mot-cle une inference.

A noter pour la lecture des ecrans : un message dont la nature n'est que deduite du sens reste sous
le seuil de confiance et part en « A classer », interlocuteur compris. Le typage se lit alors dans
les justificatifs sans etre pose sur l'evenement, et c'est voulu : un classement faible se corrige
a la main plutot que de s'appliquer d'office. Un test le verifie explicitement, pour qu'on ne le
prenne pas plus tard pour un defaut.

**Verifications**

5 tests de plus (325 au total). Le jeu temoin du typage reste a 86,4 %.

---

## 2026-11-12 (apres mise en ligne) : l'application arrivait sans porte d'entree

Premiere mise en ligne, et aucun compte client visible. Ce n'etait pas un defaut de deploiement :
rien dans l'interface ne permettait de creer un compte.

**Ce qui manquait**

Les routes `POST /api/comptes` et `POST /api/postes` existaient depuis la phase 1, mais aucun ecran
ne les appelait. Le seed de demonstration est desactive en production, a juste titre. Une
installation neuve se retrouvait donc avec un compte administrateur et rien d'autre, sans moyen
d'aller plus loin.

S'y ajoutait un ecran trompeur : l'onglet « Comptes clients » testait `!comptes?.length` avant
d'afficher la liste, et montrait donc un chargement perpetuel quand la liste etait vide, au lieu de
dire qu'il n'y avait aucun compte.

**Pourquoi aucun test ne l'a vu**

Le jeu de parcours creait le compte et le poste **directement en SQL**, dans `e2e/global-setup.ts`,
« pour un demarrage rapide ». Tous les parcours partaient donc d'une application deja peuplee, et
le premier ecran qu'un utilisateur voit en vrai n'etait exerce par rien.

C'est la correction la plus utile de la journee : la preparation ne cree plus ni compte ni poste, et
le **premier parcours les cree par l'interface**. Le chemin du premier demarrage fait desormais
partie de la suite, et les dix-neuf autres parcours travaillent sur ce que celui-la a cree.

**Ce qui a ete ajoute**

- Formulaire de creation d'un compte client (administrateur) : nom, pays, ville, nom et adresse de
  la donneuse d'ordre. Le code du compte est derive du nom.
- Formulaire de creation d'un poste sous chaque compte : intitule, metier (qui pre-remplit le
  perimetre de familles), adresses, et **collaborateur rattache**. Ce dernier champ manquait aussi :
  un poste sans rattachement n'apparait dans la file d'aucun collaborateur, ce que le second
  parcours a revele des que le premier a cesse de passer par SQL.
- Etats vides explicites, a la place du chargement perpetuel.
- `README.md` : une etape « Premier compte client et premiers postes » dans la mise en place, et le
  guide utilisateur decrit l'onglet.

**Verifications**

20 parcours Playwright (un de plus), 325 tests Vitest.

---

## 2026-11-12 (suite) : les comptes utilisateurs, et le meme manque trois fois

L'ecran Equipe affichait la liste des comptes utilisateurs sans permettre d'en creer un. Exactement
le manque corrige une heure plus tot sur les comptes clients, et pour la meme raison : les routes
existaient depuis la phase 1, `POST /api/utilisateurs` et `PATCH /api/utilisateurs/:id`, mais aucun
ecran ne les appelait. Seule la ligne de commande savait creer un utilisateur.

En ecrivant le formulaire, un troisieme cas du meme defaut est apparu. Le texte d'aide annoncait
que « chacun peut changer son mot de passe ensuite depuis son compte », et c'etait faux :
`POST /api/auth/changer-mot-de-passe` existait, sans aucun ecran pour l'appeler. Ecrire la phrase a
suffi a reveler qu'elle mentait.

**Ce qui est livre**

- Onglet **Equipe** : creation d'un compte (nom, adresse email, role, mot de passe initial),
  changement de role depuis la liste, desactivation et reactivation. La desactivation ferme les
  sessions ouvertes, ce que faisait deja la route. Un administrateur ne peut pas se retirer ses
  propres droits, et sa ligne ne porte donc aucune action.
- Onglet **Mon compte**, visible par tous les roles : changement de son propre mot de passe, avec
  confirmation et verification du mot de passe actuel.
- Etats vides et erreurs de chargement distingues, comme sur l'onglet des comptes clients.

**Le mot de passe initial**

L'administrateur le saisit et le transmet par un autre canal que le courriel. La reinitialisation
par courriel existe, mais elle depend du SMTP, qui reste en mode simule tant que les identifiants
ne sont pas fournis. Un mot de passe initial saisi a la main ne depend de rien et fonctionne des la
mise en ligne.

**Verifications**

22 parcours Playwright, deux de plus : creation puis modification puis desactivation d'un compte,
et changement de mot de passe, y compris le refus d'un mot de passe actuel errone.

**La lecon, trois fois la meme**

Une route sans ecran n'existe pas pour l'utilisateur. Les trois manques se ressemblaient, et aucun
test ne les voyait parce que les parcours contournaient l'interface : par SQL pour les comptes
clients, par la ligne de commande pour les utilisateurs. Le reste du produit est couvert ; ce sont
les chemins de mise en route qui ne l'etaient pas, et ce sont precisement ceux qu'on emprunte une
seule fois, le jour de la mise en ligne.

---

## 2026-11-12 (fin de journee) : verifier une mise en ligne depuis l'exterieur

Apres la mise a jour, j'ai pu confirmer la version servie en comparant l'empreinte du fichier
telecharge du serveur a celle de ma build. En revanche, rien ne permettait de verifier que les
migrations s'etaient appliquees : la reponse ne pouvait etre qu'un raisonnement.

C'est le cas le plus trompeur d'une mise en ligne. Une application qui sert le bon code sur une
base restee en arriere repond normalement, et le defaut n'apparait qu'au premier ecran qui touche
une colonne absente, longtemps apres et loin de sa cause.

`/health` publie desormais `migrations` : attendues, appliquees, nom de la derniere, et un
booleen. Le nom est retrouve en rapprochant l'horodatage enregistre par Drizzle du journal du
depot, la table ne stockant que l'empreinte du fichier SQL.

**Ce que le controle ne fait pas** : il ne change pas le code de reponse. `scripts/auto-deploy.sh`
revient en arriere quand `/health` echoue ; faire echouer le controle sur un retard de migration
rendrait le retour arriere automatique, ce qui est seduisant, mais un faux negatif ferait reculer
une mise en ligne saine. Le signal est neuf, on le regarde avant de lui confier une decision.

**Verifications**

2 tests de plus (327 au total) : l'etat des migrations est annonce et coherent, et aucun mot
sensible n'apparait dans la reponse, `/health` etant public.

**Une correction de methode, pour memoire**

Mon premier controle du bundle en ligne cherchait les textes des nouveaux ecrans dans
`index-*.js` et n'en trouvait aucun. La methode etait fausse : les ecrans sont en chargement
differe, donc dans leur propre fragment. La conclusion du moment restait juste, mais pour une
autre raison, etablie par `/health`. Un controle qui ne peut pas distinguer « absent » de
« ailleurs » ne prouve rien.
