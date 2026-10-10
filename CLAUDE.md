# Lune Journal

Privates Tagebuch für zwei Personen. Mobile-first PWA, beide nutzen Google Pixel (Android, Chrome).
Produktion: https://lune-journal.duckdns.org auf demselben Hetzner-VPS wie die Softball-App,
hinter deren Nginx. Server-Adresse steht nicht im Repo (GitHub-Secret `DEPLOY_HOST`). Auto-Deploy per GitHub Action auf `main`.

## Stack
- `backend/`: FastAPI, SQLModel/SQLite (WAL), Pillow, WeasyPrint (Buch-PDF), pypdfium2 (Buchvorschau), pywebpush, httpx
- `frontend/`: React 18 + Vite + TypeScript, Vaul (Sheets), Sonner (Toasts), exifr, vite-plugin-pwa (injectManifest, `src/sw.ts`)
- `frontend/Caddyfile`: App, `/api` → FastAPI, `/media` über `forward_auth` geschützt. **Kein HTTPS** —
  TLS macht der Nginx der Softball-App, Caddy lauscht nur auf `:80`.
- Keine Tailwind, kein UI-Framework: Styles in `frontend/src/theme.css` mit CSS-Variablen pro Theme

## Befehle
- Backend-Tests: `cd backend && pytest -q` (15 Tests, müssen grün bleiben)
- Browser-Test: `python backend/tests/e2e_browser.py` (Anleitung im Dateikopf, 21 Abläufe Handy + Desktop)
- Frontend: `cd frontend && npm ci && npm run build` (inkl. `tsc -b`)
- Dev: `uvicorn app.main:app --reload` in `backend/`, `npm run dev` in `frontend/` (Proxy auf :8000)
- Deploy: Push auf `main`, oder manuell `ssh root@<vps> "/opt/lune-journal/deploy.sh"`

## Regeln
- **Sprache:** Alle Texte in der App auf Deutsch, Satzanfang groß, aktiv, kurz. Fehlertexte sagen, was passiert ist und was zu tun ist.
- **Zugang:** Nur die zwei Adressen aus `ALLOWED_EMAILS`. Verglichen wird über `normalize_email()`
  (`config.py`): bei Google sind `googlemail.com` und `gmail.com` dasselbe Konto, Punkte im Namen zählen
  nicht und alles nach einem Plus ist Beiwerk. Auch die Nutzersuche beim Login geht über die
  Vergleichsform — sonst entsteht pro Schreibweise ein eigener Nutzer und die Partner-Logik bricht. Jeder neue Endpunkt braucht `Depends(current_user)`. Bilder nie als öffentlichen Ordner ausliefern.
- **Fotos:** Ausgelieferte WebP-Bilder enthalten keine EXIF/GPS-Daten. Originale bleiben in `data/originals` für den Druck.
- **Animationen nach Emil Kowalski:**
  - Häufige Aktionen (Navigation, Filter, Herzen) nicht oder kaum animieren, Tastatur-Aktionen nie.
  - Nur `transform`/`opacity` (Ausnahme: Akkordeon-Höhe, `clip-path`). Kurven aus `theme.css`: `--ease-out`, `--ease-in-out`, `--ease-drawer`.
  - UI unter 300 ms, Hover nur in `@media (hover: hover) and (pointer: fine)`, `prefers-reduced-motion` immer mitliefern.
- **Themes:** 11 Themes in `theme.css` (`[data-theme=…]`), Liste auch in `types.ts`, `fonts.ts`, `SettingsSheet.tsx`, `BookSheet.tsx`, `backend/app/routes/auth.py` (THEMES) und `backend/app/book/themes.py`. Neue Themes überall eintragen und Kontrast (4.5:1) prüfen.
- **Schriften:** selbst gehostet in `frontend/public/fonts` (kein Google Fonts). Fürs PDF statische Schnitte in `backend/app/book/fonts`.
- **Buch-PDF:** In `book/template.html` kein CSS-Grid über Seitenumbrüche (WeasyPrint stürzt ab), Fotos als `.ph` inline-block.
  Fotos am Eintrag haben nur `max-width`/`max-height` — nichts wird zugeschnitten. Zugeschnitten wird bewusst
  nur auf dem Cover und in der Monats-Collage. Einträge mit Foto tragen `.mit-foto` und brechen nicht um
  (`break-inside: avoid`), reine Texte dürfen umbrechen, damit keine Lücken entstehen. Die Stimmung steht
  bewusst nicht im Buch, das Energielevel schon. Auf der Monatsseite steht kein Auszug und keine
  Collage mehr: beides griff den Eintrag mit den meisten Herzen heraus, der wenige Seiten später
  ohnehin kommt. Nichts im Buch soll doppelt stehen — Ausnahme ist das Cover.
