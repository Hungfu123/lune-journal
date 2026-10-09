"""Erzeugt das Tagebuch als druckfertiges PDF (WeasyPrint)."""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image
from sqlmodel import Session, col, select

from ..config import settings
from ..models import Answer, Entry, Photo, Question, Reaction, User
from .themes import book_theme

BOOK_DIR = Path(__file__).parent
MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
FORMATS = {"a5": ("A5", "148mm", "210mm"), "a4": ("A4", "210mm", "297mm")}
QUALITY = {"print": (1800, 88), "screen": (1100, 78)}

_env = Environment(loader=FileSystemLoader(BOOK_DIR), autoescape=select_autoescape(["html"]))


@dataclass
class BookOptions:
    start: date
    end: date  # erster Tag nach dem Zeitraum
    theme: str = "sunset"
    fmt: str = "a5"
    quality: str = "print"
    bleed: bool = False
    title: str = ""


def _jpeg(photo_id: str, quality: str) -> str | None:
    """WeasyPrint bettet JPEGs direkt ein. Daher einmalig passende JPEGs aus der Druckversion erzeugen und cachen."""
    width, q = QUALITY[quality]
    cache = settings.data_dir / "book_cache"
    cache.mkdir(exist_ok=True)
    target = cache / f"{photo_id}_{width}.jpg"
    if not target.exists():
        src = settings.media_dir / f"{photo_id}_print.webp"
        if not src.exists():
            return None
        img = Image.open(src).convert("RGB")
        img.thumbnail((width, width), Image.LANCZOS)
        img.save(target, "JPEG", quality=q, optimize=True, progressive=False)
    return target.as_uri()


def _longest_streak(days: set[date]) -> int:
    best = run = 0
    for d in sorted(days):
        run = run + 1 if d - timedelta(days=1) in days else 1
        best = max(best, run)
    return best


def build_context(db: Session, me: User, o: BookOptions) -> dict:
    users = {u.id: u for u in db.exec(select(User)).all()}
    partner = next((u for u in users.values() if u.id != me.id), None)
    t = book_theme(o.theme)
    size, page_w, page_h = FORMATS.get(o.fmt, FORMATS["a5"])

    entries = db.exec(
        select(Entry).where(Entry.entry_date >= o.start, Entry.entry_date < o.end).order_by(Entry.entry_date, Entry.created_at)
    ).all()
    ids = [e.id for e in entries]
    photos = defaultdict(list)
    hearts = defaultdict(int)
    if ids:
        for p in db.exec(select(Photo).where(col(Photo.entry_id).in_(ids)).order_by(Photo.position)).all():
            photos[p.entry_id].append(p)
        for r in db.exec(select(Reaction).where(col(Reaction.entry_id).in_(ids))).all():
            hearts[r.entry_id] += 1

    # Fragen, deren letzte Antwort im Zeitraum liegt
    qas_by_day = defaultdict(list)
    question_count = 0
    for q in db.exec(select(Question)).all():
        answers = db.exec(select(Answer).where(Answer.question_id == q.id).order_by(Answer.created_at)).all()
        needed = 2 if q.both else 1
        if len(answers) < needed:
            continue
        done = answers[-1].created_at.date()
        if not (o.start <= done < o.end):
            continue
        question_count += 1
        label = "Ihr habt beide geantwortet" if q.both else f"{users[q.asker_id].name} hat gefragt"
        qas_by_day[done].append({
            "label": label, "text": q.text,
            "answers": [{"name": users[a.user_id].name, "text": a.text, "is_a": a.user_id == me.id} for a in answers],
        })

    # Monate aufbauen
    by_day = defaultdict(list)
    for e in entries:
        by_day[e.entry_date].append(e)
    months = []
    cursor = date(o.start.year, o.start.month, 1)
    all_places: set[str] = set()
    total_photos = 0
    while cursor < o.end:
        nxt = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
        m_entries = [e for e in entries if cursor <= e.entry_date < nxt]
        m_qas = [d for d in qas_by_day if cursor <= d < nxt]
        if m_entries or m_qas:
            days = []
            for d in sorted(set([e.entry_date for e in m_entries] + m_qas)):
                day_entries = []
                for e in by_day.get(d, []):
                    ph = photos[e.id]
                    place = next((p.place_name for p in ph if p.place_name), None)
                    if place:
                        all_places.add(place)
                    day_entries.append({
                        "author": users[e.user_id].name, "is_a": e.user_id == me.id, "kind": e.kind, "title": e.title,
                        "text": e.text, "mood": e.mood, "hearts": hearts[e.id], "place": place,
                        "photos": [u for u in (_jpeg(p.id, o.quality) for p in ph[:4]) if u],
                    })
                days.append({"day": d.day, "weekday": WEEKDAYS[d.weekday()], "entries": day_entries, "qas": qas_by_day.get(d, [])})

            ranked = sorted(m_entries, key=lambda e: (hearts[e.id], len(photos[e.id])), reverse=True)
            mosaic_ids = [p.id for e in ranked for p in photos[e.id][:1]][:3]
            m_photo_count = sum(len(photos[e.id]) for e in m_entries)
            total_photos += m_photo_count
            best_short = next((e for e in ranked if e.kind == "short" and e.text and hearts[e.id]), None)
            first_qa = next((qas_by_day[d][0] for d in sorted(m_qas)), None)
            highlight = None
            if first_qa:
                highlight = {"label": first_qa["text"], "text": first_qa["answers"][-1]["text"]}
            elif best_short:
                highlight = {"label": "Meiste Herzen", "text": best_short.text}
            months.append({
                "key": f"{cursor:%Y-%m}", "name": MONTHS[cursor.month - 1], "year": cursor.year,
                "count": len(m_entries), "photo_count": m_photo_count,
                "places": len({p.place_name for e in m_entries for p in photos[e.id] if p.place_name}),
                "mosaic": [u for u in (_jpeg(pid, o.quality) for pid in mosaic_ids) if u],
                "highlight": highlight, "days": days,
            })
        cursor = nxt

    # Cover: das Foto mit den meisten Herzen, sonst das neueste
    cover_entry = max((e for e in entries if photos[e.id]), key=lambda e: (hearts[e.id], e.entry_date), default=None)
    cover = _jpeg(photos[cover_entry.id][0].id, o.quality) if cover_entry else None

    last_day = o.end - timedelta(days=1)
    if o.start.year == last_day.year and o.start.month == 1 and last_day.month == 12:
        range_label = str(o.start.year)
    elif (o.start.year, o.start.month) == (last_day.year, last_day.month):
        range_label = f"{MONTHS[o.start.month - 1]} {o.start.year}"
    else:
        same_year = o.start.year == last_day.year
        range_label = (f"{MONTHS[o.start.month - 1]}{'' if same_year else ' ' + str(o.start.year)} – "
                       f"{MONTHS[last_day.month - 1]} {last_day.year}")
    ranked_months = sorted(months, key=lambda m: (m["count"], m["photo_count"]), reverse=True)
    best = ranked_months[0] if ranked_months else None
    if len(ranked_months) > 1 and (ranked_months[1]["count"], ranked_months[1]["photo_count"]) == (best["count"], best["photo_count"]):
        best = None  # Gleichstand: lieber nichts behaupten

    return {
        "layouts": {1: ["only"], 2: ["l", "r"], 3: ["full", "l", "r"], 4: ["l", "r", "l", "r"]},
        "t": t, "size": size, "page_w": page_w, "page_h": page_h, "bleed": o.bleed,
        "title": o.title or "Lune Journal",
        "names": f"{me.name} & {partner.name}" if partner else me.name,
        "range_label": range_label, "cover": cover, "months": months,
        "totals": {
            "entries": len(entries), "photos": total_photos, "hearts": sum(hearts.values()), "questions": question_count,
            "places": len(all_places), "streak": _longest_streak({e.entry_date for e in entries}),
            "best_month": best["name"] if best and len(months) > 1 else None,
        },
    }


