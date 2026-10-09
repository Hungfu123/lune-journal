#!/usr/bin/env bash
# Tägliches, verschlüsseltes Backup auf die Hetzner Storage Box.
# Einmalig: restic init  (mit den Variablen unten)
# Cron:     30 3 * * * /opt/lune-journal/repo/backup.sh >> /opt/lune-journal/backup.log 2>&1
set -euo pipefail

DATA=/opt/lune-journal/data

export RESTIC_REPOSITORY="sftp:uXXXXXX@uXXXXXX.your-storagebox.de:/lune-journal"
# Passwort gut aufheben — ohne kommt niemand mehr an die Daten
export RESTIC_PASSWORD_FILE="$HOME/.restic-lune-journal"

# Konsistente Kopie der SQLite-Datei ziehen (WAL-sicher), erst dann sichern
docker exec -t lune-api python scripts/backup_db.py

restic backup \
  "$DATA/app.backup.db" "$DATA/media" "$DATA/originals" "$DATA/vapid_private.pem" \
  --tag lune-journal
restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 24 --prune
