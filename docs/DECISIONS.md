# Decisions techniques et metier

Chaque entree suit le format impose par CLAUDE.md : date, sujet, options envisagees, choix, raison, retour arriere.
Les contraintes jugees impossibles ou reformulees sont signalees en tete de fichier.

## Contraintes reformulees

### React 18 demande, React 19 applique

CLAUDE.md section 5 demande « React 18 + Vite ». Le depot de reference AZMG Sourcing, dont la meme
section exige une « stack identique », est en React 19.3 avec Vite 7. Les deux consignes etant
contradictoires, la stack de Sourcing prime : c'est elle qui rend les deux applications
maintenables ensemble, et c'est l'intention explicite de la section 1. Retour arriere : rabaisser
`react`, `react-dom` et `@types/react` a la serie 18 dans `package.json`, aucun code applicatif
n'utilise d'API propre a React 19.

### PostgreSQL 9.6 en production, 16 en developpement

CLAUDE.md impose la compatibilite PostgreSQL 9.6 (version o2switch) et des tests CI sur 9.6.
La machine de developpement de la session cloud n'a que PostgreSQL 16 et l'installation d'un
serveur 9.6 n'y est pas possible. Choix : le schema et les requetes n'utilisent que des
constructions disponibles en 9.6, la CI teste sur l'image `postgres:9.6`, et le developpement
local tourne sur 16. Verifie a chaque migration : ni `gen_random_uuid`, ni colonne d'identite,
ni `MERGE`, ni `NULLS NOT DISTINCT`, identifiants `bigserial`.

---

## 2026-11-07 : depots de reference

- Sujet : reprise de la stack et des conventions.
- Options : partir de zero, ou cloner AZMG Sourcing et le CRM interne en lecture seule.
- Choix : les deux depots ont ete clones en lecture seule (`/tmp/ref-sourcing`, `/tmp/ref-crm`).
  Sont reprises telles quelles de Sourcing : la stack, `src/web/theme.ts`, `tailwind.config.ts`,
  `src/shared/tirets.ts`, `lib/journal.ts`, `lib/securite.ts`, `lib/http.ts`, `db/client.ts`,
  `charger-env.ts`, `web/lib/api.ts`, la chaine de release GitHub Actions, `scripts/auto-deploy.sh`
  et `deploy/passenger-app.js`.
