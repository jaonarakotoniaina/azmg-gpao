# Guide utilisateur

Une page par role, en francais simple. L'adresse de l'application est
`https://gpao.intranet.azmg-solutions.com`.

Deux idees a retenir avant de commencer :

- **Le travail se compte en demandes, pas en mails.** Une demande est un travail a faire dans un
  dossier : obtenir une cotation, faire valider une proforma, relancer un solde. Un mail, une
  consigne WhatsApp ou un vocal sont des **evenements** qui ouvrent, font avancer ou cloturent une
  demande.
- **Les delais se comptent en heures ouvrees du client.** Une journee vaut 9 heures. Le week-end,
  les jours feries espagnols et les ponts ne comptent pas. Un dossier laisse le vendredi soir et
  repris le lundi matin n'a pas pris trois jours de retard : il a pris quelques minutes.

---

## Se reperer dans la GPAO

Sept entrees dans la barre de gauche, une par moment de la journee. Chacune regroupe plusieurs
pages, en onglets :

| Entree | Onglets |
|---|---|
| File du jour | Ma file, A classer, Echeances |
| Saisie rapide | (une seule page) |
| Dossiers | Dossiers, Suivi des demandes |
| Brouillons | Brouillons, Digest de validation |
| Pilotage | Tableau de bord, Par collaborateur, Qualite |
| Imports et exports | Import des mails, Import du classeur, Export du reporting |
| Parametres | (une seule page) |

Le chiffre a droite de « File du jour » compte les messages qui attendent d'etre classes. Chaque
page garde son adresse propre : un lien vers le suivi des demandes ouvre le groupe « Dossiers »
sur le bon onglet.

---

## Collaborateur ou collaboratrice sur un poste

Vous voyez vos comptes clients, vos dossiers et votre file. Vous saisissez et vous corrigez.

### Votre journee type

1. **Ouvrir la file du jour.** C'est la page d'accueil. Les demandes sont triees par urgence :
   d'abord celles dont le delai cible est depasse, puis celles dont une echeance tombe dans les
   deux jours, puis par priorite, puis par anciennete. Vous traitez du haut vers le bas.
2. **Lire les quatre compteurs en haut.** Demandes ouvertes, delai cible depasse, echeance proche,
   et ce qui attend la donneuse d'ordre.
3. **Traiter une demande.** Le menu « Changer de statut » de chaque carte fait l'essentiel sans
   quitter la file. Pour le detail, cliquez sur l'objet de la demande.

### Enregistrer ce qui arrive : la saisie rapide

Des qu'une consigne arrive par WhatsApp, par vocal ou par mail, ouvrez **Saisie rapide**. L'ecran
tient en une page, y compris sur telephone, et l'enregistrement prend moins de 30 secondes.

1. **Le dossier.** Tapez deux ou trois lettres du client ou du produit : les dossiers existants
   apparaissent, cliquez sur le bon. Si le dossier n'existe pas, cochez « Creer un nouveau
   dossier » et renseignez le client, le pays, le produit et l'operation. Si un dossier identique
   existe deja, il est repris, aucun doublon n'est cree.
2. **Ce qui s'est passe.** Un objet court, la famille, et surtout la **nature** : c'est elle qui
   fait avancer la demande. L'effet attendu s'affiche en bas de l'ecran avant que vous validiez.
3. **Enregistrer.** Le compte et le dossier restent selectionnes pour enchainer une deuxieme
   saisie sur le meme dossier.

### Les natures et ce qu'elles font

| Vous saisissez | Ce qui se passe |
|---|---|
| Demande entrante | une demande s'ouvre au statut Nouveau |
| Consigne de la DO | une demande s'ouvre, le travail est chez vous |
| Envoi de livrable | la demande passe en attente du destinataire, le chrono change de camp |
| Demande de validation a la DO | la demande passe en attente DO |
| Validation ou refus de la DO | la demande revient chez vous |
| Relance emise | le niveau de relance passe a N1, puis N2, puis N3 |
| Relance recue | le tiers s'impatiente, la demande revient chez vous |
| Reponse du tiers | la demande revient chez vous |
| Information, accuse | rien ne change, l'evenement est seulement trace |

