#!/usr/bin/env bash
# Sauvegarde quotidienne (cron cPanel) : dump de la base (format personnalisé pg_dump) et archive des fichiers.
# Rotation : 14 sauvegardes quotidiennes et 8 hebdomadaires (celles du dimanche).
# Option --base-seulement : dump de la base uniquement (utilisé avant chaque migration).
set -euo pipefail
BASE="${AZMG_BASE:-$HOME/azmg-gpao}"
DOSSIER="${AZMG_SAUVEGARDES:-$BASE/backups}"
ENV_FILE="${AZMG_ENV_FILE:-$BASE/shared/.env}"
STOCKAGE="${AZMG_STOCKAGE:-$BASE/shared/storage}"
mkdir -p "$DOSSIER"
DATABASE_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')}"
[ -z "$DATABASE_URL" ] && { echo "DATABASE_URL introuvable"; exit 1; }
HORODATAGE=$(date '+%Y%m%d-%H%M%S')

pg_dump --format=custom --no-owner --no-privileges --file="$DOSSIER/base-$HORODATAGE.dump" "$DATABASE_URL"
echo "$(date '+%F %T') Base sauvegardée : base-$HORODATAGE.dump"
[ "${1:-}" = "--base-seulement" ] && exit 0

if [ -d "$STOCKAGE" ]; then
  tar --exclude='*/outbox/*' --exclude='*/test/*' -czf "$DOSSIER/fichiers-$HORODATAGE.tar.gz" -C "$(dirname "$STOCKAGE")" "$(basename "$STOCKAGE")"
  echo "$(date '+%F %T') Fichiers archivés : fichiers-$HORODATAGE.tar.gz"
fi

# Rotation : on garde 14 jours, puis une sauvegarde par semaine (dimanche) pendant 8 semaines.
for f in $(find "$DOSSIER" \( -name 'base-*.dump' -o -name 'fichiers-*.tar.gz' \) -mtime +14); do
  jour=$(date -r "$f" '+%u')
  [ "$jour" = "7" ] || rm -f "$f"
done
find "$DOSSIER" \( -name 'base-*.dump' -o -name 'fichiers-*.tar.gz' \) -mtime +56 -delete
