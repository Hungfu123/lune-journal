import random
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, col, delete, select

from ..config import settings
from ..db import get_db
from .. import geocode
from ..images import delete_files, media_path
from ..limiter import limiter
from ..live import publish
from ..models import Comment, Entry, Photo, Reaction, User
from ..push import notify_others
from ..security import current_user, signed_media_url
from .serialize import photo_out

router = APIRouter(prefix="/api", tags=["entries"])
MOODS = {"", "müde", "okay", "gut", "super"}


def today() -> date:
    return datetime.now(ZoneInfo(settings.timezone)).date()


def entries_out(db: Session, entries: list[Entry], me: User) -> list[dict]:
    ids = [e.id for e in entries]
    if not ids:
        return []
    users = {u.id: u for u in db.exec(select(User)).all()}
    photos = defaultdict(list)
    for p in db.exec(select(Photo).where(col(Photo.entry_id).in_(ids)).order_by(Photo.position)).all():
        photos[p.entry_id].append(photo_out(p))
    hearts = defaultdict(list)
    for r in db.exec(select(Reaction).where(col(Reaction.entry_id).in_(ids))).all():
        hearts[r.entry_id].append(r.user_id)
    comments: dict[int, int] = defaultdict(int)
    for row in db.exec(select(Comment.entry_id, func.count()).where(col(Comment.entry_id).in_(ids)).group_by(Comment.entry_id)).all():
        comments[row[0]] = row[1]
    out = []
    for e in entries:
        ph = photos[e.id]
        out.append({
            "id": e.id,
            "date": e.entry_date.isoformat(),
            "kind": e.kind,
            "title": e.title,
            "text": e.text,
            "mood": e.mood,
            "energy": e.energy,
            "created_at": e.created_at.isoformat(),
            "author": {"id": e.user_id, "name": users[e.user_id].name},
            "mine": e.user_id == me.id,
            "photos": ph,
            # Selbst eingetragener Ort hat Vorrang vor dem, was im Foto steckt
            "place_name": e.place or next((p["place_name"] for p in ph if p["place_name"]), None),
            "comments": comments[e.id],
            "hearts": len(hearts[e.id]),
            "hearted": me.id in hearts[e.id],
        })
    return out


