"""Kommentare unter einem Eintrag. Beide dürfen überall schreiben, auch unter eigene Einträge."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, col, select

from ..db import get_db
from ..live import publish
from ..models import Comment, Entry, User
from ..push import notify_others
from ..security import current_user

router = APIRouter(prefix="/api", tags=["comments"])


def comments_out(db: Session, entry_id: int, me: User) -> list[dict]:
    rows = db.exec(select(Comment).where(Comment.entry_id == entry_id).order_by(col(Comment.created_at))).all()
    users = {u.id: u for u in db.exec(select(User)).all()}
    return [
        {
            "id": c.id,
            "text": c.text,
            "created_at": c.created_at.isoformat(),
            "author": {"id": c.user_id, "name": users[c.user_id].name if c.user_id in users else "?"},
            "mine": c.user_id == me.id,
        }
        for c in rows
    ]


@router.get("/entries/{entry_id}/comments")
def list_comments(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Entry, entry_id):
        raise HTTPException(404, "Eintrag nicht gefunden")
    return comments_out(db, entry_id, user)


class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def nicht_nur_leerzeichen(cls, v: str) -> str:
        # Ohne das rutschen "   " durch die Längenprüfung und landen leer in der Liste
        v = v.strip()
        if not v:
            raise ValueError("Schreib etwas, bevor du abschickst.")
        return v


@router.post("/entries/{entry_id}/comments")
def add_comment(entry_id: int, body: CommentIn, bg: BackgroundTasks,
                user: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = db.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")

    c = Comment(entry_id=entry_id, user_id=user.id, text=body.text)
    db.add(c)
    db.commit()
    db.refresh(c)

    # Unter dem eigenen Eintrag zu kommentieren ist erlaubt, aber keine Nachricht wert,
    # wenn die andere Person dort noch gar nicht mitredet
    if entry.user_id != user.id:
        bg.add_task(notify_others, user.id, {
            "title": f"{user.name} hat deinen Eintrag kommentiert",
            "body": c.text[:140],
            "url": f"/?entry={entry.id}&month={entry.entry_date:%Y-%m}",
            "tag": f"comment-{entry.id}",
        })
    publish("comment", user.id)
    return comments_out(db, entry_id, user)


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Comment, comment_id)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Kommentar nicht gefunden")
    entry_id = c.entry_id
    db.delete(c)
    db.commit()
    publish("comment", user.id)
    return comments_out(db, entry_id, user)