### Ce qui ne doit pas entrer dans la GPAO

- **Les mails hors perimetre** (marketing, design, notifications systeme, spam) sont la famille
  T00. Ils ne figurent pas dans la liste des familles de la saisie rapide, et l'application refuse
  de les enregistrer comme une demande. C'est voulu : votre charge de travail ne doit pas etre
  gonflee par ce qui ne releve pas du poste.
- **Les appreciations du client sur votre travail** ne sont jamais saisies. Dans une note ou un
  resume, decrivez l'etat du dossier et l'action qui debloque, pas ce que le client a pense. La
  GPAO sert a piloter des dossiers, pas a vous noter.

### La file « A classer »

Elle se trouve dans « File du jour », onglet « A classer ».

Quand un message arrive, l'application essaie de le classer toute seule : famille, nature,
interlocuteur. Elle y arrive dans la grande majorite des cas. Quand elle n'est pas assez sure,
elle ne devine pas : le message part dans **A classer** et vous attend.

Pour chaque message, vous voyez l'indice de confiance et la raison du classement propose. Vous
choisissez la bonne famille, la bonne nature, et vous cliquez sur Classer.

Chaque correction **propose une regle** pour les prochains messages du meme genre. Cette regle ne
classe rien tant qu'un manager ou un administrateur ne l'a pas acceptee, dans l'onglet « Regles
proposees » : une regle tiree d'un seul message se trompe souvent, et une mauvaise regle fausserait
silencieusement toute la file du jour.

Plus vous corrigez, moins il y a a corriger.

### La fiche dossier

Elle montre toute l'histoire d'une operation : la chronologie (evenements, changements de statut,
echeances, pieces), les demandes avec leur delai, et les echeances a venir. La zone **Note
interne** sert a consigner un point factuel qui n'est pas un evenement.

### L'ecran « Brouillons »

Chaque matin, avant votre journee, l'application prepare des textes a votre place et les depose
dans cet ecran. Elle n'envoie rien, jamais. Vous relisez, vous copiez, vous envoyez vous-meme
depuis votre messagerie, ce qui garde le fil de discussion dans votre boite.

Ce que vous y trouvez :

- **Les relances.** Une par point qui attend un tiers ou la donneuse d'ordre depuis trop
  longtemps. Le niveau (N1, N2 ou N3) vient du temps d'attente en heures ouvrees du client, et le
  texte est redige dans la langue de votre interlocuteur, avec les dates des echanges qui le
  justifient.
- **Le reporting de la veille**, deja redige dossier par dossier, a recopier dans le classeur ou
  a comparer avec ce que vous auriez ecrit. L'ecriture dans le classeur, elle, se fait dans
  l'ecran « Export du reporting ».
- **L'onglet de la semaine**, le lundi, avec les chiffres de la semaine ecoulee.
- **Les tableaux de situation par client**, a preparer quand vous voulez : tapez le nom du client
  dans le champ « Situation d'un client ». Chaque dossier y figure avec son statut au format du
  reporting client et sa prochaine echeance.
- **Les comparatifs de cotations fret**, construits depuis les offres recues sur un dossier.

Trois choses a savoir :

1. **Chaque brouillon cite ses sources.** Cliquez sur « Lire » : sous le texte, l'application
   indique combien d'evenements l'ont nourri, et un lien mene a la demande. Si une phrase vous
   surprend, remontez a l'evenement.
2. **Les cases vides d'un comparatif sont voulues.** L'application ne lit que ce qui est ecrit
   dans les offres ; elle ne devine aucun prix. Une ligne du brouillon vous dit combien d'offres
   n'avaient pas de prix lisible, a vous de les completer en regardant le mail.
3. **Deux boutons seulement.** « Je l'ai envoye » quand c'est parti de votre messagerie,
   « Ecarter » quand le brouillon ne sert pas. Dans les deux cas, rien n'est envoye par
   l'application, et la decision est tracee une seule fois.

Si l'ecran est vide, c'est que rien n'attend : la preparation tourne chaque jour a partir de 6 h.
Le bouton **Preparer maintenant** la relance a la demande, sans jamais creer de doublon.

---

## Manager de compte

Vous pilotez un ou plusieurs comptes clients. Vous voyez tout sur vos comptes.

