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

## 2026-11-07 : les regles de typage passent avant l'IA

- Sujet : l'ordre entre le moteur de regles et la tache IA `typer_evenement`.
- Options : tout confier a l'IA, ou faire passer les regles d'abord.
- Choix : les regles d'abord. L'IA ne traite que ce qu'aucune regle ne tranche, et son resultat
  n'est applique que s'il depasse le seuil de confiance.
- Raison : trois raisons qui se cumulent. Les regles sont gratuites, alors que le mode `agent`
  impose un delai d'attente le temps que la routine passe. Elles sont instantanees, ce qui compte
  pour une saisie rapide de 30 secondes. Et surtout elles sont **explicables** : quand le manager
  demande pourquoi un mail est en T04, on lui montre la regle, et il la corrige lui-meme.
- Retour arriere : `typerMessage` accepte `sansIa`, et l'ordre inverse tiendrait en quelques lignes.

## 2026-11-07 : une regle proposee ne classe rien avant d'etre acceptee

- Sujet : que faire de la regle deduite d'une correction manuelle (critere de la phase 3).
- Options : l'activer aussitot, ou la mettre en attente d'un accord.
- Choix : elle est enregistree avec `proposee = true` et ne classe rien tant qu'un administrateur
  ou un manager ne l'a pas acceptee dans l'ecran « A classer ».
- Raison : une regle tiree d'un seul message se trompe souvent, et une mauvaise regle contamine
  silencieusement la file du jour, les indicateurs et le reporting. Le cout d'un clic est sans
  commune mesure avec le cout d'un classement faux repete. Les mots trop generiques (« dossier »,
  « point », « suite ») sont d'ailleurs ecartes a la source : une proposition sans mot distinctif
  n'est pas creee du tout.
- Retour arriere : passer `proposee: false` a la creation dans `proposerRegle`.

## 2026-11-07 : un jeu temoin a cote du jeu d'evaluation

- Sujet : mesurer honnetement le typage.
- Options : le seul jeu de 60 mails annotes demande par CLAUDE.md, ou un second jeu temoin.
- Choix : deux jeux. `mails-annotes.ts` (65 mails) a servi a construire les regles ;
  `mails-temoins.ts` (20 mails) a ete ecrit **apres** le reglage, avec d'autres tournures, et
  n'a jamais servi a les ajuster.
- Raison : apres reglage, le jeu principal est monte a 100 %, ce qui ne prouvait rien d'autre que
  du surapprentissage. Le jeu temoin a immediatement donne 75 %, et c'est ce chiffre qui disait la
  verite. Il a conduit a corriger un vrai defaut du normalisateur (voir ci-dessous) et le score
  temoin est remonte a 85 %. Le critere de la section 10 est evalue sur les deux jeux, mais c'est
  le temoin qui est regarde.
- Consequence assumee : 85 % sur le jeu temoin, c'est tout juste le critere. Le moteur demande a
  etre enrichi au fil des vrais messages, et c'est exactement le role de la proposition de regle a
  chaque correction.
- Retour arriere : sans objet, les deux jeux sont independants du code de production.

## 2026-11-07 : le typage ne comble que les trous

- Sujet : que fait le typage automatique quand un humain a deja renseigne la famille ou la nature.
- Options : recalculer et ecraser, ou ne completer que ce qui manque.
- Choix : ne completer que ce qui manque. Un champ saisi par un humain n'est jamais ecrase.
- Raison : la correction manuelle est la source de verite, et c'est elle qui alimente les regles.
  Un typage qui ecrase une saisie ferait perdre le travail de classement et decouragerait l'usage
  de la file « A classer ».
- Retour arriere : l'option `typerAutomatiquement` d'`ajouterEvenement` controle tout le mecanisme.

## 2026-11-07 : le niveau de relance vient du temps d'attente, pas du compteur

- Sujet : comment choisir entre N1, N2 et N3 quand une demande attend depuis longtemps sans
  qu'aucune relance n'ait ete emise.
