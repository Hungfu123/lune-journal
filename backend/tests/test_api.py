"""End-to-End-Tests der API. Ausführen: cd backend && pytest -q"""
import json
import time
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
import pytest
from PIL import Image
from sqlmodel import Session, select

from app.config import settings
from app.db import engine
from app.models import Entry, PushSubscription, User
from app.security import signed_media_url
from tests.conftest import jpeg

TODAY = datetime.now(ZoneInfo("Europe/Berlin")).date()
MONTH = f"{TODAY:%Y-%m}"


# ---------- Zugang ----------

def test_everything_requires_login(as_user):
    c = as_user(None)
    for path in ["/api/auth/me", f"/api/entries?month={MONTH}", "/api/questions/open", "/api/memory", "/api/push/key",
                 f"/api/book?start={MONTH}&end={MONTH}", "/api/auth/check"]:
        assert c.get(path).status_code == 401, path


def test_google_login_allowlist(as_user, monkeypatch):
    import app.routes.auth as auth
    c = as_user(None)
    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", lambda *a: {"email": "fremd@example.com", "email_verified": True})
    assert c.post("/api/auth/google", json={"credential": "x"}).status_code == 403
    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", lambda *a: {"email": "Hung@Example.com", "email_verified": True, "given_name": "Hung"})
    r = c.post("/api/auth/google", json={"credential": "x"})
    assert r.status_code == 200 and r.json()["partner"]["name"] == "Lea"
    assert "tb_session" in r.cookies
    assert c.get("/api/auth/me").status_code == 200
    c.post("/api/auth/logout")
    assert c.get("/api/auth/me").status_code == 401


def test_settings_and_devices(as_user):
    c = as_user("hung")
    me = c.patch("/api/auth/me", json={"theme": "kino", "reminder_weekday": 2, "reminder_hour": 20}).json()
    assert me["theme"] == "kino" and me["reminder"] == {"enabled": True, "weekday": 2, "hour": 20}
    assert c.patch("/api/auth/me", json={"theme": "gibtsnicht"}).json()["theme"] == "kino"
    assert c.patch("/api/auth/me", json={"reminder_hour": 99}).status_code == 422
    devices = c.get("/api/auth/devices").json()
    assert any(d["current"] for d in devices)


# ---------- Fotos ----------

def test_photo_upload_reads_moment_and_strips_gps(as_user):
    c = as_user("hung")
    p = c.post("/api/photos", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).json()
    assert p["taken_at"] == "2026-02-14T18:42:00" and p["has_location"]
    for size in ("thumb", "app", "print"):
        f = settings.media_dir / f"{p['id']}_{size}.webp"
        assert f.exists() and not Image.open(f).getexif()  # keine Metadaten in ausgelieferten Bildern
    assert c.post("/api/photos", files={"file": ("x.txt", b"kein bild", "text/plain")}).status_code == 415


def test_media_access_check(as_user):
    c = as_user("hung")
    pid = c.post("/api/photos", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).json()["id"]
    assert c.get("/api/auth/check").status_code == 200
    c = as_user(None)
    assert c.get("/api/auth/check", headers={"x-forwarded-uri": f"/media/{pid}_app.webp"}).status_code == 401
    signed = signed_media_url(f"/media/{pid}_app.webp").replace(settings.public_url, "")
    assert c.get("/api/auth/check", headers={"x-forwarded-uri": signed}).status_code == 200
    assert c.get("/api/auth/check", headers={"x-forwarded-uri": signed.replace("_app", "_print")}).status_code == 401


# ---------- Einträge ----------

