from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import settings
from ..db import get_db
from ..models import PushSubscription, User
from ..security import current_user

router = APIRouter(prefix="/api/push", tags=["push"])


class Keys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionIn(BaseModel):
    endpoint: str
    keys: Keys


@router.get("/key")
def public_key(user: User = Depends(current_user)):
    return {"key": settings.vapid_public_key}


@router.post("/subscribe")
def subscribe(body: SubscriptionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.exec(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)).first()
    sub = sub or PushSubscription(endpoint=body.endpoint, user_id=user.id, p256dh="", auth="")
    sub.user_id, sub.p256dh, sub.auth = user.id, body.keys.p256dh, body.keys.auth
    db.add(sub)
    db.commit()
    return {"ok": True}


class Unsubscribe(BaseModel):
    endpoint: str


@router.post("/unsubscribe")
def unsubscribe(body: Unsubscribe, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.exec(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)).first()
    if sub and sub.user_id == user.id:
        db.delete(sub)
        db.commit()
    return {"ok": True}
