#!/bin/bash
# Deploy-Script auf dem VPS: /opt/lune-journal/deploy.sh
# Vorlage im Repo — nach Änderungen auf den VPS kopieren:
#   scp deploy.sh root@<vps>:/opt/lune-journal/deploy.sh
#
# Verzeichnisse auf dem Server:
#   /opt/lune-journal/repo/   Git-Klon (dieses Repo), enthält auch die .env
#   /opt/lune-journal/data/   Fotos, SQLite-Datenbank, VAPID-Schlüssel
set -e

cd /opt/lune-journal/repo
git pull origin main

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

docker image prune -f
echo 'Deploy done!'