def test_entry_lifecycle(as_user, no_network):
    c = as_user("hung")
    pid = c.post("/api/photos", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).json()["id"]
    e = c.post("/api/entries", json={"kind": "short", "text": "Rhein!", "mood": "super", "entry_date": "2026-02-14", "photo_ids": [pid]}).json()
    assert e["date"] == "2026-02-14" and e["place_name"] == "Rheinufer, Düsseldorf" and e["mine"]
    assert any(p.get("image") for p in no_network), "Benachrichtigung mit Foto"
    # Foto kann nicht zweimal verwendet werden
    assert c.post("/api/entries", json={"text": "x", "photo_ids": [pid]}).status_code == 422
    # Zukunft, leer, unbekannte Stimmung
    assert c.post("/api/entries", json={"text": "x", "entry_date": str(TODAY + timedelta(days=2))}).status_code == 422
    assert c.post("/api/entries", json={"text": "  "}).status_code == 422
    assert c.post("/api/entries", json={"text": "x", "mood": "wütend"}).status_code == 422

    # Filter aus Sicht von Lea
    c = as_user("lea")
    assert len(c.get("/api/entries?month=2026-02&author=partner").json()) >= 1
    assert all(not x["mine"] for x in c.get("/api/entries?month=2026-02&author=partner").json())
    assert c.get("/api/entries?month=2026-02&author=me").json() == []
    assert c.get("/api/months?year=2026").json()[1]["count"] >= 1

    # Herz: Lea gibt, nimmt zurück; only_add ist idempotent (Benachrichtigungs-Button)
    assert c.post(f"/api/entries/{e['id']}/heart").json()["hearted"] is True
    assert c.post(f"/api/entries/{e['id']}/heart").json()["hearted"] is False
    c.post(f"/api/entries/{e['id']}/heart?only_add=true")
    assert c.post(f"/api/entries/{e['id']}/heart?only_add=true").json()["hearts"] == 1

    # Nur eigene Einträge löschbar, Dateien verschwinden
    assert c.delete(f"/api/entries/{e['id']}").status_code == 404
    c = as_user("hung")
    assert c.delete(f"/api/entries/{e['id']}").json() == {"ok": True}
    assert not (settings.media_dir / f"{pid}_app.webp").exists()
    assert not list(settings.originals_dir.glob(f"{pid}.*"))


def test_today_default_and_memory(as_user):
    c = as_user("hung")
    e = c.post("/api/entries", json={"kind": "long", "title": "Heute", "text": "Ein Tag."}).json()
    assert e["date"] == str(TODAY)
    # Erinnerung: alter Eintrag mit Foto
    pid = c.post("/api/photos", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).json()["id"]
    c.post("/api/entries", json={"text": "Damals", "entry_date": str(TODAY - timedelta(days=200)), "photo_ids": [pid]})
    mem = c.get("/api/memory").json()
    assert mem and mem["entry"]["photos"]


# ---------- Fragen ----------

def test_questions_both_mode_hides_until_complete(as_user, no_network):
    c = as_user("hung")
    q = c.post("/api/questions", json={"text": "Berge oder Meer?", "both": True}).json()
    c.post(f"/api/questions/{q['id']}/answer", json={"text": "Berge"})
    c = as_user("lea")
    open_q = next(x for x in c.get("/api/questions/open").json() if x["id"] == q["id"])
    assert open_q["open_for_me"] and open_q["answers"] == []  # Hungs Antwort verdeckt
    r = c.post(f"/api/questions/{q['id']}/answer", json={"text": "Meer"}).json()
    assert r["complete"] and [a["text"] for a in r["answers"]] == ["Berge", "Meer"]
    assert c.post(f"/api/questions/{q['id']}/answer", json={"text": "nochmal"}).status_code == 409
    assert any(x["id"] == q["id"] for x in c.get(f"/api/questions?month={MONTH}").json())


def test_question_rules(as_user):
    c = as_user("hung")
    q = c.post("/api/questions", json={"text": "Was war schön?"}).json()
    assert c.post(f"/api/questions/{q['id']}/answer", json={"text": "x"}).status_code == 403  # eigene Frage
    assert c.delete(f"/api/questions/{q['id']}").json() == {"ok": True}
    assert c.post("/api/questions", json={"text": "?"}).status_code == 422


def test_ideas_never_repeat_once_questions(as_user):
    c = as_user("hung")
    ideas = c.get("/api/questions/ideas").json()
    assert len(ideas) == 3 and len({i["category"] for i in ideas}) == 3
    c.post("/api/questions", json={"text": "Süß oder salzig?", "both": True})
    seen = {i["text"] for _ in range(200) for i in c.get("/api/questions/ideas").json()}
    assert "Süß oder salzig?" not in seen


# ---------- Erinnerung & Push ----------

def test_weekly_reminder(as_user, monkeypatch):
    import app.reminders as reminders
    sent = []
    monkeypatch.setattr(reminders, "notify_user", lambda uid, p: sent.append((uid, p)))
    with Session(engine) as db:
        for u in db.exec(select(User)).all():
            u.reminder_enabled, u.reminder_weekday, u.reminder_hour, u.last_reminder_at = True, 6, 19, None
            db.add(u)
        db.commit()
    sunday_19 = datetime(2026, 10, 11, 17, 5, tzinfo=timezone.utc)  # 19:05 Berlin
    reminders.check_once(sunday_19)
    reminders.check_once(sunday_19 + timedelta(minutes=20))
    assert len(sent) <= 2 and len({uid for uid, _ in sent}) == len(sent)  # nie doppelt
    reminders.check_once(datetime(2026, 10, 12, 17, 5, tzinfo=timezone.utc))  # Montag: nichts
    assert len(sent) <= 2