- **Desktop ist eigenständig:** Ab 960 px Seitenleiste + Schreibtisch (`DesktopComposer`), ab 1280 px dritte Spalte (`RightRail`). Nicht einfach das Handy-Layout strecken.
- Gemeinsame Eingabelogik liegt in `src/useComposer.ts` (Handy-Sheet und Desktop nutzen beide).
- **Live-Updates:** Jede Änderung, die die andere Person sehen soll, ruft `live.publish(...)`
  (siehe `routes/entries.py`, `routes/questions.py`). Verschickt werden nur Hinweise, nie Inhalte —
  der Browser holt die Daten danach normal über die API, mit eigener Sitzungsprüfung.
  `/api/stream` darf **nicht** durch `encode` laufen (Caddyfile) und braucht `X-Accel-Buffering: no`,
  sonst halten Caddy bzw. Nginx die Ereignisse zurück.

## Deployment
Verzeichnisse auf dem Server:

| Pfad | Inhalt |
|------|--------|
| `/opt/lune-journal/repo/` | Git-Klon samt `.env` (gitignored) |
| `/opt/lune-journal/data/` | Fotos, SQLite-DB, VAPID-Schlüssel — **außerhalb** des Klons |
| `/opt/lune-journal/deploy.sh` | Kopie von `deploy.sh` aus dem Repo |
| `/opt/softball/docker-compose.yml` | mountet `deploy/nginx-lune.conf` in den Nginx-Container |

Compose immer mit beiden Dateien: `-f docker-compose.yml -f docker-compose.prod.yml`.
Das Override setzt die Container-Namen (`lune-api`, `lune-web`), legt die Daten nach
`/opt/lune-journal/data` und hängt `web` ins externe Docker-Netz `proxy`, über das der Nginx
der Softball-App den Container unter `lune-web` erreicht.

Zertifikat: `certbot certonly --standalone`, dafür muss der Nginx-Container kurz stehen —
genau wie bei den beiden anderen Domains auf dem Server.

- **Teilen-Ziel:** `share_target` im Manifest (`vite.config.ts`) → POST auf `/share` → der Service
  Worker (`src/sw.ts`) legt die Dateien im Cache `geteilt` ab und leitet auf `/?share=n` um,
  `src/share.ts` holt sie dort genau einmal ab. Der Service Worker ruft `skipWaiting()` und
  `clientsClaim()`, sonst wäre er beim ersten Start nicht zuständig und der POST ginge an den Server.

- **Sheets:** Gezogen wird nur an der oberen Leiste — Griff und Titelzeile. Alles darunter trägt
  `data-vaul-no-drag` (Formular, Karte, Listen). `closeThreshold={0.4}`. Vaul schließt sonst bei jeder
  Wischgeschwindigkeit über 0,4 px/ms, unabhängig von der Strecke — das lässt sich nicht einstellen,
  und auf der Karte hätte schon das Verschieben das Sheet geschlossen. Jedes Sheet braucht deshalb
  einen eigenen Schließen-Knopf.

- **Standort:** Der automatische Standort greift nur, wenn Fotos am Eintrag hängen (`useComposer.ts`) —
  ein reiner Text-Eintrag soll ein reiner Text-Eintrag bleiben. Eigene Ortsnamen (`SavedPlace`) gewinnen
  immer gegen OpenStreetMap, siehe `routes/places.py`.
- **Karte:** `MapSheet.tsx` wird per `lazy()` nachgeladen — Leaflet wiegt mehr als die halbe App.
  Zusammengefasst wird nach Bildschirmabstand (`CLUSTER_PX`), nicht nach Entfernung in Metern.
  Kacheln kommen von OpenStreetMap; der Kachelserver sieht den Ausschnitt.

## Noch nicht mit echten Konten getestet
- Google-Login (braucht echte `GOOGLE_CLIENT_ID`)
- Google Fotos Picker (Photos Picker API in der Cloud Console aktivieren)
- Push auf echten Pixeln

## Screenshots
`docs/screenshots/` zeigt Demo-Daten, keine echten Einträge. Neu erzeugen: Backend mit leerem
`DATA_DIR` starten, Demo-Daten anlegen, `npx vite preview --port 4173`, dann mit Playwright
abfotografieren. Echte Fotos oder echte Texte gehören nicht ins Repo.

## Commits
Keine `Co-Authored-By`-Zeilen (wie im Softball-Repo).

## Nächste Ideen
Lese-Modus, Ruhezeiten für Push, eigenes Cover-Foto fürs Buch, Videos, Sprachnotizen, Garmin-Daten an Lauf-Einträgen, Karte.
