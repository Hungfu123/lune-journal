# Lune Journal

Ein privates Tagebuch für zwei. Kein Feed, keine Likes von Fremden, keine Werbung — nur ihr beide,
eure Tage und eure Fotos. Die App läuft auf einem eigenen Server unter
[lune-journal.duckdns.org](https://lune-journal.duckdns.org) und lässt genau zwei Google-Konten herein.

Auf dem Handy installiert ihr sie wie eine echte App (PWA), auf dem Laptop bekommt ihr einen
Schreibtisch mit Seitenleiste. Am Jahresende macht die App aus allem ein Buch als PDF — zum Durchblättern
oder zum Drucken.

<p align="center">
  <img src="docs/screenshots/handy-timeline.png" width="260" alt="Timeline auf dem Handy">
  <img src="docs/screenshots/handy-eintrag.png" width="260" alt="Eintrag mit Foto">
  <img src="docs/screenshots/handy-neuer-eintrag.png" width="260" alt="Neuer Eintrag">
</p>

> Alle Screenshots zeigen Demo-Daten: erfundene Texte und abstrakte Platzhalter-Bilder.
> Echte Einträge und Fotos liegen nur auf dem Server und nie im Repo.

## Was ihr damit machen könnt

**Den Tag festhalten.** Entweder *Kurz & knapp* (ein Satz) oder *Tag erzählen* (so lang ihr wollt),
dazu eine Stimmung und beliebig viele Fotos aus Kamera, Galerie oder Google Fotos. Die App liest
Aufnahmezeit und Ort aus den Foto-Metadaten und fragt nach: „Eintrag für diesen Tag anlegen?"

**Einander Fragen stellen.** Eine Person fragt, die andere antwortet. Mit „Wir antworten beide" bleiben
die Antworten verdeckt, bis beide fertig sind — niemand schreibt vom anderen ab. Beantwortete Fragen
landen in der Timeline. Wer keine Idee hat, lässt sich eine vorschlagen.

**Sich erinnern lassen.** Einmal pro Woche ein kleiner Anstoß aufs Handy, Tag und Uhrzeit stellt jeder
für sich ein. Die Erinnerung fällt aus, wenn an dem Tag schon etwas geschrieben wurde.

**Mitbekommen, was der andere schreibt.** Push aufs Handy mit Foto in der Benachrichtigung und einem
„Herz senden"-Knopf direkt darin.

**Zurückblättern.** Timeline pro Monat, Filter nach *Alle / Meine / Partner*, Monatsübersicht mit
Anzahl und einer Zufalls-Erinnerung. Auf dem großen Bildschirm zusätzlich „Heute vor einem Jahr",
euer Monat in Zahlen und eine Fotowand.

**Ein Buch daraus machen.** Zeitraum und Titel wählen, Design, A5 oder A4, Bildschirm- oder
Druckqualität, optional 3 mm Beschnitt für die Druckerei. Mit Cover, Inhaltsverzeichnis, Monatsseiten,
Fragen und Jahresrückblick. Vorher durchblättern, dann teilen oder drucken.

**Es euch schön machen.** Elf Designs, jedes mit eigener Überschrift-Schrift. Jeder stellt sein eigenes
ein — ihr müsst euch nicht einigen.

<p align="center">
  <img src="docs/screenshots/handy-buch.png" width="260" alt="Buch erstellen">
  <img src="docs/screenshots/handy-einstellungen.png" width="260" alt="Designs und Erinnerung">
</p>

### Auf dem Laptop

Ab 960 px Breite wird aus der Handy-App ein Schreibtisch: Seitenleiste mit Monatskalender und Filter,
Eintrag direkt über der Timeline tippen, Fotos irgendwo ins Fenster ziehen oder mit <kbd>Strg</kbd>+<kbd>V</kbd>
einfügen, per Ziehen sortieren, <kbd>Strg</kbd>+<kbd>Enter</kbd> postet. <kbd>N</kbd> neuer Eintrag,
<kbd>B</kbd> Buch, <kbd>←</kbd> <kbd>→</kbd> Monat. Für lange Texte gibt es einen Fokus-Modus mit Wortzahl.

![Schreibtisch auf dem Laptop](docs/screenshots/desktop-schreibtisch.png)

## Wie privat ist das?

- Rein kommt nur, wer sich mit einer der zwei Adressen aus `ALLOWED_EMAILS` bei Google anmeldet.
  Jeder andere bekommt eine freundliche Absage.
- Fotos liegen **nicht** in einem öffentlichen Ordner. Caddy fragt vor jeder Bilddatei beim Backend
  nach, ob die Sitzung gültig ist (`forward_auth`).
- Die ausgelieferten Bilder sind WebP ohne EXIF — kein GPS, kein Gerätename. Die Originale bleiben
  für den Druck auf dem Server.
- Bilder in Push-Benachrichtigungen laufen über signierte Links, die nach kurzer Zeit ablaufen.
- Die Seite sagt Suchmaschinen per `X-Robots-Tag`, dass sie nichts zu suchen haben.
- Backups auf die Hetzner Storage Box sind mit restic verschlüsselt.

## Wie es gebaut ist

| Teil | Technik |
|------|---------|
| Frontend | React 18, Vite, TypeScript, Vaul (Sheets), Sonner (Toasts), vite-plugin-pwa |
| Backend | FastAPI, SQLModel auf SQLite (WAL), Pillow, WeasyPrint (Buch-PDF), pywebpush |
| Auslieferung | Caddy: App, `/api` → FastAPI, `/media` mit `forward_auth` |
| Server | Hetzner VPS, Docker Compose, hinter dem Nginx der Softball-App (TLS) |

Styles stehen ohne Framework in `frontend/src/theme.css`, pro Design ein Satz CSS-Variablen.
Schriften sind selbst gehostet — die App ruft kein Google Fonts auf.

```
backend/app/        FastAPI: routes/, models.py, images.py, push.py, book/ (PDF)
frontend/src/       React: components/, useComposer.ts (Eingabe), theme.css
deploy/             Nginx-Vhost für den Server
docker-compose.yml  lokal    + docker-compose.prod.yml für den Server
```

## Einrichtung

### 1. Google-Login

Google Cloud Console → neues Projekt → *APIs & Dienste*:

1. **OAuth-Zustimmungsbildschirm:** extern, als Testnutzer die beiden Adressen eintragen.
2. **Anmeldedaten → OAuth-Client-ID**, Typ *Webanwendung*.
   Autorisierte JavaScript-Quellen: `https://lune-journal.duckdns.org` und für lokal `http://localhost:5173`.
3. Die Client-ID landet in der `.env` als `GOOGLE_CLIENT_ID`.

**Google Fotos (optional):** Dieselbe Konsole, *Photos Picker API* aktivieren und im
Zustimmungsbildschirm den Bereich `.../auth/photospicker.mediaitems.readonly` ergänzen. Beim ersten Klick
auf „Google Fotos verbinden" fragt Google einmal nach Erlaubnis, danach öffnet sich der Picker.
Eine App darf seit März 2025 nicht mehr selbst in Alben schauen — die Auswahl läuft deshalb immer
über dieses Fenster.

### 2. Domain

DuckDNS-Subdomain `lune-journal` anlegen und auf die Server-IP zeigen lassen.

### 3. Server

Die App teilt sich den Server mit der Softball-App. Die hält Port 80/443 und die Zertifikate,
Lune Journal hängt sich dahinter:

```bash
# Verzeichnisse
mkdir -p /opt/lune-journal/data
git clone git@github.com:Hungfu123/lune-journal.git /opt/lune-journal/repo
cd /opt/lune-journal/repo
cp .env.example .env && nano .env          # ausfüllen
openssl rand -hex 32                       # → MEDIA_SECRET

# gemeinsames Netz für beide Compose-Projekte
docker network create proxy
# den Nginx der Softball-App zusätzlich in dieses Netz hängen (einmalig, in
# /opt/softball/docker-compose.yml) und danach neu starten

# Zertifikat holen (Nginx kurz anhalten, certbot braucht Port 80)
docker compose -f /opt/softball/docker-compose.yml stop nginx
certbot certonly --standalone -d lune-journal.duckdns.org
docker compose -f /opt/softball/docker-compose.yml start nginx

# Vhost einhängen: deploy/nginx-lune.conf nach /etc/nginx/conf.d/lune.conf
# mounten (in /opt/softball/docker-compose.yml beim Service nginx)

# Starten
cd /opt/lune-journal/repo
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api python scripts/gen_vapid.py
#   → ausgegebenen VAPID_PUBLIC_KEY in die .env eintragen
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

cp deploy.sh /opt/lune-journal/deploy.sh   # Deploy-Script an seinen Platz
```

Ab dann deployt jeder Push auf `main` von selbst: GitHub Action → SSH → `/opt/lune-journal/deploy.sh`
→ `git fetch`/`reset --hard` → `docker compose up -d --build`. Das Repo braucht dafür zwei Secrets:
`DEPLOY_SSH_KEY` (privater Schlüssel, auf dem Server in `authorized_keys` fest auf `deploy.sh`
verdrahtet) und `DEPLOY_HOST` (Adresse des Servers — die steht bewusst nirgends im Repo).

### 4. Auf den Handys installieren

Domain in Chrome öffnen → anmelden → Menü → *App installieren*. Nach dem ersten Eintrag fragt die App,
ob sie Bescheid geben darf, wenn der andere etwas postet.

### 5. Backups

In `backup.sh` den Storage-Box-Zugang eintragen, einmal `restic init` laufen lassen, dann per Cron:

```
30 3 * * * /opt/lune-journal/repo/backup.sh >> /opt/lune-journal/backup.log 2>&1
```

Das restic-Passwort an einem sicheren Ort aufheben — ohne kommt niemand mehr an die Daten.

## Lokal entwickeln

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env        # DATA_DIR=../data, COOKIE_SECURE=false, PUBLIC_URL=http://localhost:5173
uvicorn app.main:app --reload

# Frontend (zweites Terminal)
cd frontend && npm install
VITE_GOOGLE_CLIENT_ID=… npm run dev
```

Lokal liefert die API keine `/media`-Dateien aus — das macht in Produktion Caddy. Fotos testet ihr am
einfachsten mit `docker compose up` oder direkt auf dem Server.

Push auf dem Pixel ansehen: Handy per USB anstecken, am Laptop `chrome://inspect` öffnen, dort laufen
Service Worker und Push-Events live mit.

## Tests

```bash
cd backend && pytest -q        # 15 API-Tests: Login, Fotos, Einträge, Fragen, Erinnerung, Push, Buch
python tests/e2e_browser.py    # 21 Browser-Abläufe auf Handy und Desktop (Anleitung oben in der Datei)

cd frontend && npm run build   # tsc -b + Produktions-Build
```

## Was noch kommen könnte

1. Teilen direkt aus Google Fotos (Web Share Target)
2. Lese-Modus für lange Einträge
3. Ruhezeiten und gebündelte Benachrichtigungen
4. Buch: eigenes Cover-Foto wählen, einzelne Einträge ausblenden
5. Videos, Sprachnotizen, Garmin-Daten an Lauf-Einträgen, Karte