def test_push_subscription(as_user):
    c = as_user("hung")
    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}
    c.post("/api/push/subscribe", json=sub)
    c.post("/api/push/subscribe", json=sub)  # doppelt = ein Abo
    with Session(engine) as db:
        assert len(db.exec(select(PushSubscription).where(PushSubscription.endpoint == sub["endpoint"])).all()) == 1
    c.post("/api/push/unsubscribe", json={"endpoint": sub["endpoint"]})


# ---------- Buch ----------

def test_book_pdf_and_preview(as_user):
    c = as_user("hung")
    pid = c.post("/api/photos", files={"file": ("a.jpg", jpeg(size=(2000, 1500)), "image/jpeg")}).json()["id"]
    c.post("/api/entries", json={"text": "Fürs Buch", "entry_date": "2026-03-10", "photo_ids": [pid]})
    r = c.get("/api/book?start=2026-01&end=2026-12&theme=retro&fmt=a4&quality=print&bleed=true")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    assert c.get("/api/book?start=2026-05&end=2026-01").status_code == 422
    assert c.get("/api/book?start=2024-01&end=2026-12").status_code == 422
    p = c.get("/api/book/preview?start=2026-01&end=2026-12&theme=polaroid").json()
    assert len(p["pages"]) >= 4 and 0.6 < p["aspect"] < 0.8
    assert c.get(p["pages"][0]).headers["content-type"] == "image/webp"
    assert c.get(p["pdf"]).content[:4] == b"%PDF"
    assert c.get("/api/book/preview/..%2F..%2Fetc/0.webp").status_code == 404
    as_user(None)
    assert c.get(p["pages"][0]).status_code == 401


# ---------- Google Fotos ----------

def test_google_photos_import(as_user, monkeypatch):
    import app.routes.gphotos as g
    calls = []

    def handler(req: httpx.Request):
        u = str(req.url)
        calls.append((req.method, u))
        assert req.headers["Authorization"] == "Bearer TOKEN"
        if req.method == "POST" and u.endswith("/sessions"):
            return httpx.Response(200, json={"id": "s1", "pickerUri": "https://photos.google.com/picker/s1", "pollingConfig": {"pollInterval": "2s"}})
        if u.endswith("/sessions/s1") and req.method == "GET":
            return httpx.Response(200, json={"mediaItemsSet": True})
        if "/mediaItems" in u:
            return httpx.Response(200, json={"mediaItems": [
                {"type": "PHOTO", "createTime": "2026-02-14T17:42:00Z", "mediaFile": {"baseUrl": "https://lh3.example/p1"}},
                {"type": "VIDEO", "mediaFile": {"baseUrl": "https://lh3.example/v1"}},
            ]})
        if u == "https://lh3.example/p1=d":
            return httpx.Response(200, content=jpeg(taken=None, gps=False))
        if req.method == "DELETE":
            return httpx.Response(200, json={})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    real_client = httpx.Client
    monkeypatch.setattr(g.httpx, "Client", lambda **kw: real_client(transport=transport, **kw))
    monkeypatch.setattr(g.httpx, "post", lambda url, **kw: real_client(transport=transport).post(url, **kw))
    monkeypatch.setattr(g.httpx, "get", lambda url, **kw: real_client(transport=transport).get(url, **kw))

    c = as_user("hung")
    s = c.post("/api/gphotos/session", json={"token": "TOKEN"}).json()
    assert s["id"] == "s1" and s["pollSeconds"] == 2
    assert c.post("/api/gphotos/session/s1/status", json={"token": "TOKEN"}).json() == {"done": True}
    photos = c.post("/api/gphotos/session/s1/import", json={"token": "TOKEN"}).json()
    assert len(photos) == 1 and photos[0]["taken_at"] == "2026-02-14T18:42:00"  # Video übersprungen, Zeit in Berlin
    assert any(m == "DELETE" for m, _ in calls)


# ---------- Datenbank-Migration ----------

