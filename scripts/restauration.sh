#!/usr/bin/env bash
# Restauration d'une sauvegarde. Usage :
#   scripts/restauration.sh base-AAAAMMJJ-HHMMSS.dump [fichiers-AAAAMMJJ-HHMMSS.tar.gz]
# La base cible est vidée puis rechargée : ATTENTION, action irréversible sur les données actuelles.
# Une sauvegarde de sécurité de l'état actuel est faite juste avant.
set -euo pipefail
BASE="${AZMG_BASE:-$HOME/azmg-gpao}"
DOSSIER="${AZMG_SAUVEGARDES:-$BASE/backups}"
ENV_FILE="${AZMG_ENV_FILE:-$BASE/shared/.env}"
STOCKAGE="${AZMG_STOCKAGE:-$BASE/shared/storage}"
DUMP="${1:?Indiquez le fichier de sauvegarde de la base}"
[ -f "$DUMP" ] || DUMP="$DOSSIER/$DUMP"
[ -f "$DUMP" ] || { echo "Sauvegarde introuvable : $1"; exit 1; }
DATABASE_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')}"

if [ "${AZMG_CONFIRMATION:-}" != "oui" ]; then
  read -r -p "Restaurer $DUMP et remplacer les données actuelles ? Tapez oui : " reponse
  [ "$reponse" = "oui" ] || { echo "Abandon"; exit 1; }
fi
AZMG_SAUVEGARDES="$DOSSIER" DATABASE_URL="$DATABASE_URL" "$(dirname "$0")/sauvegarde.sh" --base-seulement
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP"
echo "Base restaurée depuis $DUMP"
if [ -n "${2:-}" ]; then
  ARCHIVE="$2"; [ -f "$ARCHIVE" ] || ARCHIVE="$DOSSIER/$2"
  mkdir -p "$STOCKAGE"
  tar -xzf "$ARCHIVE" -C "$(dirname "$STOCKAGE")"
  echo "Fichiers restaurés depuis $ARCHIVE"
fi
[ -d "$BASE/app/tmp" ] && touch "$BASE/app/tmp/restart.txt" || true   # redémarrage Passenger (racine fixe app/)
