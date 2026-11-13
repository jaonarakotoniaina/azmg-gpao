# A fournir

Ce que le commanditaire doit fournir pour passer du mode simule au mode reel, par ordre de priorite.
Tant qu'un element manque, l'adaptateur correspondant tourne en mode `mock` et l'application
fonctionne entierement (regle de la section 2.3 de CLAUDE.md).

## 1. Mise en ligne sur o2switch (bloquant pour le deploiement, pas pour le developpement)

| Element | Variable ou emplacement | Etat |
|---|---|---|
| Base PostgreSQL `azmg_gpao` sur le serveur o2switch, avec son utilisateur | `DATABASE_URL` | a fournir |
| Secret de session, 32 caracteres minimum | `SESSION_SECRET` | a fournir |
| Sous-domaine `gpao.intranet.azmg-solutions.com` et son certificat | cPanel | a creer |
| Application Node cPanel (« Setup Node.js App »), fichier de demarrage `app.js` | cPanel | a creer |
| Jeton GitHub en lecture seule pour le contenu du depot | `~/.azmg-github-token` | a creer |
| Adresse de reception des alertes de deploiement | `ALERT_EMAIL` | a confirmer |

La procedure pas a pas est dans `README.md`.

## 2. Collecte des mails du poste (phase 4)

| Element | Variable ou emplacement | Etat |
|---|---|---|
| Boite Gmail dediee recevant la copie des mails du poste | compte Google | **fournie** : `suivimasenz@gmail.com` |
| Copie des mails du poste dans les **deux sens**, recus et envoyes | regle de copie cote Masenz | **a verifier une fois** |
| Adresses de chaque poste suivi | Parametres, onglet « Comptes clients » | **a saisir**, voir ci-dessous |
| Adresse de la donneuse d'ordre | Parametres, onglet « Comptes clients » | **a saisir**, voir ci-dessous |
| Adresses du client a ne pas suivre | Parametres, onglet « Comptes clients » | **a saisir**, voir ci-dessous |
| Secret partage du webhook Apps Script | `APPS_SCRIPT_SECRET` | **fourni** |
| Ou, a defaut : acces IMAP de la boite | `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_FOLDER` | a fournir |

Sans ces elements, `COLLECTE_MAIL` reste en `mock` : la GPAO vit de la saisie rapide et de
l'import de fichiers `.eml` ou `.mbox`, qui fonctionne sans aucun acces a la boite.

**Les adresses sont indispensables.** Un collaborateur ecrit depuis une adresse du client, sur le
meme domaine que la donneuse d'ordre. Sans elles, la GPAO lit tout ce qu'il envoie comme du courrier
recu : aucune demande ne passe en attente DO et le digest de validation reste vide. Elles servent
aussi a ranger chaque message sur le bon poste quand le compte en porte plusieurs. Elles se
saisissent dans l'ecran Parametres, pas dans le depot : ce sont des donnees du client.

**Un poste par collaborateur suivi.** Le compte Masenz porte deux postes : l'assistante export et la
designer. Chacun a son intitule, son metier, ses adresses et son perimetre de familles. Le travail
de la designer n'apparait donc pas dans la file de l'assistante export, et inversement.

**Les adresses a ne pas suivre arretent la collecte avant tout traitement.** Une boite du client qui
ne correspond a aucun poste suivi (une boite commerciale, par exemple) y figure : ses messages ne
creent ni evenement, ni dossier, ni demande, et le bilan de collecte les compte a part. La regle est
prudente : il suffit qu'une adresse d'un poste figure parmi l'expediteur ou les destinataires pour
que le message soit collecte malgre tout. Un mail adresse a la fois a la boite commerciale et au
poste reste donc du travail du poste.

**Un encadrant AZMG n'est pas la donneuse d'ordre.** Un message venu d'un domaine interne AZMG est
reconnu comme tel a son seul domaine, et ce signal l'emporte sur le vocabulaire : un dirigeant qui
demande un tableau de situation n'est pas classe comme une consigne du client.

**La boite dediee delimite le perimetre.** Le script tourne sur `suivimasenz@gmail.com`, qui ne sert
qu'au suivi de ce compte : la constante `LIBELLE_SOURCE` reste vide et le script lit la boite de
reception et les messages envoyes. Le mode « libelle » reste disponible pour une boite partagee, il
est decrit dans [`docs/apps-script.md`](apps-script.md).