def test_old_database_gets_new_columns(tmp_path):
    import sqlite3
    from sqlalchemy import create_engine
    import app.db as dbmod
    old = tmp_path / "old.db"
    con = sqlite3.connect(old)
    con.execute("CREATE TABLE user (id INTEGER PRIMARY KEY, email TEXT, name TEXT, theme TEXT, created_at DATETIME)")
    con.commit()
    con.close()
    real = dbmod.engine
    try:
        dbmod.engine = create_engine(f"sqlite:///{old}")
        dbmod._add_missing_columns()
        cols = {r[1] for r in sqlite3.connect(old).execute("PRAGMA table_info('user')")}
        assert {"reminder_enabled", "reminder_weekday", "reminder_hour", "last_reminder_at"} <= cols
    finally:
        dbmod.engine = real


# ---------- Live-Kanal ----------

def test_stream_requires_login(as_user):
    assert as_user(None).get("/api/stream").status_code == 401


def test_publish_reaches_open_connections():
    """publish() läuft im Threadpool, der Stream im Event-Loop — die Zustellung
    muss über den Loop zurückgereicht werden."""
    import asyncio

    from app import live

    before = live._loop

    async def szenario():
        live.set_loop(asyncio.get_running_loop())
        q = live.subscribe()
        try:
            live.publish("entry", 7)
            await asyncio.sleep(0)  # call_soon_threadsafe einplanen lassen
            assert json.loads(q.get_nowait()) == {"kind": "entry", "by": 7}
        finally:
            live.unsubscribe(q)

    try:
        asyncio.run(szenario())
    finally:
        live.set_loop(before)  # sonst zeigt der Kanal auf einen geschlossenen Loop


# ---------- Energielevel ----------

def test_energy_is_optional_and_bounded(as_user, no_network):
    c = as_user("hung")
    assert c.post("/api/entries", json={"kind": "short", "text": "Langer Lauf", "energy": 7}).json()["energy"] == 7
    assert c.post("/api/entries", json={"kind": "short", "text": "ohne Angabe"}).json()["energy"] is None
    for daneben in (0, 11, -3):
        assert c.post("/api/entries", json={"kind": "short", "text": "x", "energy": daneben}).status_code == 422


# ---------- Ort ----------

def test_place_on_entry_and_lookup(as_user, no_network):
    c = as_user("hung")
    # Selbst eingetragener Ort gewinnt gegen den Ort aus dem Foto
    assert c.post("/api/entries", json={"kind": "short", "text": "Picknick", "place": "Rheinwiese"}).json()["place_name"] == "Rheinwiese"
    assert c.post("/api/entries", json={"kind": "short", "text": "ohne Ort"}).json()["place_name"] is None
    assert c.post("/api/place", json={"lat": 51.22, "lon": 6.77}).json()["place_name"] == "Rheinufer, Düsseldorf"
    assert c.post("/api/place", json={"lat": 999, "lon": 0}).status_code == 422


def test_ask_place_setting(as_user):
    c = as_user("hung")
    assert c.get("/api/auth/me").json()["ask_place"] is False
    assert c.patch("/api/auth/me", json={"ask_place": True}).json()["ask_place"] is True


# ---------- Kommentare ----------

def test_comments(as_user, no_network):
    # as_user liefert immer denselben Client, nur mit anderem Cookie —
    # vor jedem Schritt also neu umschalten.
    c = as_user("hung")
    eintrag = c.post("/api/entries", json={"kind": "short", "text": "Erster Lauf"}).json()
    assert eintrag["comments"] == 0

    # Unter den eigenen Eintrag darf man schreiben
    liste = c.post(f"/api/entries/{eintrag['id']}/comments", json={"text": "War härter als gedacht."}).json()
    assert [x["text"] for x in liste] == ["War härter als gedacht."]
    assert liste[0]["mine"] is True
    von_hung = liste[0]["id"]

    c = as_user("lea")
    liste = c.post(f"/api/entries/{eintrag['id']}/comments", json={"text": "Stark!"}).json()
    assert len(liste) == 2 and liste[1]["author"]["name"] == "Lea" and liste[0]["mine"] is False
    # Fremde Kommentare bleiben stehen
    assert c.delete(f"/api/comments/{von_hung}").status_code == 404

    c = as_user("hung")
    assert len(c.delete(f"/api/comments/{von_hung}").json()) == 1
    assert c.get(f"/api/entries/{eintrag['id']}").json()["comments"] == 1
    assert c.post(f"/api/entries/{eintrag['id']}/comments", json={"text": "   "}).status_code == 422
    assert c.post("/api/entries/999999/comments", json={"text": "x"}).status_code == 404