- Options : incrementer d'un niveau a chaque passage (N1 puis N2 puis N3, un par jour), ou
  deduire le niveau du temps d'attente en heures ouvrees.
- Choix : deduire le niveau du temps d'attente, et ne proposer que les niveaux superieurs a celui
  deja emis sur la demande.
- Raison : une demande reprise apres deux semaines de silence merite un N3 tout de suite, pas un
  N1 polimment etonne. Et un poste qui a relance par telephone peut noter le niveau atteint sur la
  demande : l'application ne repropose alors que la suite.
- Consequence : les seuils (16, 32 et 56 heures ouvrees par defaut) sont dans les parametres,
  section SLA, et se reglent sans redeploiement.
- Retour arriere : `relancesAPreparer` concentre tout le calcul.

## 2026-11-07 : un brouillon n'est jamais envoye par l'application

- Sujet : la phase 5 prepare des relances et des reportings. Faut-il un bouton « envoyer » ?
- Options : envoi par SMTP avec fenetre d'annulation (le modele d'AZMG Sourcing), ou brouillon a
  copier et envoi manuel par le poste.
- Choix : brouillon seulement. Aucune route n'envoie, aucun adaptateur SMTP n'est appele par la
  preparation. Les deux seules actions sont « je l'ai envoye » et « ecarter », qui ne font que
  tracer la decision.
- Raison : la section 6 de CLAUDE.md est explicite, « aucun mail ne part automatiquement vers un
  client, un transitaire ou la DO ». A la difference d'un candidat qui recoit un accuse de
  reception, ici chaque message engage le compte client devant un transitaire ou devant la
  donneuse d'ordre. Le cout d'un message maladroit est sans commune mesure avec le temps gagne.
- Consequence : le poste copie le texte et l'envoie depuis sa messagerie, ce qui garde aussi le
  fil de discussion dans sa boite.
- Retour arriere : l'ajout d'un envoi passerait par un adaptateur `envoi_mail` a deux
  implementations, sur le modele de la collecte, et par un mode d'automatisation dedie. Rien dans
  le modele de donnees ne s'y oppose : `statut` accueillerait un etat `envoye`.

## 2026-11-07 : le comparatif de cotations lit, il ne devine pas

- Sujet : l'extraction des prix, cut-off, ETD, ETA, transit et validite des offres de fret recues.
- Options : une tache IA `extraire_elements` sur chaque offre, ou des expressions regulieres avec
  cases vides quand le texte ne dit rien.
- Choix : expressions regulieres, champ absent laisse vide, et une ligne du brouillon qui compte
  les offres sans prix lisible.
- Raison : ce tableau sert a choisir un transitaire et un prix, et c'est la DO qui tranche. Un
  chiffre invente ou mal lu y ferait plus de degats qu'une case vide que le poste complete en
  regardant le mail. La regle « jamais de donnee inventee » de la section 6 pese plus lourd que le
  confort.
- Consequence : le taux de remplissage depend de la redaction des transitaires. La tache IA
  `extraire_elements` pourra enrichir le resultat plus tard, avec la meme regle du champ vide.
- Retour arriere : `extraireOffre` est une fonction pure, testee sur un texte complet et sur un
  texte sans aucune donnee.

## 2026-11-07 : le tick declenche les taches planifiees

- Sujet : les taches periodiques existaient depuis la phase 1 mais rien ne les appelait, le tick
  ne vidant que la file `jobs_queue`.
- Options : une ligne de cron par tache, ou un seul tick qui decide des taches dues.
- Choix : un seul tick. Il vide la file, puis parcourt les taches dont la periode est echue,
  d'apres `cron_runs`.
- Raison : une seule ligne de cron a installer dans cPanel, et une seule a surveiller. Le verrou
  consultatif couvre deja l'ensemble, et chaque tache absorbe ses propres erreurs : un echec ne
  prive pas les suivantes de leur passage.