def render_pdf(db: Session, me: User, o: BookOptions) -> bytes:
    from weasyprint import HTML  # erst hier importieren: schwer, wird selten gebraucht

    html = _env.get_template("template.html").render(**build_context(db, me, o))
    return HTML(string=html, base_url=str(BOOK_DIR) + "/").write_pdf()


# ---------- Vorschau zum Durchblättern ----------
import json
import shutil
import time
import uuid

PREVIEW_WIDTH = 900  # px pro Seite, scharf genug fürs Handy und für die Doppelseite am Desktop


def preview_dir() -> Path:
    d = settings.data_dir / "book_cache" / "previews"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cleanup_previews(max_age_s: int = 24 * 3600) -> None:
    now = time.time()
    for d in preview_dir().iterdir():
        if d.is_dir() and now - d.stat().st_mtime > max_age_s:
            shutil.rmtree(d, ignore_errors=True)


def render_preview(db: Session, me: User, o: BookOptions, filename: str) -> dict:
    """PDF erzeugen, speichern und jede Seite als Bild rendern, damit die App das Buch zum Blättern zeigen kann."""
    import pypdfium2 as pdfium

    _cleanup_previews()
    pdf_bytes = render_pdf(db, me, o)
    pid = uuid.uuid4().hex
    d = preview_dir() / pid
    d.mkdir()
    (d / "book.pdf").write_bytes(pdf_bytes)
    doc = pdfium.PdfDocument(pdf_bytes)
    w_pt, h_pt = doc[0].get_size()
    for i in range(len(doc)):
        page = doc[i]
        img = page.render(scale=PREVIEW_WIDTH / page.get_width()).to_pil().convert("RGB")
        img.save(d / f"{i}.webp", "WEBP", quality=80, method=4)
    meta = {"owner": me.id, "pages": len(doc), "name": filename, "aspect": round(w_pt / h_pt, 4)}
    (d / "meta.json").write_text(json.dumps(meta))
    return {"id": pid, **meta}
