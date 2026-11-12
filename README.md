# AZMG GPAO

Pilotage operationnel des postes places par AZMG-Solutions chez ses clients.

L'unite de travail n'est pas le mail mais la **demande**, rattachee a un **dossier**
(client, produit, operation). Un mail, une consigne WhatsApp ou un vocal sont des **evenements**
qui creent, font avancer ou cloturent une demande. Tous les delais se comptent en **heures ouvrees
du client**, week-ends et jours feries exclus.

Premier perimetre : le compte **Masenz Group** et le poste d'assistante export et customer support.
Le modele reste generique : d'autres comptes et d'autres postes rejoignent la GPAO sans refonte.

- Production : `https://gpao.intranet.azmg-solutions.com`
- Documentation : [`docs/JOURNAL.md`](docs/JOURNAL.md), [`docs/DECISIONS.md`](docs/DECISIONS.md),
  [`docs/A_FOURNIR.md`](docs/A_FOURNIR.md), [`docs/guide-utilisateur.md`](docs/guide-utilisateur.md),
  [`docs/connecteur-claude.md`](docs/connecteur-claude.md), [`docs/agent-ia.md`](docs/agent-ia.md),
  [`docs/apps-script.md`](docs/apps-script.md)

## Sommaire

1. [Stack](#stack)
2. [Installation locale](#installation-locale)
3. [Commandes](#commandes)
4. [Structure du depot](#structure-du-depot)
5. [Mise en place sur o2switch, pas a pas](#mise-en-place-sur-o2switch-pas-a-pas)
6. [Chaine de deploiement](#chaine-de-deploiement)
7. [Sauvegarde et restauration](#sauvegarde-et-restauration)
8. [Modes simules](#modes-simules)

## Stack

Identique a AZMG Sourcing, pour que les deux applications restent maintenables ensemble.

| Element | Choix |
|---|---|
| Langage | TypeScript, cote serveur et cote navigateur |
| Serveur | Express 5, Phusion Passenger en production |
| Base | PostgreSQL, **compatible 9.6** (version o2switch), acces par Drizzle sur `pg` |
| Interface | React, Vite, TailwindCSS, TanStack Query, lucide-react |
| Validation | zod, schemas partages entre le serveur et l'interface (`src/shared/validation.ts`) |
| Tests | Vitest (unitaires et integration), Playwright (parcours) |
| Asynchrone | table `jobs_queue` consommee par un cron cPanel idempotent |

La compatibilite PostgreSQL 9.6 est verifiee par la CI, qui execute les tests sur l'image
`postgres:9.6`. Le schema n'utilise ni `gen_random_uuid`, ni colonne d'identite, ni `MERGE`.

## Installation locale

Pre-requis : Node.js 20.19 ou plus, et un PostgreSQL accessible.

```bash
git clone https://github.com/jaonarakotoniaina/azmg-gpao.git
cd azmg-gpao
npm ci
```

Creer les bases et l'utilisateur de developpement :

```bash
sudo -u postgres psql -c "CREATE ROLE azmg LOGIN PASSWORD 'azmg' SUPERUSER;"
sudo -u postgres createdb -O azmg azmg_gpao_dev
sudo -u postgres createdb -O azmg azmg_gpao_test
sudo -u postgres createdb -O azmg azmg_gpao_e2e
```

Copier et completer la configuration, puis appliquer les migrations :

```bash
cp .env.example .env
npm run db:migrate
```

Donnees de demonstration, entierement fictives (1 compte, 1 poste, 5 dossiers, 6 demandes) :

```bash
npm run db:seed
```

Comptes crees par le seed, mot de passe `DemoGpao2026!` :

| Email | Role |
|---|---|
| `ceo@azmg-solutions.com` | administrateur |
| `princy@azmg-solutions.com` | manager de compte |
| `elysa@azmg-solutions.com` | collaboratrice |

Lancer l'application (API sur le port 3000, interface sur le port 5173) :

```bash
npm run dev
```

Creer un compte administrateur sur une base vierge :

```bash
ADMIN_PASSWORD='un-mot-de-passe-solide' npm run cli creer-admin vous@azmg-solutions.com "Votre nom"
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | API et interface en mode developpement |
| `npm run build` | Build de production (`dist/web` et `dist/server`) |
| `npm start` | Demarre le build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sans emission |
| `npm test` | Tests unitaires et d'integration (Vitest) |
| `npm run e2e` | Parcours Playwright, sur le build de production |
| `npm run db:migrate` | Applique les migrations et les referentiels |
| `npm run db:seed` | Donnees de demonstration fictives (refuse en production) |
| `npm run db:generate` | Genere une migration apres modification du schema |
| `npm run cron` | Execute un passage du cron (`tick` par defaut) |
| `npm run cli` | Commandes d'administration (`migrate`, `seed`, `creer-admin`, `creer-utilisateur`) |
| `npm run eval` | Mesure du typage sur les jeux de mails fictifs annotes |

Le classeur de test fictif se regenere avec :

```bash
npx tsx scripts/generer-classeur-fictif.ts
```

Pour verifier a l'oeil que l'export preserve la mise en forme, apres un `npm run db:seed` :

```bash
npx tsx scripts/exporter-demonstration.ts /tmp/export.xlsx
```

## Structure du depot

```
src/
  shared/        code partage serveur et interface
    constantes.ts      referentiels metier (familles, natures, statuts, interlocuteurs)
    heures-ouvrees.ts  moteur de delais en heures ouvrees du client
    validation.ts      schemas zod des contrats d'API
    parametres.ts      schema et valeurs par defaut des parametres
    tirets.ts          filtre « aucun tiret long »
  server/
    app.ts             assemblage Express
    cron.ts            point d'entree des taches planifiees
    cli.ts             commandes d'administration
    db/                schema Drizzle, referentiels initiaux, seed
    lib/               file de traitements, journal, securite, perimetre, xlsx
    modules/           auth, comptes, dossiers, demandes, evenements, import, pilotage,
                       indicateurs, qualite, digest, export, mcp, typage, collecte
    ai/                fournisseur IA, prompts versionnes, jeux d'evaluation
  web/           interface React
drizzle/         migrations SQL versionnees
tests/           tests Vitest, classeur fictif dans tests/fixtures
e2e/             parcours Playwright
scripts/         build, deploiement, sauvegarde, generation du classeur de test
deploy/          point d'entree Passenger stable
```

## Mise en place sur o2switch, pas a pas

A faire **une seule fois**. Ensuite, tout deploiement est automatique.

### 1. Sous-domaine et certificat

Dans cPanel, « Domaines » : creer le sous-domaine `gpao.intranet.azmg-solutions.com`.
Dans « SSL/TLS Status », activer AutoSSL pour ce sous-domaine.

### 2. Base de donnees

Dans cPanel, « PostgreSQL Databases » :

1. creer la base `azmg_gpao` ;
2. creer un utilisateur dedie avec un mot de passe long ;
3. lui donner tous les droits sur `azmg_gpao`.

Noter la chaine de connexion, elle ira dans `DATABASE_URL`.

### 3. Arborescence

En SSH :

```bash
mkdir -p ~/azmg-gpao/{shared/storage,releases,backups,app/tmp}
```

### 4. Application Node dans cPanel

Dans « Setup Node.js App » :

- **Application root** : `azmg-gpao/app`
- **Application URL** : `gpao.intranet.azmg-solutions.com`
- **Application startup file** : `app.js`
- **Node.js version** : 20 ou plus

Creer l'application, puis poser le point d'entree stable :

```bash
cp ~/azmg-gpao/releases/*/deploy/passenger-app.js ~/azmg-gpao/app/app.js 2>/dev/null \
  || curl -fsSL https://raw.githubusercontent.com/jaonarakotoniaina/azmg-gpao/main/deploy/passenger-app.js \
     -o ~/azmg-gpao/app/app.js
```

Ce fichier ne change jamais : il charge la version pointee par le lien `current`. cPanel enregistre
le chemin reel de la racine et non le lien, donc pointer l'application directement sur une version
la figerait.

### 5. Configuration de production

Creer `~/azmg-gpao/shared/.env` a partir de `.env.example`, hors du dossier public :

```bash
nano ~/azmg-gpao/shared/.env
chmod 600 ~/azmg-gpao/shared/.env
```

Au minimum :

```
NODE_ENV=production
TRUST_PROXY=1
DATABASE_URL=postgresql://UTILISATEUR:MOTDEPASSE@localhost:5432/azmg_gpao
SESSION_SECRET=<32 caracteres minimum>
APP_URL=https://gpao.intranet.azmg-solutions.com
STORAGE_DIR=/home/UTILISATEUR_CPANEL/azmg-gpao/shared/storage
ALERT_EMAIL=jaona.rakotoniaina@azmg-solutions.com
```

Generer le secret de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 6. Jeton GitHub en lecture seule

Creer un jeton a portee fine, lecture du contenu du depot `azmg-gpao` uniquement, puis :

```bash
printf '%s' 'github_pat_...' > ~/.azmg-github-token
chmod 600 ~/.azmg-github-token
```

### 7. Configuration du deploiement

Creer `~/azmg-gpao/shared/deploy.env` :

```
REPO_URL=https://github.com/jaonarakotoniaina/azmg-gpao.git
GITHUB_TOKEN_FILE=$HOME/.azmg-github-token
NODE_BIN=$HOME/nodevenv/azmg-gpao/app/20/bin
HEALTH_URL=https://gpao.intranet.azmg-solutions.com/health
ALERT_EMAIL=jaona.rakotoniaina@azmg-solutions.com
GARDER_VERSIONS=5
```

Le chemin exact de `NODE_BIN` est affiche par cPanel dans « Setup Node.js App »
(bouton « Enter to the virtual environment »).

### 8. Premier deploiement

Pousser sur `main` declenche la chaine de release, qui publie la branche `release`. Lancer
ensuite le premier deploiement a la main pour verifier :

```bash
bash ~/azmg-gpao/releases/*/scripts/auto-deploy.sh 2>&1 | tail -20
```

Au tout premier passage, le dossier `releases` est vide. Amorcer alors par un clone direct :

```bash
cd ~/azmg-gpao
git clone --depth 1 --branch release \
  "https://x-access-token:$(cat ~/.azmg-github-token)@github.com/jaonarakotoniaina/azmg-gpao.git" \
  releases/premier
cd releases/premier
git remote set-url origin https://github.com/jaonarakotoniaina/azmg-gpao.git
ln -sfn ~/azmg-gpao/shared/.env .env
rm -rf storage && ln -sfn ~/azmg-gpao/shared/storage storage
npm ci --omit=dev --no-audit --no-fund
node dist/server/cli.js migrate
ln -sfn ~/azmg-gpao/releases/premier ~/azmg-gpao/current
touch ~/azmg-gpao/app/tmp/restart.txt
```

Verifier :

```bash
curl -s https://gpao.intranet.azmg-solutions.com/health
```

### 9. Premier compte administrateur

```bash
cd ~/azmg-gpao/current
ADMIN_PASSWORD='un-mot-de-passe-solide' node dist/server/cli.js creer-admin jaona.rakotoniaina@azmg-solutions.com "Jaona Rakotoniaina"
```

### 10. Lignes de cron

Dans cPanel, « Cron Jobs », ajouter exactement ces trois lignes :

```
*/5 * * * * /bin/bash $HOME/azmg-gpao/current/scripts/auto-deploy.sh >> $HOME/azmg-gpao/deploy.log 2>&1
```

```
*/5 * * * * cd $HOME/azmg-gpao/current && $HOME/nodevenv/azmg-gpao/app/20/bin/node dist/server/cron.js tick >> $HOME/azmg-gpao/cron.log 2>&1
```

```
30 2 * * * /bin/bash $HOME/azmg-gpao/current/scripts/sauvegarde.sh >> $HOME/azmg-gpao/sauvegarde.log 2>&1
```

Adapter `20` au numero de version Node affiche par cPanel.

La deuxieme ligne suffit pour tout l'asynchrone : chaque passage vide la file `jobs_queue`, puis
declenche les taches planifiees dont la periode est echue (`cron_runs` garde la trace du dernier
passage, de sorte qu'une tache quotidienne ne part qu'une fois par jour). La preparation des
brouillons du matin (relances, reporting de la veille, onglet de semaine le lundi) part ainsi a
partir de 6 h, heure d'Antananarivo, avant la journee du poste. Pour la declencher a la main :

```bash
cd ~/azmg-gpao/current && node dist/server/cron.js preparation_matin
```

## Chaine de deploiement

La session de developpement et GitHub Actions ne se connectent jamais a o2switch : l'acces SSH y
est limite aux adresses IP autorisees. Le serveur va donc chercher ses mises a jour lui-meme.

1. **Push sur `main`** : GitHub Actions (`.github/workflows/release.yml`) execute lint, typecheck,
   tests sur PostgreSQL 9.6, build de production et parcours Playwright, puis publie un artefact
   pret a l'emploi sur la branche `release` (aucune compilation cote serveur).
2. **Cron o2switch, toutes les 5 minutes** : `scripts/auto-deploy.sh` compare le commit de `release`
   avec la version deployee. S'il a change : clone de la nouvelle version dans un dossier date,
   dependances de production, **sauvegarde de la base**, migrations, bascule du lien `current`,
   redemarrage Passenger, puis verification que `/health` renvoie bien le nouveau commit.
3. **En cas d'echec** : retour automatique a la version precedente et email d'alerte. Les cinq
   dernieres versions sont conservees pour un retour arriere manuel immediat.

Les branches de travail et les pull requests passent par `.github/workflows/verification.yml`,
qui execute les memes controles sans publier d'artefact.

## Sauvegarde et restauration

La sauvegarde quotidienne (`scripts/sauvegarde.sh`) ecrit un dump de la base et une archive des
fichiers dans `~/azmg-gpao/backups`, avec rotation : 14 sauvegardes quotidiennes, puis une par
semaine pendant 8 semaines. Une sauvegarde de la base est aussi prise avant chaque migration.

Restaurer :

```bash
~/azmg-gpao/current/scripts/restauration.sh base-20261107-023000.dump fichiers-20261107-023000.tar.gz
```

La commande demande une confirmation et prend une sauvegarde de securite de l'etat actuel avant
d'ecraser quoi que ce soit.

## Modes simules

Chaque integration externe a deux implementations, `real` et `mock`. Si la variable
d'environnement correspondante est absente, le mode `mock` s'active automatiquement et
l'application fonctionne entierement. Les elements manquants sont listes dans
[`docs/A_FOURNIR.md`](docs/A_FOURNIR.md) et affiches dans l'ecran Parametres.

| Integration | Variables | Sans elles |
|---|---|---|
| IA | `AI_PROVIDER`, `AGENT_API_TOKEN`, `ANTHROPIC_API_KEY` | le typage repose sur les seules regles, ce qui suffit deja (voir [`docs/agent-ia.md`](docs/agent-ia.md)) |
| Collecte des mails | `APPS_SCRIPT_SECRET` ou `IMAP_*` | saisie rapide et import de fichiers `.eml` ou `.mbox` (voir [`docs/apps-script.md`](docs/apps-script.md)) |
| Envoi des emails | `SMTP_*` | les liens de reinitialisation sont traces dans le journal |
| Connecteur Claude | `AZMG_MCP_TOKEN` | la route `/mcp` reste fermee (voir [`docs/connecteur-claude.md`](docs/connecteur-claude.md)) |

Regle d'or : **l'IA prepare, l'humain envoie**. Aucun mail ne part automatiquement vers un client,
un transitaire ou la donneuse d'ordre. Tout est brouillon ou export.
