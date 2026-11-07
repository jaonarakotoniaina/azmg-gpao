# Journal de bord

Tenu a jour a chaque push. A toute reprise de session : lire `CLAUDE.md`, puis ce fichier,
puis `git log -20`, et reprendre a la premiere tache non terminee.

## Plan des phases

### Phase 1 : socle et saisie (en cours)

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
- [ ] 1.12 Interface React : connexion, file du jour, saisie rapide, fiche dossier, parametres
- [ ] 1.13 Tests unitaires et d'integration, parcours Playwright
- [ ] 1.14 Chaine de release GitHub Actions et script de deploiement o2switch
- [ ] 1.15 README, guide utilisateur, auto-revue de fin de phase

### Phase 2 : pilotage (a venir)

Tableau de bord (flux, stock, age, delais, attente par acteur, SLA), echeancier et alertes,
check-lists avant envoi, controle qualite avec echantillonnage, digest DO en brouillon,
export du reporting de la section 9, connecteur MCP.

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
