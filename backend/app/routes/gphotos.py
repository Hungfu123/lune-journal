"""Fotos aus Google Fotos übernehmen (Picker API).

Seit März 2025 darf keine App mehr selbst in Alben schauen. Stattdessen öffnet Google Fotos ein Auswahlfenster,
in dem ihr euer gemeinsames Album öffnet und Fotos antippt. Der Server lädt danach genau diese Fotos herunter.
Das Zugriffstoken kommt vom Browser, wird nur für diese Anfragen benutzt und nie gespeichert.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlmodel import Session

from ..config import settings
from ..db import get_db
from ..geocode import fill_place
from ..images import MAX_UPLOAD, process_upload
from ..models import Photo, User
from ..security import current_user
from .serialize import photo_out

router = APIRouter(prefix="/api/gphotos", tags=["gphotos"])
API = "https://photospicker.googleapis.com/v1"
MAX_ITEMS = 30


class TokenIn(BaseModel):
    token: str


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _check(r: httpx.Response) -> dict:
    if r.status_code == 401:
        raise HTTPException(401, "Die Verbindung zu Google Fotos ist abgelaufen. Bitte noch einmal verbinden.")
    if r.status_code >= 400:
        raise HTTPException(502, "Google Fotos hat nicht geantwortet. Versuch es gleich nochmal.")
    return r.json() if r.content else {}


@router.post("/session")
def create_session(body: TokenIn, user: User = Depends(current_user)):
    r = httpx.post(f"{API}/sessions", headers=_headers(body.token), json={"pickingConfig": {"maxItemCount": str(MAX_ITEMS)}}, timeout=15)
    s = _check(r)
    poll = s.get("pollingConfig", {}).get("pollInterval", "3s").rstrip("s")
    return {"id": s["id"], "pickerUri": s["pickerUri"], "pollSeconds": max(1.5, float(poll or 3))}


@router.post("/session/{session_id}/status")
def session_status(session_id: str, body: TokenIn, user: User = Depends(current_user)):
    s = _check(httpx.get(f"{API}/sessions/{session_id}", headers=_headers(body.token), timeout=15))
    return {"done": bool(s.get("mediaItemsSet"))}


def _download_all(token: str, session_id: str) -> list[dict]:
    items, page = [], None
    with httpx.Client(timeout=60, headers=_headers(token), follow_redirects=True) as c:
        while True:
            params = {"sessionId": session_id, "pageSize": 100}
            if page:
                params["pageToken"] = page
            data = _check(c.get(f"{API}/mediaItems", params=params))
            items += [m for m in data.get("mediaItems", []) if m.get("type") == "PHOTO"]
            page = data.get("nextPageToken")
            if not page or len(items) >= MAX_ITEMS:
                break
        results = []
        for m in items[:MAX_ITEMS]:
            f = m.get("mediaFile", {})
            r = c.get(f"{f['baseUrl']}=d")  # Originaldatei (ohne Standort, den gibt Google nicht heraus)
            if r.status_code != 200 or len(r.content) > MAX_UPLOAD:
                continue
            try:
                info = process_upload(r.content)
            except Exception:
                continue
            if info.get("taken_at") is None and m.get("createTime"):
                utc = datetime.fromisoformat(m["createTime"].replace("Z", "+00:00"))
                info["taken_at"] = utc.astimezone(ZoneInfo(settings.timezone)).replace(tzinfo=None)
            results.append(info)
        c.delete(f"{API}/sessions/{session_id}")
    return results


@router.post("/session/{session_id}/import")
async def import_photos(session_id: str, body: TokenIn, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    infos = await run_in_threadpool(_download_all, body.token, session_id)
    photos = []
    for info in infos:
        p = Photo(user_id=user.id, **info)
        db.add(p)
        photos.append(p)
    db.commit()
    for p in photos:
        db.refresh(p)
        if p.lat is not None:
            bg.add_task(fill_place, p.id)
    return [photo_out(p) for p in photos]
