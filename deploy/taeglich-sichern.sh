#!/bin/bash
# Tägliche Sicherung auf dem Server selbst — als Netz für den häufigsten Fall:
# versehentlich gelöscht, Datenbank beschädigt, Deploy schiefgegangen.
#
# Das ersetzt KEIN Backup außer Haus. Geht die Festplatte kaputt, ist auch
# diese Kopie weg. Dafür ist backup.sh mit restic da (Hetzner Storage Box).
#
# Einrichten:
#   scp deploy/taeglich-sichern.sh root@<vps>:/opt/lune-journal/taeglich-sichern.sh
#   chmod +x /opt/lune-journal/taeglich-sichern.sh
#   crontab -e  →  20 3 * * * /opt/lune-journal/taeglich-sichern.sh >> /opt/lune-journal/sichern.log 2>&1
set -euo pipefail

DATA=/opt/lune-journal/data
ZIEL=/opt/lune-journal/sicherungen
TAG=$(date +%F)
BEHALTEN=14

mkdir -p "$ZIEL"

# Konsistente Kopie der SQLite-Datei, auch während die App läuft
docker exec -t lune-api python scripts/backup_db.py >/dev/null

# Datenbank und Push-Schlüssel sind klein — die kommen jeden Tag mit
tar -czf "$ZIEL/db-$TAG.tar.gz" -C "$DATA" app.backup.db vapid_private.pem

# Fotos wachsen: nur ein Spiegel, keine Kopie pro Tag
rsync -a --delete "$DATA/originals/" "$ZIEL/originals/"

# Alte Stände aufräumen
find "$ZIEL" -maxdepth 1 -name 'db-*.tar.gz' -mtime +$BEHALTEN -delete

echo "$(date +'%F %T') gesichert: $(du -sh "$ZIEL" | cut -f1) gesamt"