- Raison : consigne de la section 1 de CLAUDE.md, et ces briques sont deja eprouvees en production.
- Retour arriere : sans objet (aucune dependance vers ces depots a l'execution).

## 2026-11-07 : noms de colonnes

- Sujet : langue des identifiants de base.
- Options : tout en francais, tout en anglais, ou le compromis de Sourcing.
- Choix : tables et colonnes metier en francais (`demandes`, `acteur_attendu`, `survenu_le`),
  horodatages techniques en anglais (`created_at`, `updated_at`) comme dans Sourcing.
- Raison : alignement sur le depot de reference, dont les helpers Drizzle sont repris a l'identique.
- Retour arriere : renommer les deux colonnes dans `schema.ts` et generer une migration.

## 2026-11-07 : horaires ouvres du client

- Sujet : CLAUDE.md impose des calculs de delais « en heures ouvrees du client (Barcelone, lundi au
  vendredi, horaires parametrables) » sans donner la plage horaire.
- Options : 09 h 00 - 18 h 00 en continu, ou deux plages avec coupure de midi a l'espagnole.
- Choix : une plage unique 09 h 00 - 18 h 00 du lundi au vendredi par defaut, mais le moteur
  (`src/shared/heures-ouvrees.ts`) accepte **plusieurs plages par jour** : la coupure de midi se
  regle dans les Parametres sans toucher au code.
- Raison : option la plus simple a verifier et a expliquer, et la structure de donnees ne ferme
  aucune porte. Une journee ouvree vaut donc 540 minutes, ce qui rend les durees lisibles.
- Retour arriere : modifier `HORAIRES_PAR_DEFAUT`, ou simplement les Parametres en base.

## 2026-11-07 : regle des jours feries du compte

- Sujet : la regle du compte Masenz (feries communs non travailles, feries espagnols non
  travailles, feries malgaches travailles).
- Options : coder la regle en dur, ou la parametrer.
- Choix : deux calendriers distincts en base (`feriesClient`, `feriesLocaux`) et un drapeau
  `feriesCollaborateur` qui decide si les feries locaux sont chomes. Pour Masenz, le drapeau est
  faux : seul le calendrier espagnol compte. Les deux calendriers sont pre-remplis par calcul
  (feries fixes et mobiles via l'algorithme de Meeus pour Paques).
- Raison : la regle devient une donnee et non du code, pour les comptes clients suivants.
- Retour arriere : passer `feriesCollaborateur` a vrai dans les Parametres.

## 2026-11-07 : temps par statut, compteurs plutot que recalcul

- Sujet : comment obtenir le temps passe dans chaque statut et par chaque acteur.
- Options : recalculer a la demande en rejouant toutes les transitions, ou cumuler a chaque
  transition dans des compteurs portes par la demande.
- Choix : compteurs cumules (`minutes_par_statut`, `minutes_par_acteur`) mis a jour a chaque
  transition, **plus** le segment en cours calcule a la lecture. La ligne de `transitions_statut`
  conserve les minutes ouvrees du segment qu'elle ferme, donc le recalcul complet reste possible.
- Raison : le tableau de bord et la file du jour lisent des indicateurs sur tout un compte ;
  rejouer l'historique a chaque affichage ferait s'effondrer les temps de reponse sur mutualise.
- Retour arriere : les transitions suffisent a tout recalculer ; un script de reconstruction est
  trivial a ecrire si les compteurs derivent.

## 2026-11-07 : l'import ne cree pas de demandes

- Sujet : l'import du classeur `SUIVI_MENSUEL_MASENZ_JJ-MM.xlsx` (phase 1).
- Options : creer les dossiers seuls, ou creer aussi une demande par dossier ouvert.
- Choix : l'import cree et met a jour les **dossiers** avec leur dernier etat connu (statut et
  resume), et ne cree aucune demande.
- Raison : le classeur ne porte ni famille, ni nature, ni acteur attendu. Les deduire reviendrait
  a inventer de la donnee metier, ce que CLAUDE.md interdit (« jamais de donnee inventee »). Le
  critere d'acceptation de la phase 1 ne demande que des dossiers sans doublon. Les demandes
  naissent de la saisie rapide, puis de la synchronisation des mails en phase 4.
- Retour arriere : ajouter une option d'import qui ouvre une demande de famille a choisir.

## 2026-11-07 : lecture du classeur sans dependance externe

- Sujet : lire et, en phase 2, ecrire dans un classeur xlsx.
- Options : `exceljs`, `xlsx` (SheetJS), ou une implementation maison.
- Choix : implementation maison (`src/server/lib/xlsx/`) : lecteur ZIP sur `node:zlib` et lecture
  des parties XML par expressions regulieres ciblees.
- Raison : la section 9 exige d'ecrire dans un classeur fourni « sans en modifier la structure »
  (colonnes, en-tetes, noms d'onglets, mise en forme, formules). Les bibliotheques generalistes
  reconstruisent le classeur a l'enregistrement et perdent une partie des styles, des formules et
  des parties qu'elles ne modelisent pas. Manipuler directement les entrees du ZIP garantit que
  les parties non touchees ressortent octet pour octet, ce qui est exactement ce que le test de
  comparaison des styles et formules de la phase 2 doit verifier.
- Raison secondaire : zero dependance supplementaire sur un hebergement mutualise.
- Retour arriere : remplacer `lireClasseur` par un appel a `exceljs`, l'interface de lecture
  (`Classeur`, `Onglet`, `Cellule`) est independante de l'implementation.

## 2026-11-07 : saisie rapide en un seul appel

- Sujet : objectif de 30 secondes pour creer un dossier et une demande au clavier.
- Options : trois appels successifs (dossier, demande, evenement), ou un appel unique.
- Choix : un seul point d'entree `POST /api/saisie/rapide` qui cree le dossier s'il manque,
  ouvre la demande si la nature de l'evenement le prevoit, et enregistre l'evenement.
- Raison : sur une connexion lente depuis un mobile, trois aller-retours reseau consomment a eux
  seuls une part sensible du budget de 30 secondes, et un echec en cours de chaine laisserait des
  donnees partielles.
- Retour arriere : les trois routes unitaires existent et restent utilisables.

## 2026-11-07 : le hors perimetre (T00) est trace, jamais pilote

- Sujet : « un mail classe hors perimetre n'apparait dans aucune vue de pilotage ni aucun export ».
- Options : ne rien enregistrer, ou enregistrer l'evenement en l'excluant des vues.
- Choix : l'evenement T00 est enregistre (il faut pouvoir montrer pourquoi un mail a ete ecarte et
  corriger un classement errone), mais il ne cree ni ne fait avancer aucune demande, et toutes les
  requetes de pilotage, de chronologie et d'export le filtrent. La creation d'une demande T00 est
  refusee par le service et par l'API.
- Raison : la tracabilite d'un classement est necessaire a la phase 3 (correction du typage et
  proposition de regle), sans quoi une erreur de classement serait invisible et irreparable.
- Retour arriere : sans objet, le filtre est centralise (`conditionPerimetre`, `estHorsPerimetre`).