@router.get("/entries")
def list_entries(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    author: str = Query("all", pattern="^(all|me|partner)$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    y, m = map(int, month.split("-"))
    start = date(y, m, 1)
    end = date(y + (m == 12), m % 12 + 1, 1)
    q = select(Entry).where(Entry.entry_date >= start, Entry.entry_date < end)
    if author == "me":
        q = q.where(Entry.user_id == user.id)
    elif author == "partner":
        q = q.where(Entry.user_id != user.id)
    q = q.order_by(col(Entry.entry_date).desc(), col(Entry.created_at).desc())
    return entries_out(db, db.exec(q).all(), user)


@router.get("/entries/{entry_id}")
def get_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(Entry, entry_id)
    if not e:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return entries_out(db, [e], user)[0]


@router.get("/months")
def months(year: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.exec(
        select(func.strftime("%m", Entry.entry_date), func.count())
        .where(func.strftime("%Y", Entry.entry_date) == str(year))
        .group_by(func.strftime("%m", Entry.entry_date))
    ).all()
    counts = {int(mm): n for mm, n in rows}
    return [{"month": i, "count": counts.get(i, 0)} for i in range(1, 13)]


class EntryIn(BaseModel):
    kind: str = Field("short", pattern="^(short|long)$")
    title: str = Field("", max_length=120)
    text: str = Field("", max_length=20000)
    mood: str = ""
    energy: int | None = Field(None, ge=1, le=10)
    place: str = Field("", max_length=120)
    entry_date: date | None = None
    photo_ids: list[str] = Field(default_factory=list, max_length=30)


def _notify_new_entry(entry: Entry, author: User, first_photo: str | None) -> None:
    if first_photo:
        title = f"Neues Foto von {author.name}"
    elif entry.kind == "long":
        title = f"{author.name} hat den Tag aufgeschrieben"
    else:
        title = f"Neuer Eintrag von {author.name}"
    body = (entry.title + ": " if entry.title else "") + entry.text
    notify_others(author.id, {
        "title": title,
        "body": body[:140],
        "image": signed_media_url(media_path(first_photo, "app")) if first_photo else None,
        "url": f"/?entry={entry.id}&month={entry.entry_date:%Y-%m}",
        "entry_id": entry.id,
        "tag": f"entry-{entry.id}",
    })


@router.post("/entries")
def create_entry(body: EntryIn, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.text.strip() and not body.photo_ids:
        raise HTTPException(422, "Schreib etwas oder füge ein Foto hinzu.")
    if body.mood not in MOODS:
        raise HTTPException(422, "Unbekannte Stimmung")
    photos = []
    for pid in body.photo_ids:
        p = db.get(Photo, pid)
        if not p or p.user_id != user.id or p.entry_id is not None:
            raise HTTPException(422, "Ein Foto konnte nicht zugeordnet werden. Bitte neu hinzufügen.")
        photos.append(p)
    entry_date = body.entry_date or today()
    if entry_date > today():
        raise HTTPException(422, "Einträge in der Zukunft gehen nicht.")

    entry = Entry(user_id=user.id, entry_date=entry_date, kind=body.kind,
                  title=body.title.strip(), text=body.text.strip(), mood=body.mood, energy=body.energy, place=body.place.strip())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    for i, p in enumerate(photos):
        p.entry_id, p.position = entry.id, i
        db.add(p)
    db.commit()

    bg.add_task(_notify_new_entry, entry, user, photos[0].id if photos else None)
    publish("entry", user.id)
    return entries_out(db, [entry], user)[0]


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(Entry, entry_id)
    if not e or e.user_id != user.id:
        raise HTTPException(404, "Eintrag nicht gefunden")
    for p in db.exec(select(Photo).where(Photo.entry_id == e.id)).all():
        delete_files(p.id)
        db.delete(p)
    db.exec(delete(Reaction).where(Reaction.entry_id == e.id))
    db.exec(delete(Comment).where(Comment.entry_id == e.id))
    db.delete(e)
    db.commit()
    publish("entry", user.id)
    return {"ok": True}


@router.post("/entries/{entry_id}/heart")
def toggle_heart(entry_id: int, bg: BackgroundTasks, only_add: bool = False,
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(Entry, entry_id)
    if not e:
        raise HTTPException(404, "Eintrag nicht gefunden")
    r = db.exec(select(Reaction).where(Reaction.entry_id == e.id, Reaction.user_id == user.id, Reaction.kind == "heart")).first()
    if r and not only_add:
        db.delete(r)
        db.commit()
    elif not r:
        db.add(Reaction(entry_id=e.id, user_id=user.id))
        db.commit()
        if e.user_id != user.id:
            bg.add_task(notify_others, user.id, {
                "title": f"{user.name} hat deinem Eintrag ein Herz gegeben",
                "body": (e.title or e.text)[:100],
                "url": f"/?entry={e.id}&month={e.entry_date:%Y-%m}",
                "tag": f"heart-{e.id}",
            })
    publish("heart", user.id)
    return entries_out(db, [e], user)[0]


class PlaceLookup(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


@router.post("/place")
@limiter.limit("20/minute")
def place_lookup(request: Request, body: PlaceLookup, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Koordinaten vom Handy in einen lesbaren Ort übersetzen (OpenStreetMap).
    Die Koordinaten werden nur für diese Anfrage benutzt und nicht gespeichert —
    am Eintrag landet allein der Name."""
    # Modulzugriff statt direktem Import: so greift das Patchen in den Tests
    name = geocode.reverse(db, body.lat, body.lon)
    if not name:
        raise HTTPException(503, "Der Ort ließ sich gerade nicht bestimmen. Trag ihn einfach selbst ein.")
    return {"place_name": name}


@router.get("/memory")
def memory(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Eine Erinnerung für die Seitenleiste: bevorzugt „heute vor einem Jahr“, sonst ein zufälliger älterer Tag mit Fotos."""
    t = today()
    with_photos = select(Entry).where(col(Entry.id).in_(select(Photo.entry_id).where(col(Photo.entry_id).is_not(None))))
    for years in (1, 2, 3):
        try:
            anchor = t.replace(year=t.year - years)
        except ValueError:  # 29. Februar
            anchor = t.replace(year=t.year - years, day=28)
        near = db.exec(with_photos.where(Entry.entry_date.between(anchor - timedelta(days=3), anchor + timedelta(days=3)))).all()
        if near:
            e = random.choice(near)
            return {"label": "Heute vor einem Jahr" if years == 1 else f"Heute vor {years} Jahren", "entry": entries_out(db, [e], user)[0]}
    older = db.exec(with_photos.where(Entry.entry_date < t - timedelta(days=30))).all()
    if not older:
        return None
    e = random.choice(older)
    months = (t.year - e.entry_date.year) * 12 + t.month - e.entry_date.month
    return {"label": f"Vor {months} Monaten" if months > 1 else "Vor einem Monat", "entry": entries_out(db, [e], user)[0]}
