"""Orte mit Spitznamen („Zuhause", „Arbeit") und das Übersetzen von Koordinaten.

Ein eigener Name gewinnt immer gegen den von OpenStreetMap: „Zuhause" sagt mehr
als „Lindenstraße, Bilk". Die Liste gilt für beide — ihr wohnt ja am selben Ort.
"""
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from .. import geocode
from ..db import get_db
from ..limiter import limiter
from ..models import SavedPlace, User
from ..security import current_user

router = APIRouter(prefix="/api", tags=["places"])


def meters_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Luftlinie in Metern (Haversine)."""
    r = 6_371_000
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def nickname_for(db: Session, lat: float, lon: float) -> str | None:
    """Der nächstgelegene eigene Ort, sofern man nah genug dran ist."""
    treffer = [
        (meters_between(lat, lon, p.lat, p.lon), p)
        for p in db.exec(select(SavedPlace)).all()
    ]
    passend = [(d, p) for d, p in treffer if d <= p.radius_m]
    if not passend:
        return None
    return min(passend, key=lambda t: t[0])[1].name


def place_name_for(db: Session, lat: float, lon: float) -> str | None:
    return nickname_for(db, lat, lon) or geocode.reverse(db, lat, lon)


def coords_for_name(db: Session, name: str) -> tuple[float, float] | None:
    """Umgekehrt: getippter Ortsname -> Koordinaten. Ein eigener Ort gewinnt,
    sonst fragt die App OpenStreetMap."""
    gesucht = name.strip().lower()
    for p in db.exec(select(SavedPlace)).all():
        if p.name.strip().lower() == gesucht:
            return p.lat, p.lon
    return geocode.forward(db, name)


def place_out(p: SavedPlace) -> dict:
    return {"id": p.id, "name": p.name, "lat": p.lat, "lon": p.lon, "radius_m": p.radius_m}


@router.get("/saved-places")
def list_saved(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [place_out(p) for p in db.exec(select(SavedPlace).order_by(SavedPlace.name)).all()]


class SavedPlaceIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    radius_m: int = Field(150, ge=30, le=2000)

    @field_validator("name")
    @classmethod
    def nicht_nur_leerzeichen(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Gib dem Ort einen Namen.")
        return v


@router.post("/saved-places")
def add_saved(body: SavedPlaceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = SavedPlace(name=body.name, lat=body.lat, lon=body.lon, radius_m=body.radius_m, created_by=user.id)
    db.add(p)
    db.commit()
    return [place_out(x) for x in db.exec(select(SavedPlace).order_by(SavedPlace.name)).all()]


@router.delete("/saved-places/{place_id}")
def remove_saved(place_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(SavedPlace, place_id)
    if not p:
        raise HTTPException(404, "Diesen Ort gibt es nicht mehr.")
    db.delete(p)
    db.commit()
    return [place_out(x) for x in db.exec(select(SavedPlace).order_by(SavedPlace.name)).all()]


class PlaceLookup(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


@router.post("/place")
@limiter.limit("20/minute")
def place_lookup(request: Request, body: PlaceLookup, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Koordinaten in einen lesbaren Ort übersetzen. Erst die eigenen Namen,
    sonst OpenStreetMap. Die Koordinaten selbst werden hier nicht gespeichert."""
    name = place_name_for(db, body.lat, body.lon)
    if not name:
        raise HTTPException(503, "Der Ort ließ sich gerade nicht bestimmen. Trag ihn einfach selbst ein.")
    return {"place_name": name, "eigener_name": nickname_for(db, body.lat, body.lon) is not None}
