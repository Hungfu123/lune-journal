from fastapi import APIRouter, Depends, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import LoginSession, User
from ..security import COOKIE, current_session, current_user, media_signature_ok, new_session

router = APIRouter(prefix="/api/auth", tags=["auth"])

THEMES = {"sunset", "ocean", "night", "wald", "lavendel", "zitrone", "polaroid", "kino", "retro", "bonbon", "tiefsee"}


class GoogleLogin(BaseModel):
    credential: str


def user_out(user: User, db: Session) -> dict:
    partner = db.exec(select(User).where(User.id != user.id)).first()
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "theme": user.theme if user.theme in THEMES else "sunset",
        "reminder": {"enabled": user.reminder_enabled, "weekday": user.reminder_weekday, "hour": user.reminder_hour},
        "ask_place": user.ask_place,
        "partner": {"id": partner.id, "name": partner.name} if partner else None,
    }


@router.post("/google")
@limiter.limit("10/minute")
def login_google(request: Request, body: GoogleLogin, response: Response, db: Session = Depends(get_db)):
    try:
        info = id_token.verify_oauth2_token(body.credential, google_requests.Request(), settings.google_client_id)
    except ValueError:
        raise HTTPException(401, "Anmeldung fehlgeschlagen. Bitte noch einmal versuchen.")
    email = (info.get("email") or "").lower()
    if not info.get("email_verified") or email not in settings.allowed:
        raise HTTPException(403, "Diese App ist privat. Mit diesem Google-Konto gibt es keinen Zugriff.")

    user = db.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(email=email, name=info.get("given_name") or email.split("@")[0])
        db.add(user)
        db.commit()
        db.refresh(user)

    token = new_session(db, user, request.headers.get("user-agent", ""))
    response.set_cookie(
        COOKIE, token,
        max_age=settings.session_days * 86400,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )
    return user_out(user, db)


@router.post("/logout")
def logout(response: Response, s: LoginSession | None = Depends(current_session), db: Session = Depends(get_db)):
    if s:
        db.delete(s)
        db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(user, db)


class MeUpdate(BaseModel):
    theme: str | None = None
    name: str | None = None
    reminder_enabled: bool | None = None
    reminder_weekday: int | None = Field(None, ge=0, le=6)
    reminder_hour: int | None = Field(None, ge=0, le=23)
    ask_place: bool | None = None


@router.patch("/me")
def update_me(body: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.theme in THEMES:
        user.theme = body.theme
    if body.name and body.name.strip():
        user.name = body.name.strip()[:40]
    if body.reminder_enabled is not None:
        user.reminder_enabled = body.reminder_enabled
    if body.reminder_weekday is not None:
        user.reminder_weekday = body.reminder_weekday
    if body.reminder_hour is not None:
        user.reminder_hour = body.reminder_hour
    if body.ask_place is not None:
        user.ask_place = body.ask_place
    db.add(user)
    db.commit()
    return user_out(user, db)


@router.get("/devices")
def devices(user: User = Depends(current_user), s: LoginSession | None = Depends(current_session), db: Session = Depends(get_db)):
    rows = db.exec(select(LoginSession).where(LoginSession.user_id == user.id).order_by(LoginSession.last_seen.desc())).all()
    return [{"id": r.id, "user_agent": r.user_agent, "last_seen": r.last_seen, "current": s is not None and r.id == s.id} for r in rows]


@router.delete("/devices/{session_id}")
def remove_device(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(LoginSession, session_id)
    if r and r.user_id == user.id:
        db.delete(r)
        db.commit()
    return {"ok": True}


@router.get("/check")
def check(request: Request, db: Session = Depends(get_db)):
    """Wird von Caddy (forward_auth) vor jeder Bild-Auslieferung gefragt."""
    if current_session(request, db):
        return Response(status_code=200)
    if media_signature_ok(request.headers.get("x-forwarded-uri", "")):
        return Response(status_code=200)
    return Response(status_code=401)