### Ce que vous surveillez

- **La file du jour, sans filtre de poste.** Vous voyez les demandes de tous les postes de vos
  comptes. Le bouton « A risque seulement » ne garde que ce qui est en retard ou proche d'une
  echeance.
- **Le filtre « Acteur attendu ».** Choisissez « la DO » pour voir d'un coup tout ce qui attend une
  decision du client, avec depuis combien de temps. C'est la liste a reprendre en point
  hebdomadaire.
- **L'echeancier.** Cut-off, departs et arrivees prevus, validites d'offre, expirations de
  document. Les echeances a deux jours ou moins sont signalees en orange, celles du jour et les
  depassees en rouge.

### Le tableau de bord

Quatre blocs, tous comptes en heures ouvrees du client.

- **Synthese** : demandes entrees, terminees, stock ouvert, et combien depassent leur delai cible.
  Chaque chiffre est compare a la periode precedente de meme duree. Un delai qui baisse s'affiche
  en vert, un volume qui monte reste neutre : plus d'activite n'est en soi ni bon ni mauvais.
- **Delais des demandes terminees** : premiere reponse et delai total en mediane, part des demandes
  terminees dans leur cible, age moyen du stock.
- **Ou attend le temps** : la repartition de l'attente entre le poste, la DO, le client et les
  tiers. C'est le graphique a montrer quand il faut expliquer pourquoi un dossier a pris du temps.
- **Charge estimee par famille** : volume multiplie par le temps standard, converti en jours
  ouvres, avec le delai median et le respect de la cible famille par famille.

### Le digest de validation

La page **Digest de validation** rassemble tout ce qui attend la donneuse d'ordre, avec le temps
d'attente de chaque decision et les elements utiles pour trancher (references du dossier, montants
deja approuves, echeances). Le bouton copie un brouillon pret a relire.

**L'application n'envoie rien.** Vous relisez, vous corrigez si besoin, puis vous envoyez
vous-meme par le canal habituel. C'est la regle d'or : l'IA prepare, l'humain envoie.

### La qualite

Deux choses y vivent.

- **L'echantillon hebdomadaire.** Chaque semaine, une part des envois du poste est tiree au sort
  (10 % par defaut, reglable dans les Parametres) et attend une note. Le bouton de tirage peut etre
  relance autant de fois que voulu : il complete l'echantillon, il ne le double jamais.
- **Les indicateurs** : note moyenne, taux de reprise, part des documents valides par la DO sans
  correction, part des envois conformes aux check-lists, et la liste des points de check-list les
  plus souvent manques. C'est cette derniere liste qui dit sur quoi porter l'effort.

### L'import des mails

Quand la boite de suivi est branchee, les mails arrivent tout seuls : ils sont classes, rattaches
a leur fil, et font avancer les demandes sans aucune saisie. Un mail de demande de validation
envoye a la DO passe la demande en attente DO ; sa reponse la fait repasser en cours.

L'ecran **Import des mails** sert a reprendre l'historique anterieur a la mise en place. Il accepte
des fichiers `.eml` et `.mbox` : dans Gmail, l'export passe par Google Takeout.

Vous pouvez importer deux fois le meme fichier sans crainte : chaque message porte un identifiant
unique, et un message deja connu n'est jamais enregistre deux fois. Le bilan vous dit combien ont
ete enregistres et combien etaient deja la.

### L'export du reporting

La page **Export du reporting** complete votre classeur `SUIVI_MENSUEL` :

1. choisissez le compte et les jours a ecrire ;
2. l'apercu montre exactement ce qui ira dans chaque colonne (C, F, G, H, I) ;
3. deposez votre classeur, et telechargez la copie completee.

Un bloc est ajoute par jour : ligne vide, en-tete recopiee, puis les lignes de donnees, une par
dossier au dernier etat connu. La structure de votre classeur n'est pas touchee : colonnes,
en-tetes, noms d'onglets, mise en forme et formules ressortent intacts. Votre fichier d'origine
n'est ni conserve ni ecrase sur le serveur.

Si vous cochez « Remplir aussi l'onglet de la semaine », l'onglet « sem N » doit exister dans le
classeur. S'il manque, l'export s'arrete et vous dit quels onglets il a trouves, plutot que
d'ecrire au mauvais endroit.

