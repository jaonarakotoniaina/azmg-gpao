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

| Element | Variable | Etat |
|---|---|---|
| Boite Gmail de suivi recevant la copie des mails du poste | compte Google | existe, acces a confirmer |
| Secret partage du webhook Apps Script | `APPS_SCRIPT_SECRET` | a generer au moment de la phase 4 |
| Ou, a defaut : acces IMAP de la boite de suivi | `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` | a fournir |

Sans ces elements, `COLLECTE_MAIL` reste en `mock` : la GPAO vit de la saisie rapide et de l'import,
ce qui est exactement le perimetre des phases 1 a 3.

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
