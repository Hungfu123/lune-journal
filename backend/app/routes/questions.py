from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, col, select

from ..config import settings
from ..db import get_db
from ..ideas import suggest
from ..models import Answer, Question, User
from ..push import notify_others
from ..security import current_user

router = APIRouter(prefix="/api/questions", tags=["questions"])



def _partner_id(db: Session, user_id: int) -> int | None:
    p = db.exec(select(User).where(User.id != user_id)).first()
    return p.id if p else None


def _required(q: Question, other_id: int | None) -> set[int]:
    req = {other_id} if other_id else set()
    if q.both:
        req.add(q.asker_id)
    return req


def _out(q: Question, answers: list[Answer], users: dict[int, User], me: User) -> dict:
    other = next((uid for uid in users if uid != q.asker_id), None)
    req = _required(q, other)
    answered = {a.user_id for a in answers}
    complete = bool(req) and req <= answered
    visible = answers if complete else [a for a in answers if a.user_id == me.id]
    done_at = max((a.created_at for a in answers), default=None) if complete else None
    return {
        "id": q.id,
        "text": q.text,
        "both": q.both,
        "asker": {"id": q.asker_id, "name": users[q.asker_id].name},
        "mine": q.asker_id == me.id,
        "created_at": q.created_at.isoformat(),
        "complete": complete,
        "completed_at": done_at.isoformat() if done_at else None,
        "open_for_me": me.id in req and me.id not in answered,
        "waiting_on": [users[uid].name for uid in req - answered if uid in users],
        "answers": [{"user": {"id": a.user_id, "name": users[a.user_id].name}, "text": a.text} for a in sorted(visible, key=lambda a: a.created_at)],
    }


def _load(db: Session, questions: list[Question], me: User) -> list[dict]:
    users = {u.id: u for u in db.exec(select(User)).all()}
    ids = [q.id for q in questions]
    answers: dict[int, list[Answer]] = {i: [] for i in ids}
    if ids:
        for a in db.exec(select(Answer).where(col(Answer.question_id).in_(ids))).all():
            answers[a.question_id].append(a)
    return [_out(q, answers[q.id], users, me) for q in questions]


@router.get("/open")
def open_questions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    qs = db.exec(select(Question).order_by(col(Question.created_at).desc()).limit(50)).all()
    return [q for q in _load(db, qs, user) if not q["complete"]]


@router.get("")
def answered_in_month(month: str = Query(..., pattern=r"^\d{4}-\d{2}$"), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Beantwortete Fragen, einsortiert nach dem Tag, an dem die letzte Antwort kam."""
    y, m = map(int, month.split("-"))
    end = datetime(y + (m == 12), m % 12 + 1, 1)
    qs = db.exec(select(Question).where(Question.created_at < end)).all()
    done = [q for q in _load(db, qs, user) if q["complete"] and q["completed_at"][:7] == month]
    return sorted(done, key=lambda q: q["completed_at"], reverse=True)


@router.get("/ideas")
def ideas(user: User = Depends(current_user), db: Session = Depends(get_db)):
    asked: dict[str, datetime] = {}
    for q in db.exec(select(Question)).all():
        t = q.created_at.replace(tzinfo=timezone.utc) if q.created_at.tzinfo is None else q.created_at
        asked[q.text] = max(asked.get(q.text, t), t)
    return suggest(asked, datetime.now(ZoneInfo(settings.timezone)).month)


class QuestionIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=300)
    both: bool = False


@router.post("")
def ask(body: QuestionIn, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = Question(asker_id=user.id, text=body.text.strip(), both=body.both)
    db.add(q)
    db.commit()
    db.refresh(q)
    bg.add_task(notify_others, user.id, {
        "title": f"{user.name} hat dir eine Frage gestellt",
        "body": q.text + (" (Ihr antwortet beide)" if q.both else ""),
        "url": f"/?q={q.id}",
        "tag": f"question-{q.id}",
    })
    return _load(db, [q], user)[0]


class AnswerIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.post("/{question_id}/answer")
def answer(question_id: int, body: AnswerIn, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(404, "Frage nicht gefunden")
    if user.id not in _required(q, _partner_id(db, q.asker_id)):
        raise HTTPException(403, "Diese Frage beantwortet die andere Person.")
    if db.exec(select(Answer).where(Answer.question_id == q.id, Answer.user_id == user.id)).first():
        raise HTTPException(409, "Du hast schon geantwortet.")
    db.add(Answer(question_id=q.id, user_id=user.id, text=body.text.strip()))
    db.commit()
    result = _load(db, [q], user)[0]
    if result["complete"]:
        title = "Beide Antworten sind da" if q.both else f"{user.name} hat deine Frage beantwortet"
        bg.add_task(notify_others, user.id, {"title": title, "body": q.text, "url": f"/?q={q.id}", "tag": f"question-{q.id}"})
    return result


@router.delete("/{question_id}")
def delete_question(question_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q or q.asker_id != user.id:
        raise HTTPException(404, "Frage nicht gefunden")
    others = db.exec(select(Answer).where(Answer.question_id == q.id, Answer.user_id != user.id)).first()
    if others:
        raise HTTPException(409, "Die Frage wurde schon beantwortet und bleibt erhalten.")
    for a in db.exec(select(Answer).where(Answer.question_id == q.id)).all():
        db.delete(a)
    db.delete(q)
    db.commit()
    return {"ok": True}
