"""Wöchentliche Erinnerung: einmal pro Woche zur gewählten Zeit ein kleiner Anstoß zum Schreiben."""
import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlmodel import Session, col, select

from .config import settings
from .db import engine
from .models import Answer, Entry, Question, User
from .push import notify_user

log = logging.getLogger("reminders")

TEXTS = [
    "Wie war deine Woche? Ein Satz reicht schon.",
    "Kleiner Wochenrückblick: Was war schön, was war lustig?",
    "Schreib auf, was diese Woche passiert ist, bevor du es vergisst.",
    "Ein Foto und ein Satz zur Woche?",
]


def _open_questions_for(db: Session, user: User) -> int:
    answered = set(db.exec(select(Answer.question_id).where(Answer.user_id == user.id)).all())
    relevant = db.exec(select(Question).where((Question.asker_id != user.id) | (col(Question.both).is_(True)))).all()
    return sum(1 for q in relevant if q.id not in answered)


def check_once(now: datetime | None = None) -> None:
    tz = ZoneInfo(settings.timezone)
    local = (now or datetime.now(timezone.utc)).astimezone(tz)
    with Session(engine) as db:
        users = db.exec(select(User)).all()
        for u in users:
            if not u.reminder_enabled or local.weekday() != u.reminder_weekday or local.hour != u.reminder_hour:
                continue
            last = u.last_reminder_at.replace(tzinfo=timezone.utc) if u.last_reminder_at and u.last_reminder_at.tzinfo is None else u.last_reminder_at
            if last and local - last < timedelta(days=6):
                continue
            partner = next((p for p in users if p.id != u.id), None)
            posted_today = db.exec(select(Entry).where(Entry.user_id == u.id, Entry.entry_date == local.date())).first()
            open_q = _open_questions_for(db, u)
            u.last_reminder_at = datetime.now(timezone.utc)
            db.add(u)
            db.commit()
            if posted_today and not open_q:
                continue  # heute schon geschrieben, keine offenen Fragen: nicht stören
            body = random.choice(TEXTS)
            if open_q and partner:
                body += f" Und {partner.name} wartet noch auf {'eine Antwort' if open_q == 1 else f'{open_q} Antworten'}."
            notify_user(u.id, {"title": "Lune Journal", "body": body, "url": "/?new=1", "tag": "weekly-reminder"})


async def reminder_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(check_once)
        except Exception:
            log.exception("Erinnerung fehlgeschlagen")
        await asyncio.sleep(600)  # alle 10 Minuten prüfen
