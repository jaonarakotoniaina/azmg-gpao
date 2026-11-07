#!/usr/bin/env bash
# Déploiement automatique sur o2switch (cron cPanel toutes les 5 minutes).
# Compare le commit de la branche « release » avec la version déployée. S'il a changé :
# nouveau dossier de version, dépendances de production, sauvegarde de la base, migrations,
# bascule du lien « current », redémarrage Passenger, vérification de /health.
# En cas d'échec : retour automatique à la version précédente et email d'alerte.
#
# Configuration : fichier ~/azmg-gpao/shared/deploy.env (voir README), par exemple :
#   REPO_URL=https://github.com/jaonarakotoniaina/azmg-gpao.git
#   GITHUB_TOKEN_FILE=$HOME/.azmg-github-token      # jeton GitHub en lecture seule (contenu du dépôt)
#   NODE_BIN=$HOME/nodevenv/azmg-gpao/app/24/bin  # dossier bin de l'environnement Node cPanel
#   HEALTH_URL=https://gpao.intranet.azmg-solutions.com/health
#   ALERT_EMAIL=jaona.rakotoniaina@azmg-solutions.com
#
# Racine Passenger : dossier fixe ~/azmg-gpao/app (fichier deploy/passenger-app.js), qui charge la version
# pointée par « current ». cPanel enregistre le chemin réel de la racine, pas le lien : pointer l'application
# cPanel directement sur une version la figerait. Le redémarrage passe donc par app/tmp/restart.txt.
set -euo pipefail

BASE="${AZMG_BASE:-$HOME/azmg-gpao}"
SHARED="$BASE/shared"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
APP_ROOT="${AZMG_APP_ROOT:-$BASE/app}"
LOCK="$BASE/.deploy.lock"
# shellcheck disable=SC1091
[ -f "$SHARED/deploy.env" ] && source "$SHARED/deploy.env"
REPO_URL="${REPO_URL:?REPO_URL manquant dans shared/deploy.env}"
HEALTH_URL="${HEALTH_URL:?HEALTH_URL manquant}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
GARDER="${GARDER_VERSIONS:-5}"
[ -n "${NODE_BIN:-}" ] && export PATH="$NODE_BIN:$PATH"

journal() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
redemarrer() { mkdir -p "$APP_ROOT/tmp" && touch "$APP_ROOT/tmp/restart.txt"; }
alerter() {
  journal "ALERTE : $1"
  if [ -n "$ALERT_EMAIL" ] && command -v sendmail >/dev/null 2>&1; then
    printf 'To: %s\nSubject: [AZMG GPAO] Échec du déploiement\nContent-Type: text/plain; charset=utf-8\n\n%s\n' "$ALERT_EMAIL" "$1" | sendmail -t || true
  fi
}

mkdir -p "$SHARED/storage" "$RELEASES" "$BASE/backups"
[ -f "$APP_ROOT/app.js" ] || { journal "Racine Passenger absente : $APP_ROOT/app.js (voir README, application Node)"; exit 1; }
exec 9>"$LOCK"
if ! flock -n 9; then journal "Déploiement déjà en cours"; exit 0; fi

URL_AUTH="$REPO_URL"
if [ -n "${GITHUB_TOKEN_FILE:-}" ] && [ -f "$GITHUB_TOKEN_FILE" ]; then
  URL_AUTH="${REPO_URL/https:\/\//https://x-access-token:$(tr -d '\n' < "$GITHUB_TOKEN_FILE")@}"
fi

DISTANT=$(git ls-remote "$URL_AUTH" refs/heads/release | cut -f1)
[ -z "$DISTANT" ] && { journal "Branche release introuvable"; exit 0; }
DEPLOYE=$(cat "$CURRENT/.release-commit" 2>/dev/null || echo "aucun")
[ "$DISTANT" = "$DEPLOYE" ] && exit 0

journal "Nouvelle version détectée : $DISTANT (déployée : $DEPLOYE)"
NOUVELLE="$RELEASES/$(date '+%Y%m%d-%H%M%S')-${DISTANT:0:7}"
PRECEDENTE=""
[ -L "$CURRENT" ] && PRECEDENTE=$(readlink -f "$CURRENT")

echec() {
  alerter "$1 (version ${DISTANT:0:7}). Version précédente conservée : ${PRECEDENTE:-aucune}."
  if [ -n "$PRECEDENTE" ] && [ -d "$PRECEDENTE" ]; then
    if [ "$(readlink -f "$CURRENT")" != "$PRECEDENTE" ]; then
      ln -sfn "$PRECEDENTE" "$CURRENT"
      redemarrer
      journal "Retour à la version précédente effectué"
    fi
  elif [ -L "$CURRENT" ] && [ "$(readlink -f "$CURRENT")" = "$(readlink -f "$NOUVELLE")" ]; then
    rm -f "$CURRENT"   # premier déploiement : aucune version précédente vers laquelle revenir
  fi
  rm -rf "$NOUVELLE"
  exit 1
}
trap 'echec "Erreur inattendue ligne $LINENO"' ERR

git clone --quiet --depth 1 --branch release "$URL_AUTH" "$NOUVELLE"
git -C "$NOUVELLE" remote set-url origin "$REPO_URL"   # ne pas conserver le jeton sur le disque
echo "$DISTANT" > "$NOUVELLE/.release-commit"
ln -sfn "$SHARED/.env" "$NOUVELLE/.env"
rm -rf "$NOUVELLE/storage" && ln -sfn "$SHARED/storage" "$NOUVELLE/storage"
mkdir -p "$NOUVELLE/tmp"

# Dépendances de production : réutilisées si le fichier de verrouillage n'a pas changé.
if [ -n "$PRECEDENTE" ] && [ -d "$PRECEDENTE/node_modules" ] && cmp -s "$PRECEDENTE/package-lock.json" "$NOUVELLE/package-lock.json"; then
  cp -al "$PRECEDENTE/node_modules" "$NOUVELLE/node_modules" 2>/dev/null || cp -a "$PRECEDENTE/node_modules" "$NOUVELLE/node_modules"
else
  (cd "$NOUVELLE" && npm ci --omit=dev --no-audit --no-fund --loglevel=error) || echec "Installation des dépendances impossible"
fi

# Sauvegarde de la base avant migration.
"$NOUVELLE/scripts/sauvegarde.sh" --base-seulement || echec "Sauvegarde de la base impossible"
(cd "$NOUVELLE" && node dist/server/cli.js migrate) || echec "Migrations en échec (aucune modification appliquée : les migrations sont transactionnelles)"

# Bascule et redémarrage Passenger.
ln -sfn "$NOUVELLE" "$CURRENT"
redemarrer

# La nouvelle version doit répondre elle-même (et non l'ancienne encore en mémoire).
OK=0
for i in $(seq 1 20); do
  sleep 3
  if curl -fs --max-time 10 "$HEALTH_URL" | grep -q "\"deploiement\":\"$DISTANT\""; then OK=1; break; fi
done
[ "$OK" = 1 ] || echec "La nouvelle version ne répond pas sur /health après la mise en ligne"

trap - ERR
journal "Version ${DISTANT:0:7} en ligne"
# Rotation : on garde les dernières versions pour un retour arrière manuel rapide.
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((GARDER + 1)) | xargs -r rm -rf
