from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    theme: str = "sunset"  # siehe THEMES in routes/auth.py
    reminder_enabled: bool = True
    reminder_weekday: int = 6  # 0 = Montag … 6 = Sonntag
    reminder_hour: int = 19
    ask_place: bool = False  # beim Schreiben immer nach dem Ort fragen
    auto_location: bool = False  # Standort beim Posten automatisch mitnehmen
    last_reminder_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)


class LoginSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(index=True, unique=True)
    user_agent: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    last_seen: datetime = Field(default_factory=utcnow)


class Entry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    entry_date: date = Field(index=True)
    kind: str = "short"  # short | long
    title: str = ""
    text: str = ""
    mood: str = ""
    energy: Optional[int] = None  # 1–10, freiwillig
    place: str = ""  # selbst eingetragen; Fotos liefern ihren Ort weiterhin selbst
    lat: Optional[float] = None  # nur wenn der Standort bewusst mitgegeben wurde
    lon: Optional[float] = None
    edited_at: Optional[datetime] = None  # gesetzt, sobald jemand nachträglich ändert
    created_at: datetime = Field(default_factory=utcnow)


class Photo(SQLModel, table=True):
    id: str = Field(primary_key=True)  # uuid hex, steckt auch im Dateinamen
    user_id: int = Field(foreign_key="user.id", index=True)
    entry_id: Optional[int] = Field(default=None, foreign_key="entry.id", index=True)
    position: int = 0
    width: int = 0
    height: int = 0
    taken_at: Optional[datetime] = None  # Ortszeit laut EXIF
    tz_offset: Optional[str] = None  # z. B. "+02:00"
    lat: Optional[float] = None
    lon: Optional[float] = None
    place_name: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class Reaction(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("entry_id", "user_id", "kind"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entry.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    kind: str = "heart"
    created_at: datetime = Field(default_factory=utcnow)


class SavedPlace(SQLModel, table=True):
    """Ort mit Spitznamen („Zuhause", „Arbeit"). Gilt für beide."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    lat: float
    lon: float
    radius_m: int = 150
    created_by: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow)


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entry.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    text: str
    created_at: datetime = Field(default_factory=utcnow)


class PushSubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    endpoint: str = Field(unique=True)
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=utcnow)


class GeoCache(SQLModel, table=True):
    key: str = Field(primary_key=True)  # "lat,lon" auf ~100 m gerundet
    place_name: Optional[str] = None


class GeoForwardCache(SQLModel, table=True):
    """Gesuchter Ortsname -> Koordinaten. Spart Anfragen an OpenStreetMap."""
    key: str = Field(primary_key=True)  # kleingeschriebener Suchbegriff
    lat: Optional[float] = None
    lon: Optional[float] = None


class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asker_id: int = Field(foreign_key="user.id", index=True)
    text: str
    both: bool = False  # True: beide antworten, Antworten erst sichtbar, wenn beide fertig sind
    created_at: datetime = Field(default_factory=utcnow)


class Answer(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("question_id", "user_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="question.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    text: str
    created_at: datetime = Field(default_factory=utcnow)
