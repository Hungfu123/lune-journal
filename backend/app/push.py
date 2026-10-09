import json
import logging

from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from .config import settings
from .db import engine
from .models import PushSubscription

log = logging.getLogger("push")


def notify_others(author_id: int, payload: dict) -> None:
    """Schickt eine Benachrichtigung an alle Geräte der anderen Person."""
    _send(PushSubscription.user_id != author_id, payload)


def notify_user(user_id: int, payload: dict) -> None:
    """Schickt eine Benachrichtigung an alle Geräte dieser Person."""
    _send(PushSubscription.user_id == user_id, payload)


def _send(condition, payload: dict) -> None:
    if not settings.vapid_public_key or not settings.vapid_private_key_path.exists():
        return
    with Session(engine) as db:
        subs = db.exec(select(PushSubscription).where(condition)).all()
        for s in subs:
            try:
                webpush(
                    subscription_info={"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}},
                    data=json.dumps(payload),
                    vapid_private_key=str(settings.vapid_private_key_path),
                    vapid_claims={"sub": settings.vapid_subject},
                    ttl=24 * 3600,
                )
            except WebPushException as e:
                status = getattr(e.response, "status_code", None)
                if status in (404, 410):  # Abo abgelaufen oder App deinstalliert
                    db.delete(s)
                    db.commit()
                else:
                    log.warning("Push fehlgeschlagen: %s", e)
