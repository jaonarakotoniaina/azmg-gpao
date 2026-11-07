# Connecteur Claude de la GPAO

Sur le modele du connecteur d'AZMG Sourcing. Il donne a une conversation claude.ai un acces direct
au pilotage du poste : lire la file du jour, retrouver un dossier, enregistrer un evenement,
changer un statut, preparer le reporting.

## Ce que Claude peut faire

### Lecture

| Outil | Effet |
|---|---|
| `file_du_jour` | demandes ouvertes triees par urgence, avec age, attente dans le statut, delai cible depasse et echeance proche |
| `chercher_dossier` | retrouve un dossier par client, produit, pays ou operation |
| `fiche_dossier` | identification, references, montants approuves, demandes avec leurs delais, echeances, chronologie |
| `echeances_a_venir` | cut-off, departs et arrivees prevus, validites d'offre, expirations, creneaux d'entrepot |
| `indicateurs` | flux, stock, delais, respect du delai cible, attente par acteur, charge estimee, comparaison a la periode precedente |
| `a_classer` | evenements dont le typage automatique est sous le seuil de confiance |
| `exporter_reporting` | prepare les lignes du reporting quotidien d'un jour donne, en texte a relire |

### Ecriture

| Outil | Effet |
|---|---|
| `creer_demande` | ouvre une demande dans un dossier existant, ou cree le dossier a la volee |
| `ajouter_evenement` | enregistre un mail, une consigne, une note ou une reponse, et fait avancer la demande selon la nature |
| `changer_statut` | change le statut d'une demande, avec transition horodatee et temps comptabilise |
| `corriger_typage` | corrige la famille, la nature, le sens ou l'interlocuteur d'un evenement mal classe |

Ces outils appellent les memes fonctions que les boutons de l'application, avec les memes regles de
validation, au nom du compte `AZMG_MCP_UTILISATEUR` (sinon le premier administrateur actif).

## Garde-fous

- **Aucun outil n'envoie de message.** Ni au client, ni au transitaire, ni a la donneuse d'ordre.
  `exporter_reporting` rend un texte a relire ; l'ecriture dans le classeur se fait dans
  l'application, ecran Export, avec le classeur de l'utilisateur.
- **Le hors perimetre reste hors perimetre.** La famille T00 n'est lue par aucun outil, et toute
  tentative de l'ecrire (creation de demande ou correction de typage) est refusee.
- **Restent dans l'application** : les parametres, la gestion des comptes utilisateurs, l'import et
  l'export de classeur, la notation du controle qualite.
- **Chaque ecriture laisse une trace.** Le journal des actions enregistre l'auteur `claude`, et les
  transitions de statut portent la meme marque, visible dans la chronologie du dossier.
- **Rien n'est invente.** Les instructions du connecteur demandent explicitement de ne rien affirmer
  qui ne figure pas dans la fiche, et de ne jamais reprendre une appreciation du client sur le
  collaborateur : seuls l'etat factuel du dossier et l'action qui debloque sont manipules.

## Installation, une seule fois

1. **Serveur.** Creer une cle longue et aleatoire (32 caracteres minimum), par exemple avec
   `openssl rand -hex 32` dans le terminal cPanel. L'ajouter a `~/azmg-gpao/shared/.env` :

   ```
   AZMG_MCP_TOKEN=<la cle>
   AZMG_MCP_UTILISATEUR=<email de votre compte administrateur>
   ```

   Redemarrer l'application : `touch ~/azmg-gpao/app/tmp/restart.txt`, ou cPanel, *Setup Node.js App*,
   Restart. Sans cette cle, l'adresse `/mcp` repond « non configure » et reste fermee.

2. **claude.ai.** Reglages, Connecteurs, « Ajouter un connecteur personnalise » :
   - Nom : `AZMG GPAO`
   - URL : `https://gpao.intranet.azmg-solutions.com/mcp`
   - Authentification : « No sign in »
   - En-tetes de requete : nom `Authorization`, valeur `Bearer <la cle>`

3. **Conversation.** Activer le connecteur « AZMG GPAO » dans le menu des outils de la conversation
   ou du projet de pilotage.

La cle ne va jamais dans le depot ni dans une conversation. Pour la changer : nouvelle cle dans
`.env`, redemarrage, puis mise a jour de l'en-tete dans claude.ai.

## Diagnostic

`/health` expose `mcp` : connecteur configure ou non, et les 15 derniers appels recus (methode,
reponse, forme de l'en-tete d'autorisation, **jamais la cle**). Si claude.ai dit
« Impossible de joindre » :

| Ce que montre `/health` | Ce qu'il faut faire |
|---|---|
| `configure: false` | la cle n'est pas dans `shared/.env`, ou l'application n'a pas ete redemarree |
| aucun appel dans le journal | la requete est bloquee avant l'application (DNS, certificat, pare-feu) |
| « en-tete absent » | l'en-tete de requete n'a pas ete saisi dans claude.ai |
| « sans Bearer » | l'en-tete est mal ecrit : il faut `Bearer ` puis la cle |
| « jeton refuse » avec une longueur differente | la cle collee dans claude.ai n'est pas celle du `.env` |

Les adresses de decouverte OAuth (`/.well-known/...`) repondent 404 en JSON : l'application n'a pas
d'OAuth, et claude.ai ne doit pas croire le contraire.

## Exemples de conversation

> « Qu'est-ce qui attend la DO depuis le plus longtemps ? »
> Claude appelle `indicateurs`, lit `attentes_do_longues`, et repond avec le temps d'attente de chacune.

> « Le transitaire a repondu sur le dossier LAM, prix confirme a 2 400 euros. »
> Claude appelle `chercher_dossier` pour retrouver le dossier, puis `ajouter_evenement` avec la
> nature « Reponse du tiers » : la demande repasse automatiquement en cours, cote poste.

> « Prepare le reporting d'hier. »
> Claude appelle `exporter_reporting` et rend les lignes a relire. L'ecriture dans le classeur se
> fait ensuite dans l'application.

## Fichiers

| Element | Fichier |
|---|---|
| Outils et protocole MCP (JSON-RPC, reponses JSON) | `src/server/modules/mcp/service.ts` |
| Route `/mcp`, controle de la cle, journal des appels | `src/server/modules/mcp/routes.ts` |
| Tests | `tests/mcp.test.ts` |
