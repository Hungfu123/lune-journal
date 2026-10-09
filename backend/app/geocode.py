"""Koordinaten -> lesbarer Ort über Nominatim (OpenStreetMap). Max. 1 Anfrage/Sekunde, Ergebnisse werden gecacht."""
import threading
import time

import httpx
from sqlmodel import Session

from .config import settings
from .db import engine
from .models import GeoCache, Photo

_lock = threading.Lock()
_last = 0.0


def _name_from(address: dict) -> str | None:
    spot = next((address[k] for k in ("tourism", "leisure", "amenity", "park", "natural", "road") if k in address), None)
    area = next((address[k] for k in ("suburb", "city_district", "village", "town", "city") if k in address), None)
    city = next((address[k] for k in ("city", "town", "village") if k in address), None)
    parts = [p for p in (spot, area if area != city else None, city) if p]
    return ", ".join(dict.fromkeys(parts)) or None


def reverse(db: Session, lat: float, lon: float) -> str | None:
    global _last
    key = f"{lat:.3f},{lon:.3f}"
    cached = db.get(GeoCache, key)
    if cached:
        return cached.place_name
    with _lock:
        wait = 1.1 - (time.monotonic() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.monotonic()
        try:
            r = httpx.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 17, "accept-language": "de"},
                headers={"User-Agent": f"lune-journal/1.0 ({settings.vapid_subject})"},
                timeout=10,
            )
            r.raise_for_status()
            name = _name_from(r.json().get("address", {}))
        except Exception:
            return None
    db.add(GeoCache(key=key, place_name=name))
    db.commit()
    return name


def fill_place(photo_id: str) -> None:
    with Session(engine) as db:
        photo = db.get(Photo, photo_id)
        if not photo or photo.lat is None or photo.lon is None:
            return
        photo.place_name = reverse(db, photo.lat, photo.lon)
        db.add(photo)
        db.commit()