**Un point a verifier avant la mise en service** : la boite doit recevoir une copie des mails du
poste dans les deux sens. Une regle qui ne copierait que les mails recus priverait la GPAO de tout
ce que le poste envoie, et donc de toute demande de validation. C'est le seul prerequis que
l'application ne peut pas constater elle-meme.

Ce qui arrive dans la boite sans concerner le poste est classe T00 et reste hors de toutes les vues
de pilotage et de tous les exports.

La mise en place du script Google est decrite pas a pas dans
[`docs/apps-script.md`](apps-script.md). Elle ne demande ni mot de passe d'application, ni
ouverture de port : seul le secret partage circule, et encore, jamais en clair.

## 3. Envoi des emails (brouillons et notifications internes)

| Element | Variable | Etat |
|---|---|---|
| Serveur SMTP o2switch et identifiants | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | a fournir |
| Adresse d'expedition | `SMTP_FROM` | a confirmer (propose : `gpao@azmg-solutions.com`) |

Rappel de la regle d'or : aucun mail ne part automatiquement vers un client, un transitaire ou la
DO. Le SMTP ne sert qu'aux notifications internes et a la reinitialisation de mot de passe.

## 4. IA integree (phase 3)

| Element | Variable | Etat |
|---|---|---|
| Jeton de l'API agent, pour la routine Claude Code | `AGENT_API_TOKEN` | a generer |
| Identifiant et jeton de la routine Claude Code | `CLAUDE_ROUTINE_ID`, `CLAUDE_ROUTINE_TOKEN` | a generer |
| Cle API Anthropic, seulement si un traitement instantane est voulu | `ANTHROPIC_API_KEY` | facultatif, cout API |

Le mode par defaut en production est `agent` : aucun cout API recurrent.

**Ce que l'absence de routine coute aujourd'hui.** La tache `synthetiser_demande` remplit quatre
colonnes du tableau de suivi au fil de la collecte : l'action qui debloque, le type, la priorite et
la cause d'une reprise. Ce sont les quatre colonnes que le manager remplissait a la main dans son
classeur.

Sans la routine, ces colonnes **ne sont plus vides** : des regles deterministes les remplissent a
l'arrivee du message, et le tableau affiche « deduite, a relire » sous l'action. L'action est alors
la phrase de demande du message, citee telle quelle, ou le travail que la famille designe dans le
referentiel, suivi de l'objet. Rien n'est invente, mais rien n'est lu finement non plus : une
consigne enroulee dans un long message passe a cote.

La routine apporte donc la finesse, et elle remplace les colonnes deduites des qu'elle repond,
sans jamais toucher a une ligne posee a la main ou venue de l'import. C'est une amelioration, plus
un prerequis.

Trois gestes, dans cet ordre :

1. Generer `AGENT_API_TOKEN` (`openssl rand -hex 32`) et l'ajouter au `.env` de production, comme
   cela a ete fait pour `APPS_SCRIPT_SECRET`. Redemarrer : `touch ~/azmg-gpao/app/tmp/restart.txt`.
2. Creer une tache planifiee Claude Code, frequence horaire, et y coller l'instruction de
   [`docs/agent-ia.md`](agent-ia.md), section « Instruction prete a coller dans la routine ».
3. Verifier au passage suivant : dans l'ecran « Suivi des demandes », la mention « deduite, a
   relire » doit avoir disparu sous les actions des demandes nouvellement arrivees.

## 5. Connecteur Claude (phase 2)

| Element | Variable | Etat |
|---|---|---|
| Cle du connecteur MCP, 32 caracteres minimum | `AZMG_MCP_TOKEN` | a generer |
| Compte au nom duquel le connecteur agit dans le journal | `AZMG_MCP_UTILISATEUR` | a choisir |

## 6. Contenus metier

| Element | Pourquoi | Etat |
|---|---|---|
| Un classeur `SUIVI_MENSUEL_MASENZ_JJ-MM.xlsx` reel, ou une copie anonymisee | valider l'import et l'export sur la vraie mise en forme | **a fournir** |
| Plage horaire de travail exacte de la DO a Barcelone | calcul des delais en heures ouvrees | a confirmer (defaut applique : 09 h 00 - 18 h 00) |
| Liste des feries propres a la Catalogne | le calendrier pre-rempli ne contient que les feries nationaux espagnols | a fournir |
| Grille de controle qualite voulue par famille | la grille initiale est une proposition | a valider |
| Comptes utilisateurs reels et leurs roles | remplacer les comptes de demonstration | a fournir |

Un classeur fictif reproduisant la structure attendue est fourni dans `tests/fixtures/` : il permet
de tester l'import et l'export sans aucune donnee reelle.