### Ce que vous lisez sur une demande

La fiche demande donne le delai total, le delai de premiere reponse compare a la cible de la
famille, et surtout le **temps par acteur** : combien de temps le dossier a attendu chez le poste,
chez la donneuse d'ordre, chez le client, chez un tiers. C'est ce tableau qui permet de dire, avec
des chiffres, ou se perd reellement le temps.

### L'ecran « Suivi des demandes »

C'est le tableau que vous teniez dans le classeur, rendu par la GPAO. Une ligne par demande, avec
la date **et l'heure**, la priorite, le statut, le type, le sujet, la demande telle qu'elle a ete
ecrite, l'action attendue, la cause d'une reprise, et le delai compte en heures ouvrees du client.

Deux reperes a connaitre :

- **La fleche au bout de la ligne** ouvre le mail d'origine dans la boite de suivi. Elle n'apparait
  que si la GPAO connait l'adresse du message ; sinon il n'y a pas de lien, plutot qu'un lien qui
  ouvrirait sur rien.
- **« deduite, a relire »** sous une action veut dire que la GPAO l'a deduite du message et du
  referentiel, parce que la routine IA n'a pas encore relu ce message. L'action est utilisable,
  elle merite un coup d'oeil. La mention disparait quand la routine passe.

### L'ecran « Pilotage »

La question a laquelle il repond : **est-ce que ca s'ameliore ?** Choisissez un poste, et vous
avez quatre indicateurs, chacun avec sa courbe semaine apres semaine :

| Indicateur | Ce qu'il dit |
|---|---|
| Reclamations | combien de fois il a fallu revenir sur un travail, par semaine |
| Taux de recidive | la part de ces reprises qui tombent sur un dossier ou une cause deja vus |
| Delai moyen de cloture | le temps pour clore une demande, en heures ouvrees du client (la mediane est a cote : un ecart entre les deux signale une demande oubliee qui tire la moyenne) |
| P1 en retard | les demandes de priorite haute encore ouvertes au-dela de leur delai cible |

Sur la courbe, le trace gris est le passe, le point violet la semaine en cours. Les valeurs
exactes s'affichent au survol et dans le tableau en dessous. Avec une seule semaine observee, il
n'y a pas de courbe : l'ecran le dit, plutot que de tracer une pente qui n'existe pas.

Lisez les **causes** avant la courbe : avec peu de semaines, c'est le chiffre le plus solide de
l'ecran, et c'est lui qui dit sur quoi travailler. La section « Priorites a recalibrer » ne modifie
rien : elle signale les demandes marquees haute sans echeance proche, parce qu'une priorite portee
par tout le monde ne trie plus rien.

C'est cet ecran qui sert au point de fin de periode : la pente entre deux semaines vaut mieux
qu'une impression.

### Importer le classeur de suivi

L'ecran **Import du classeur** lit l'onglet « Suivi Quotidien » d'un classeur `SUIVI_MENSUEL` et
cree les dossiers avec leur dernier etat connu.

- Il lit le client (colonne C), le produit (F) et le statut en fin de description (G).
- Il ne cree **aucune demande** : le classeur ne dit ni la famille ni la nature, et la GPAO
  n'invente pas de donnee. Les demandes naissent de la saisie rapide.
- Il peut etre relance autant de fois que voulu : un dossier deja connu est mis a jour, jamais
  duplique. Un dossier que le poste a deja ouvert pour le meme client et le meme produit est repris
  tel quel.
- Le bilan indique les lignes lues, les dossiers crees, ceux mis a jour, et les lignes ecartees
  avec leur raison, pour corriger le classeur si besoin.

Le classeur n'est pas conserve sur le serveur : seul le bilan de l'import l'est.

---

## Administrateur (CEO)

Vous avez acces a tous les comptes, a tous les postes et aux parametres.

### Les parametres

L'ecran **Parametres** a quatre onglets.

- **Referentiels** : les 15 familles avec la validation humaine qui existe deja cote client, leur
  temps standard et leur **delai cible**, que vous pouvez modifier ; la correspondance exacte entre
  les statuts de la GPAO et les cinq statuts du reporting client ; l'effet de chaque nature.