- Consequence : le budget du passage est partage. La file se voit reserver au plus le budget moins
  une minute, pour que les taches periodiques aient toujours de quoi tourner.
- Retour arriere : `PERIODICITES` dans `src/server/taches-periodiques.ts` decrit tout, et chaque
  tache reste executable seule en ligne de commande.

## 2026-11-12 : le sens d'un mail se lit a l'adresse, pas au domaine

- Sujet : la collecte deduisait le sens d'un message (entrant, sortant) du domaine de l'expediteur,
  avec `azmg-solutions.com` comme seul domaine interne.
- Ce que la realite a montre : le poste ecrit depuis une adresse du **client**, et la donneuse
  d'ordre est sur **le meme domaine** que lui (une boite « info » et une boite « export » chez le
  meme client). Au domaine seul, tout ce que le poste envoyait etait lu comme du courrier recu, et
  aucune demande ne passait « En attente DO » : le critere de la phase 4 ne tenait qu'a la forme de
  jeu de test, ou le poste ecrivait depuis une adresse AZMG.
- Options : etendre les domaines internes au domaine du client (ce qui rendait la DO interne elle
  aussi, donc indistinguable), ou configurer les adresses exactes du poste par compte.
- Choix : les adresses exactes, dans `comptes_clients.adresses_poste`, et l'adresse de la DO dans
  `donneur_ordre_email`, deja presente. L'adresse exacte passe avant le domaine, qui reste un filet
  pour les messages internes AZMG.
- Consequence : deux renseignements a saisir par compte, dans Parametres, onglet « Comptes
  clients ». La saisie est indispensable, elle est donc signalee dans `docs/A_FOURNIR.md` et en
  tete de la mise en place de `docs/apps-script.md`.
- Effet de bord utile : l'adresse de la DO devient un signal deterministe de typage. Un envoi a la
  DO sans aucun mot de validation (« fw », « pour validation » absents) est reconnu comme une
  demande de validation, la ou les mots-cles echouaient.
- Retour arriere : `sensDuMessage` et `deduireInterlocuteur` concentrent la logique ; un compte sans
  adresses saisies retrouve exactement l'ancien comportement.

## 2026-11-12 : le perimetre de la collecte est la boite, ou un libelle

- Sujet : la collecte etait pensee pour une boite Gmail dediee, dont tout le contenu concernait le
  poste. Les mails ont d'abord ete ranges sous un libelle dans la boite du CEO, avant que le choix
  se porte sur une boite de suivi dediee (nommee dans `docs/A_FOURNIR.md`).
- Risque releve au passage : le script cherchait `(in:inbox OR in:sent)` sans condition. Installe
  sur une boite personnelle, il aurait pousse la totalite de cette boite, autres clients et
  courrier prive compris, vers la GPAO d'un seul compte client.
- Choix : un seul script, deux modes, par la constante `LIBELLE_SOURCE`. Vide, le script lit la
  boite de reception et les messages envoyes, ce qui convient a une boite dediee. Renseignee, il ne
  lit que ce libelle, un libelle par compte client, et **s'arrete** si le libelle est introuvable.
- Raison de garder les deux : la boite dediee est le cas le plus sur et c'est celui retenu, mais un
  deuxieme compte client peut tres bien arriver dans une boite partagee. Supprimer le mode libelle
  aurait rendu ce cas dangereux par defaut.
- Raison de l'arret sur libelle introuvable : un libelle mal orthographie rendait la recherche vide,
  ce qui ressemble a un « rien a collecter » normal. Mieux vaut une erreur visible dans le journal
  d'execution.
- Prerequis que l'application ne peut pas verifier : la boite doit recevoir la copie dans les deux
  sens. Une copie des seuls mails recus priverait la GPAO de tout ce que le poste envoie. Le point
  est inscrit dans `docs/A_FOURNIR.md` et dans le tableau de diagnostic du script.
- Ce que ni la boite ni le libelle ne filtrent, le typage le fait : infolettres, notifications
  d'outils et travail de la designer tombent en T00, hors perimetre.