def test_deleting_entry_removes_comments(as_user, no_network):
    c = as_user("hung")
    e = c.post("/api/entries", json={"kind": "short", "text": "weg damit"}).json()
    c.post(f"/api/entries/{e['id']}/comments", json={"text": "bleibt nicht"})
    assert c.delete(f"/api/entries/{e['id']}").status_code == 200
    assert c.get(f"/api/entries/{e['id']}/comments").status_code == 404


# ---------- Karte ----------

def test_places_only_lists_photos_with_coordinates(as_user, no_network):
    c = as_user("hung")
    mit = c.post("/api/photos", files={"file": ("a.jpg", jpeg(taken="2026:05:01 10:00:00"), "image/jpeg")}).json()
    ohne = c.post("/api/photos", files={"file": ("b.jpg", jpeg(taken=None, gps=False), "image/jpeg")}).json()
    e = c.post("/api/entries", json={"kind": "short", "text": "Karte", "photo_ids": [mit["id"], ohne["id"]]}).json()

    punkte = c.get("/api/places").json()
    eigene = [p for p in punkte if p["entry_id"] == e["id"]]
    assert [p["photo_id"] for p in eigene] == [mit["id"]]
    assert eigene[0]["lat"] is not None and eigene[0]["mine"] is True


# ---------- Orte mit Spitznamen ----------

def test_saved_place_beats_openstreetmap(as_user, no_network):
    c = as_user("hung")
    assert c.get("/api/saved-places").json() == []

    liste = c.post("/api/saved-places", json={"name": "Zuhause", "lat": 51.2254, "lon": 6.7763, "radius_m": 150}).json()
    assert [p["name"] for p in liste] == ["Zuhause"]

    # Direkt am Ort: eigener Name gewinnt gegen den von OpenStreetMap
    nah = c.post("/api/place", json={"lat": 51.2255, "lon": 6.7764}).json()
    assert nah["place_name"] == "Zuhause" and nah["eigener_name"] is True

    # Weit weg: wieder OpenStreetMap (im Test gepatcht)
    weit = c.post("/api/place", json={"lat": 53.55, "lon": 9.99}).json()
    assert weit["place_name"] == "Rheinufer, Düsseldorf" and weit["eigener_name"] is False

    assert c.post("/api/saved-places", json={"name": "  ", "lat": 1, "lon": 1}).status_code == 422
    assert c.delete(f"/api/saved-places/{liste[0]['id']}").json() == []


def test_entry_with_own_location_appears_on_map(as_user, no_network):
    c = as_user("hung")
    e = c.post("/api/entries", json={"kind": "short", "text": "Ohne Foto, aber mit Standort",
                                     "lat": 48.1372, "lon": 11.5755}).json()
    punkte = [p for p in c.get("/api/places").json() if p["entry_id"] == e["id"]]
    assert len(punkte) == 1 and punkte[0]["photo_id"] is None and punkte[0]["lat"] == 48.1372


# ---------- Themes ----------

def test_every_theme_is_registered_everywhere():
    """Ein Theme muss an mehreren Stellen eingetragen sein. Vergisst man eine,
    fällt es sonst erst auf, wenn jemand es auswählt."""
    import re
    from pathlib import Path

    from app.book.themes import BOOK_THEMES
    from app.routes.auth import THEMES

    assert THEMES == set(BOOK_THEMES), "Buch-Palette fehlt oder ist zu viel"

    frontend = Path(__file__).resolve().parents[2] / "frontend" / "src"
    css = (frontend / "theme.css").read_text(encoding="utf-8")
    im_css = set(re.findall(r"\[data-theme='([^']+)'\]", css))
    assert THEMES <= im_css, f"ohne Farben in theme.css: {THEMES - im_css}"

    typen = set(re.findall(r"'([a-zäöü]+)'", (frontend / "types.ts").read_text(encoding="utf-8").splitlines()[0]))
    assert THEMES == typen, f"types.ts weicht ab: {THEMES ^ typen}"

    liste = (frontend / "fonts.ts").read_text(encoding="utf-8")
    # Nicht bis zur ersten ] schneiden — die steckt schon in "Theme[]"
    in_fonts = set(re.findall(r"'([a-zäöü]+)'", re.search(r"const THEMES: Theme\[\] = \[(.*?)\]", liste, re.S).group(1)))
    assert THEMES == in_fonts, f"fonts.ts weicht ab: {THEMES ^ in_fonts}"
