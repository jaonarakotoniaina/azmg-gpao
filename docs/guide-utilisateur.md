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

### La fiche dossier

Elle montre toute l'histoire d'une operation : la chronologie (evenements, changements de statut,
echeances, pieces), les demandes avec leur delai, et les echeances a venir. La zone **Note
interne** sert a consigner un point factuel qui n'est pas un evenement.

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

### Ce que vous lisez sur une demande

La fiche demande donne le delai total, le delai de premiere reponse compare a la cible de la
famille, et surtout le **temps par acteur** : combien de temps le dossier a attendu chez le poste,
chez la donneuse d'ordre, chez le client, chez un tiers. C'est ce tableau qui permet de dire, avec
des chiffres, ou se perd reellement le temps.

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
- **Automatisations** : un interrupteur par automatisation et un interrupteur general. Le mode
  « brouillon » prepare un texte pret a relire, il **n'envoie rien**.
- **Equipe** : la liste des comptes utilisateurs et leur role.

### Les roles

| Role | Ce qu'il voit | Ce qu'il peut faire |
|---|---|---|
| Administrateur | tous les comptes | tout, y compris les parametres et les comptes utilisateurs |
| Manager de compte | les comptes qu'il pilote | tout sur ses comptes, y compris l'import |
| Collaborateur | les comptes ou il tient un poste | sa file, ses dossiers, la saisie et la correction |
| Client (lecture seule) | les comptes ou il est declare | lecture seule, desactive par defaut |

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