- Retour arriere : la constante `LIBELLE_SOURCE` en tete du script.

## 2026-11-12 : le travail de la designer sort de T00 et prend ses familles

- Sujet : la designer est elle aussi placee chez le client, et son travail doit etre pilote. Le
  referentiel initial rangeait « marketing, design, travail de la designer » dans T00, hors
  perimetre, aux cotes du spam et des notifications systeme.
- Pourquoi c'etait ecrit ainsi : tant qu'un seul poste etait pilote, le travail de la designer etait
  hors du perimetre de l'assistante export. La regle protegeait la file de l'assistante, elle ne
  disait pas que ce travail n'avait pas de valeur.
- Options : garder T00 et montrer quand meme ces mails (ce qui polluait la file de l'assistante), ou
  distinguer ce qui est hors perimetre pour tout le monde de ce qui l'est pour un poste donne.
- Choix : T00 ne garde que ce qui est hors perimetre absolu (notifications systeme, infolettres,
  spam). Le travail de la designer prend trois familles a lui, `D01` publications et reseaux
  sociaux, `D02` visuels et supports, `D03` catalogue et contenus marketing, et son propre poste.
- Raison : c'est exactement ce que prevoit la section 0 de CLAUDE.md, « d'autres postes (designer,
  sales, SDR, comptable dedie) rejoindront la GPAO ensuite, sans refonte ». Le modele portait deja
  `postes` et `demandes.poste_id` : il n'y avait pas de refonte a faire, seulement un referentiel a
  corriger.
- Ce que la regle du perimetre strict devient : elle tient toujours, mais par poste. Un mail `D02`
  n'apparait pas dans la file de l'assistante export, un mail `T01` n'apparait pas dans celle de la
  designer, et `T00` n'apparait nulle part.
- Familles partagees et assumees : `T07` (BAT, etiquettes), `T09` (reporting quotidien) et `T13`
  (transferts a la DO) appartiennent aux deux metiers. Sur une famille partagee, le routage
  automatique ne choisit pas : il laisse le rattachement a la main plutot que de tirer au hasard.
- Mesure : le jeu temoin passe de 20 a 22 mails, familles de la designer comprises, et reste a
  86,4 %, au-dessus du critere de 85 %. Deux annotations que j'avais posees etaient incoherentes
  (la designer etait l'expediteur, et le sens disait « entrant ») : elles ont ete corrigees, et non
  les regles, pour ne pas regler le moteur sur le jeu temoin.
- Retour arriere : `FAMILLES_PAR_METIER` dans `src/shared/constantes.ts`, et les familles d'un poste
  restent modifiables dans Parametres.

## 2026-11-12 : les adresses appartiennent au poste, pas au compte

- Sujet : les adresses du poste avaient ete posees sur `comptes_clients` le matin meme, quand un
  seul poste etait suivi par compte.
- Ce que la realite a montre : deux collaborateurs sont suivis sur le meme compte, chacun avec sa
  propre adresse chez le client.
- Choix : `postes.adresses` et `postes.familles`, et `comptes_clients.adresses_poste` supprimee. La
  migration recopie la valeur du compte sur son premier poste, pour ne rien perdre.
- Consequence utile : l'adresse ne sert plus seulement a dire si un message part ou arrive, elle dit
  aussi **a quel poste** il appartient. L'adresse passe avant la famille dans ce choix, parce qu'une
  adresse est un fait et une famille un typage qui peut se tromper.
- Retour arriere : la migration `0004` est rejouable sur base vide, et un poste sans adresse
  retrouve le comportement par domaine.

## 2026-11-12 : une adresse du client peut etre ecartee avant tout traitement

- Sujet : une boite du client qui ne correspond a aucun poste suivi (une boite commerciale) recoit
  du courrier qui arrive dans la boite de suivi.
- Options : la laisser passer et compter sur le typage pour la ranger en T00, ou l'ecarter avant
  tout traitement.
- Choix : `comptes_clients.adresses_ignorees`. Un message qui ne concerne qu'elles n'est pas
  collecte du tout : ni evenement, ni dossier, ni demande. Le bilan de collecte les compte a part.
- Raison : T00 laisse une trace a lire, et c'est voulu pour un mail qui concerne le poste sans
  relever de son travail. Pour une boite qui n'est pas suivie, il n'y a rien a lire du tout : une
  trace serait du bruit, et le volume finirait par peser sur les indicateurs de flux.
- Garde-fou : la regle est prudente. Il suffit qu'une adresse d'un poste figure parmi l'expediteur
  ou les destinataires pour que le message soit collecte malgre tout. Un mail adresse a la fois a
  la boite commerciale et au poste reste du travail du poste.
- Retour arriere : une liste vide retablit exactement le comportement precedent.

## 2026-11-12 : une adresse l'emporte sur un mot-cle pour l'interlocuteur

- Sujet : un encadrant AZMG qui ecrit au poste etait classe d'apres le vocabulaire du message. Un
  dirigeant demandant un « tableau de situation » devenait ainsi la donneuse d'ordre, parce que
  cette demande vient habituellement d'elle.
- Choix : la deduction par adresse **ecrase** ce que les mots-cles avaient devine, dans cet ordre :
  l'adresse exacte de la DO d'abord, le domaine interne AZMG ensuite.
- Raison : une adresse est un fait, un mot-cle une inference. C'est le meme raisonnement que pour
  le sens d'un message, et il doit valoir pour l'interlocuteur.
- Effet secondaire a connaitre : un message dont la nature n'est que deduite du sens reste sous le
  seuil de confiance et part en « A classer », interlocuteur compris. Le typage se lit alors dans
  les justificatifs, sans etre pose sur l'evenement. C'est voulu : un classement faible se corrige
  a la main plutot que de s'appliquer d'office.
- Retour arriere : `deduireInterlocuteur` dans `src/server/modules/typage/regles.ts`.

## 2026-11-12 : le jeu de parcours part d'une application vide

- Sujet : `e2e/global-setup.ts` creait le compte client et le poste directement en SQL, « pour un
  demarrage rapide ».
- Ce que cela a coute : le premier ecran qu'un utilisateur voit, une application sans aucun compte,
  n'etait exerce par aucun test. Le manque, aucun moyen de creer un compte par l'interface, n'est
  apparu qu'a la premiere mise en ligne.
- Choix : la preparation ne cree plus que les comptes utilisateurs. Le premier parcours cree le
  compte client et ses postes **par l'interface**, et les suivants travaillent dessus.
- Cout assume : les parcours deviennent dependants de leur ordre, ce que `test.describe.configure({
  mode: 'serial' })` garantissait deja. Le premier parcours ajoute environ deux secondes.
- Benefice immediat : le second parcours est tombe des le premier essai, parce qu'un poste cree par
  l'interface n'etait rattache a aucun collaborateur. Le champ manquait dans le formulaire, et un
  poste sans rattachement n'apparait dans la file de personne.
- Regle a en tirer : tout raccourci de preparation qui court-circuite l'interface cache le chemin
  qu'il court-circuite. Quand un ecran est le seul moyen de faire une chose, un parcours doit passer
  par cet ecran.

## 2026-11-12 : le mot de passe initial est saisi, pas envoye

- Sujet : comment donner son premier mot de passe a un nouvel utilisateur depuis l'ecran Equipe.
- Options : envoyer un lien de reinitialisation par courriel, engendrer un mot de passe et
  l'afficher une fois, ou laisser l'administrateur le saisir.
- Choix : l'administrateur le saisit, et le transmet par un autre canal que le courriel.
- Raison : la reinitialisation par courriel existe, mais elle depend du SMTP, qui reste en mode
  simule tant que les identifiants ne sont pas fournis. Un mot de passe initial saisi a la main ne
  depend de rien et fonctionne des la mise en ligne. C'est la meme regle que partout ailleurs dans
  ce projet : ce qui est bloquant ne doit dependre d'aucune integration externe.
- Consequence : l'onglet « Mon compte » devient necessaire, et il a ete ajoute dans le meme
  mouvement. Sans lui, un mot de passe pose par l'administrateur serait definitif.
- Retour arriere : la route `POST /api/auth/mot-de-passe-oublie` est inchangee et prendra le relais
  des que le SMTP sera fourni.

## 2026-11-12 : /health dit l'etat des migrations, sans le faire echouer

- Sujet : apres une mise en ligne, rien ne permettait de verifier de l'exterieur que les migrations
  s'etaient appliquees. La question s'est posee des la premiere mise a jour, et la reponse ne
  pouvait etre qu'un raisonnement, pas une mesure.
- Pourquoi c'est le cas le plus trompeur : une application qui sert le bon code sur une base restee
  en arriere repond normalement. Le defaut n'apparait qu'au premier ecran qui touche une colonne
  absente, souvent longtemps apres, et loin de sa cause.
- Choix : `/health` publie `migrations` (attendues, appliquees, derniere, aJour). Le nom de la
  derniere migration est retrouve en rapprochant l'horodatage enregistre par Drizzle du journal du
  depot, la table ne stockant que l'empreinte du fichier SQL.
- Ce que le controle **ne fait pas** : il ne change pas le code de reponse. Une base en retard
  laisse `/health` a 200.
- Raison : `scripts/auto-deploy.sh` revient en arriere quand `/health` echoue. Faire echouer le
  controle sur un retard de migration rendrait le retour arriere automatique, ce qui est
  seduisant, mais un faux negatif ferait alors reculer une mise en ligne saine. Le signal est
  nouveau et n'a jamais tourne en production : on le regarde avant de lui confier une decision.
- Une erreur de lecture ne fait pas echouer le controle non plus : elle est rapportee dans
  `migrations.erreur`. L'information manque, elle n'est pas fausse.
- Un test verifie qu'aucun mot sensible n'apparait dans la reponse, `/health` etant public.
- Retour arriere : `src/server/lib/migrations.ts`, et le champ se retire du JSON sans toucher au
  reste.

## 2026-11-12 : script Apps Script adapte a o2switch (taille, anti-robots, encodage)

- Sujet : a la mise en service sur `suivimasenz@gmail.com`, la premiere version du script a echoue
  trois fois de suite, pour trois causes distinctes, aucune visible en developpement :
  `Limite depassee : Taille POST URLFetch` (50 messages avec pieces jointes dans un seul envoi),
  `307` (controle anti-robots d'o2switch par cookie `o2s-chl`), puis `401 Signature invalide`
  (signature calculee sur une chaine sans encodage fixe, alors que les mails contiennent des
  accents).
- Options pour le 307 : desactiver la « Securite par defaut » de TigerProtect sur le sous-domaine,
  ou faire passer le controle par le script. Choix : le script recupere le cookie et rejoue
  l'appel. Raison : aucun affaiblissement de la protection de l'hebergeur, et rien a reconfigurer
  si o2switch reinitialise ses regles.
- Taille : lots d'environ 12 millions de caracteres (marge sous les 25 Mo acceptes par le webhook),
  8 envois au plus par passage. Un message de plus de 10 Mo part sans ses pieces jointes, avec les
  memes en-tetes (dedoublonnage et rattachement au fil intacts) et la liste des pieces en fin de
  texte. Un fil n'est etiquete « GPAO traite » qu'une fois tous ses messages acceptes.
- Signature : la charge est encodee une seule fois en UTF-8 ; ces octets sont a la fois signes et
  envoyes. Aucun changement cote serveur.
- Resultat : premier passage reussi le 12/11/2026, 45 messages envoyes, 38 evenements enregistres
  apres dedoublonnage.
- Retour arriere : le script de `docs/apps-script.md` est autonome ; l'ancienne version reste dans
  l'historique Git, mais elle ne fonctionne pas derriere o2switch.
