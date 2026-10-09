import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from .config import settings
from .db import get_db
from .models import LoginSession, User

COOKIE = "tb_session"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(db: Session, user: User, user_agent: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(user_id=user.id, token_hash=hash_token(token), user_agent=user_agent[:200]))
    db.commit()
    return token


def _session_from_request(request: Request, db: Session) -> LoginSession | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    s = db.exec(select(LoginSession).where(LoginSession.token_hash == hash_token(token))).first()
    if not s:
        return None
    now = datetime.now(timezone.utc)
    created = s.created_at.replace(tzinfo=timezone.utc) if s.created_at.tzinfo is None else s.created_at
    if now - created > timedelta(days=settings.session_days):
        db.delete(s)
        db.commit()
        return None
    last = s.last_seen.replace(tzinfo=timezone.utc) if s.last_seen.tzinfo is None else s.last_seen
    if now - last > timedelta(hours=1):
        s.last_seen = now
        db.add(s)
        db.commit()
    return s


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    s = _session_from_request(request, db)
    if not s:
        raise HTTPException(401, "Nicht angemeldet")
    user = db.get(User, s.user_id)
    if not user:
        raise HTTPException(401, "Nicht angemeldet")
    return user


def current_session(request: Request, db: Session = Depends(get_db)) -> LoginSession | None:
    return _session_from_request(request, db)


# --- Signierte Bild-Links (für Benachrichtigungsbilder, die ohne Cookie geladen werden) ---

def _sig(path: str, exp: int) -> str:
    return hmac.new(settings.media_secret.encode(), f"{path}|{exp}".encode(), hashlib.sha256).hexdigest()[:32]


def signed_media_url(path: str, ttl_seconds: int = 6 * 3600) -> str:
    exp = int(time.time()) + ttl_seconds
    return f"{settings.public_url}{path}?exp={exp}&sig={_sig(path, exp)}"


def media_signature_ok(forwarded_uri: str) -> bool:
    parts = urlsplit(forwarded_uri)
    if not parts.path.startswith("/media/"):
        return False
    q = parse_qs(parts.query)
    try:
        exp = int(q["exp"][0])
        sig = q["sig"][0]
    except (KeyError, ValueError, IndexError):
        return False
    return exp > time.time() and hmac.compare_digest(sig, _sig(parts.path, exp))