- **Delais et horaires** : les horaires ouvres du client, le seuil au-dela duquel une attente DO
  est signalee, les delais de relance N1, N2 et N3, l'heure de preparation du reporting quotidien,
  le seuil de confiance du typage automatique et la part des envois tiree au sort pour le controle
  qualite.
- **Comptes clients** : creer un compte client, creer ses postes (un par collaborateur suivi, avec
  son metier, ses adresses et le collaborateur a qui il est rattache), et renseigner l'adresse de
  la donneuse d'ordre ainsi que les adresses du client a ne pas suivre. C'est le premier ecran a
  remplir sur une installation neuve : tant qu'aucun compte n'existe, le reste de l'application
  est vide.
- **Automatisations** : un interrupteur par automatisation et un interrupteur general. Le mode
  « brouillon » prepare un texte pret a relire, il **n'envoie rien**. Couper l'interrupteur
  « Preparation des relances » arrete leur preparation du matin sans toucher au reste ;
  l'interrupteur general met en pause toute la preparation, ce qui est la bonne manoeuvre pendant
  une fermeture du client ou une semaine de conges du poste. Dans les deux cas, les brouillons
  deja prepares restent lisibles dans leur ecran.
- **Equipe** : creer un compte utilisateur, changer un role, desactiver ou reactiver un compte. La
  desactivation ferme les sessions ouvertes de la personne. Un administrateur ne peut pas retirer
  ses propres droits.
- **Mon compte** : changer son propre mot de passe. Cet onglet est visible par tous les roles.

Pour verifier qu'une mise a jour est bien arrivee en ligne, ouvrir `/health` : la page indique la
version servie et si la base est a jour. La marche a suivre est dans le `README.md`.

### Les roles

| Role | Ce qu'il voit | Ce qu'il peut faire |
|---|---|---|
| Administrateur | tous les comptes | tout, y compris les parametres et les comptes utilisateurs |
| Manager de compte | les comptes qu'il pilote | tout sur ses comptes, y compris l'import |
| Collaborateur | les comptes ou il tient un poste | sa file, ses dossiers, la saisie et la correction |
| Client (lecture seule) | les comptes ou il est declare | lecture seule, desactive par defaut |

### Le connecteur Claude

Une conversation claude.ai peut lire la file du jour, retrouver un dossier, enregistrer un
evenement et preparer le reporting, sans passer par l'ecran. L'installation se fait une fois, elle
est decrite dans `docs/connecteur-claude.md`.

Ce que le connecteur ne peut pas faire, par construction : envoyer un message a qui que ce soit,
toucher aux parametres, ecrire dans un classeur, ou faire entrer du hors perimetre dans le
pilotage. Chacune de ses ecritures porte la marque « claude » dans la chronologie du dossier.

### La regle d'or

**L'IA prepare, l'humain envoie.** Aucun mail ne part automatiquement vers un client, un
transitaire ou la donneuse d'ordre. Les relances, le digest de validation et le reporting quotidien
sont prepares en brouillon et attendent une relecture. L'interrupteur general des Parametres coupe
toute preparation automatique.

### La confidentialite

- Les donnees du client (prix, clients finaux, documents, echanges) ne sortent pas de
  l'application. Le depot de code, les tests et les donnees de demonstration ne contiennent que
  des donnees fictives.
- Les mails hors perimetre (T00) sont traces mais n'apparaissent dans aucune vue de pilotage ni
  dans aucun export.
- Les appreciations du client sur un collaborateur ne sont jamais extraites ni stockees en champ
  structure.
- Chaque action laisse une trace dans le journal : qui, quoi, quand. Les actions passees par le
  connecteur Claude y sont signees « claude ».

### Si quelque chose ne va pas

- Le bandeau « Mode simule » en haut de l'ecran indique les integrations qui tournent encore a
  vide. Le detail est dans `docs/A_FOURNIR.md`.
- `https://gpao.intranet.azmg-solutions.com/health` repond `ok` si l'application et la base vont
  bien, et indique la version deployee.
- En cas d'echec de deploiement, la version precedente est remise en ligne automatiquement et une
  alerte part par email.
